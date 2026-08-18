# Comments for BK-466

[View in Jira](https://jira.upexgalaxy.com/browse/BK-466)

---

### Automation for Jira - 14/8/2026, 18:24:37

🔎 Pull Request created. Task is pending to ANALYZE and REVIEW by the team. Waiting for PR Approval.

---

### Ely - 14/8/2026, 18:24:42

## Fix summary

Root cause: the evidence anchor rendered ANY parseable URL scheme as a clickable link (`components/runs/RunnerView.tsx`, as filed) — and, confirmed by reading the code rather than the nearby comments, the same gap existed at BOTH write-time gates on this path, not only the one named in the ticket:

- `lib/runs/mark-step-view.ts`'s client-side check (`validateMarkStepForm`, ticket-named) used the unguarded `isValidUrl`.
- `lib/runs/validation.ts`'s `RunStepMarkBodySchema.evidence*url` — the actual enforcement point of record for a direct/bearer-token API caller that bypasses the UI entirely — used a bare `.url()` with no protocol restriction. This one was not named in the ticket; found it by reading `app/api/v1/runs/[id]/steps/[stepId]/mark/route.ts` and the RPC (`0042*run*step*mark.sql`, which also never checks scheme).

All three layers now share the existing `isHttpUrl` allowlist (`lib/utils/url.ts`, shipped by BK-337) rather than a second implementation. Non-http(s) evidence links still render as visible plain text — never dropped — per the ticket's expected result.

Regression tests added in `lib/runs/mark-step-view.test.ts` and `lib/runs/validation.test.ts`; confirmed both fail against the pre-fix code (`javascript:`/`data:` currently pass validation and render as anchors) and pass after the fix. Full verification: targeted tests 107/107 pass, `types:check` clean, `lint:check` 0 errors, full suite 1499/1500 pass (the 1 failure is a pre-existing, unrelated live-DB seed-data flake in `lib/runs/start-run.test.ts`, reproduced in isolation, untouched by this change).

PR: https://github.com/upex-galaxy/upex-bunkai-tms/pull/172 (into `staging`, not merged — awaiting review)

---

### Automation for Jira - 14/8/2026, 18:43:28

✅ Pull Request is successfully MERGED and DEPLOYED on QA. 
It's Ready for Testing Phase! 
Dev Task is Done.

---

### Ely - 14/8/2026, 18:44:12

## Dev handoff — Ready For QA

Fixed and merged to `staging` via [PR #172](https://github.com/upex-galaxy/upex-bunkai-tms/pull/172) (merge commit `de670c4`, verified as a genuine ancestor of `origin/staging` — not just a status flip). Delivered by the autonomous bug routine.

### Root cause — and it ran one layer deeper than this ticket described

The ticket named two call sites. Tracing the real write path found a third:

| Layer | Was | Now |
| --- | --- | --- |
| Render — `components/runs/RunnerView.tsx` | `href={s.evidence_url}` with no scheme check | anchor only when the scheme is http(s); anything else renders as ***plain visible text***, never dropped |
| Client validation — `lib/runs/mark-step-view.ts` | `isValidUrl` (a bare `new URL()` parse) | `isHttpUrl` |
| ***API schema — ****`lib/runs/validation.ts` | `RunStepMarkBodySchema.evidence_url` was a bare `.url()` with ****no protocol restriction*** | `.url({ protocol: z.regexes.httpProtocol })` |

The third layer carried a comment calling it "the enforcement point of record". It was not, for scheme — the comment described behaviour that had never been implemented. That comment has been corrected.

This is a root-cause fix, not a symptom patch: the scheme allowlist now sits at the render and at both write paths, reusing the existing `isHttpUrl` helper rather than adding a fourth copy of the rule.

### One helper behaviour change, worth knowing at QA time

`isHttpUrl` (`lib/utils/url.ts`) now requires an explicit `://`, so `http:example.com` is rejected. Before this change it returned `true` there while the server-side Zod schema rejected the same string — meaning the form accepted a value the API then 422'd with a generic, non-field-level error. The helper is shared with the bugs domain, so that surface gets the same tightening. All bugs-domain tests pass.

### Verification

- Targeted suites: ***113 pass, 0 fail*** (`mark-step-view`, `validation`, `utils/url`, `bugs/validation`, `bugs/detail-view`)
- `types:check` clean · `lint:check` 0 errors (6 pre-existing warnings in an untouched file)
- Regression tests confirmed ***fail-then-pass*** by reverting only the fix files and re-running. `lib/runs/validation.test.ts` exercises the real production parse used by the mark route, not a mirror fixture.
- Full suite: 1499 pass, 1 fail — `lib/runs/start-run.test.ts` "ATC-01" (`step_count` expected 1, got 2). ***Pre-existing and unrelated***: it hits a live Supabase instance with seed-data drift and imports nothing this change touches.

### What QA should focus on

Set a run step's evidence URL to `javascript:alert(1)` and to a `data:` payload, then open that run as any workspace member. Expected: the value is still ***visible as text****, and is ****not clickable***. Also confirm a normal `https://` link still opens as before, and that `http:example.com` now gets rejected at the form rather than after submit.

### Residual risk — please read before signing off

> ***WARNING:**** The database still accepts any scheme. `run*steps` has a member-or-above INSERT policy, no UPDATE policy, and ****no scheme CHECK on ****`evidence*url`, and the anon key is public — so a workspace member can persist a hostile value by inserting directly through PostgREST, bypassing every Zod schema above. "No hostile row can exist" is ****not*** true. The render guard is therefore permanently load-bearing, not merely defence-in-depth. RLS still bounds the blast radius to a single tenant, as the original filing said.

No migration or CHECK constraint was added — that is a separate decision, deliberately out of a bug fix's scope.

### Two follow-ups found during review, not fixed here

1. ***The render guard has no automated coverage.*** This repo has no DOM test library and no E2E harness at all (138 test files, every one a pure-logic `.test.ts`). Deleting the anchor-vs-text branch would leave the suite green. The load-bearing layer of a security fix is currently untested — worth its own ticket, and it needs a harness decision first, so it was not forced into this fix.
2. `lib/runs/report-bug-view.ts:58` seeds `BugFormDialog.initialEvidenceUrls` with a legacy `javascript:` URL unfiltered. It never reaches an `href` (it renders as a span), but `evidenceUrlsSchema` then rejects the POST — so a tester hitting a legacy row cannot file the bug at all and just sees a generic error. Adjacent defect, separate ticket.

---


_Synced from Jira by sync-jira-issues_
