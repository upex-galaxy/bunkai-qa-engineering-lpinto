# Comments for BK-43

[View in Jira](https://jira.upexgalaxy.com/browse/BK-43)

---

### Nahuel Gomez - 29/6/2026, 23:29:24

## Shift-Left QA Refinement — 2026-06-29

### Quality Gaps Found

| ***Gap**** | ****Severity*** |
| --- | --- |
| Integration mechanism undefined (polling/event/webhook?) | HIGH |
| No Gherkin ACs | HIGH |
| Retry policy undefined | HIGH |
| Field mapping undefined | HIGH |
| Sync on update unaddressed | HIGH |
| Deletion semantics undefined | HIGH |
| Authentication mechanism undefined | MEDIUM |
| Duplicate detection | MEDIUM |

### Open Questions for PO

1. ***Sync on update:*** When a Bunkai bug is edited, should the change propagate to the external tracker?
2. ***Deletion semantics:*** If a Bunkai bug is deleted, should the external issue also be deleted?
3. ***External tracker:*** Confirm Jira Cloud?
4. ***Field mapping:*** severity→priority, module→component, evidence→attachment?

### Open Questions for Dev

1. ***Integration mechanism:*** DB event trigger, pg_cron poller, or event bus webhook?
2. ***Retry policy:*** max retries, backoff formula, permanent failure threshold
3. ***Deduplication key:*** external_id field, content hash, or idempotency key?
4. ***Rate limiting:*** Expected external API limits, 429 backoff strategy
5. ***Auth refresh:*** How does admin update expired credentials?

### ATP DRAFT — 13 outlines

1. TDS01 — New defect auto-syncs
2. TDS02 — Fire-and-forget on network failure
3. TDS03 — Failed sync auto-retried
4. TDS04 — Sync-failed badge + retry button
5. TDS05 — One-way: no reverse sync
6. TDS06 — Workspace without integration — no sync
7. TDS07 — Duplicate prevention
8. TDS08 — Permanent auth failure stops retries
9. TDS09 — Bug update propagates (if confirmed)
10. TDS10 — Deletion does not delete external
11. TDS11 — Rate limit backoff
12. TDS12 — Field mapping accuracy
13. TDS13 — Workspace isolation

Full refinement: `shift-left-bk43.md` in QA repo.

---

### Nahuel Gomez - 3/7/2026, 17:32:24

## QA Refinements (Shift-Left Analysis)

### Quality Gaps Found

| ***Gap**** | ****Severity*** |
| --- | --- |
| Integration mechanism undefined (polling/event/webhook?) | HIGH |
| No Gherkin ACs | HIGH |
| Retry policy undefined | HIGH |
| Field mapping undefined | HIGH |
| Sync on update unaddressed | HIGH |
| Deletion semantics undefined | HIGH |
| Authentication mechanism undefined | MEDIUM |
| Duplicate detection | MEDIUM |

### Open Questions for PO

1. ***Sync on update:*** When a Bunkai bug is edited, should the change propagate to the external tracker?
2. ***Deletion semantics:*** If a Bunkai bug is deleted, should the external issue also be deleted?
3. ***External tracker:*** Confirm Jira Cloud?
4. ***Field mapping:*** severity→priority, module→component, evidence→attachment?

### Open Questions for Dev

1. ***Integration mechanism:*** DB event trigger, pg_cron poller, or event bus webhook?
2. ***Retry policy:*** max retries, backoff formula, permanent failure threshold
3. ***Deduplication key:*** external_id field, content hash, or idempotency key?
4. ***Rate limiting:*** Expected external API limits, 429 backoff strategy
5. ***Auth refresh:*** How does admin update expired credentials?

### ATP DRAFT — 13 outlines

ATP DRAFT lives in the 🧪 Acceptance Test Plan (ATP) field. Covers 13 outlines (7 positive, 4 negative/error, 2 boundary). Full detail in customfield_10067.

---

### Nahuel Gomez - 10/7/2026, 20:25:35

1. 

****Story Points:**** 1 SP
****Rationale:**** Shift-left refinement complete (13 AC outlines across 4 categories: 7 positive, 4 negative/error, 2 boundary). Low complexity — one-way sync integration with existing defect filing workflow ([https://jira.upexgalaxy.com/browse/BK-40#icft=BK-40](https://jira.upexgalaxy.com/browse/BK-40#icft=BK-40)). ATP published to field.

****Estimated by:**** Nahuel Gomez
****Date:**** 2026-07-10
****Next:**** Ready For Dev

---

### Nahuel Gomez - 10/7/2026, 20:57:55

## Estimation Completed

***Story Points:*** 1 SP
***ATP:*** Published to field (26 outlines)
***Rationale:*** Shift-left refinement complete. Low complexity — one-way sync integration.

***Estimated by:**** Nahuel Gomez | ****Date:*** 2026-07-10

---

### Nahuel Gomez - 22/7/2026, 21:01:24

## Automation — 14 KATA ATCs written

14 Test issues created and linked to [BK-43](https://jira.upexgalaxy.com/browse/BK-43) with KATA-compliant automated tests in the QA engineering repo:

| ***Test**** | ****ATC**** | ****Scenario**** | ****Status*** |
| --- | --- | --- | --- |
| [BK-234](https://jira.upexgalaxy.com/browse/BK-234) | TDS01 | New defect auto-syncs | Candidate |
| [BK-235](https://jira.upexgalaxy.com/browse/BK-235) | TDS02 | Fire-and-forget on network failure | Candidate |
| [BK-236](https://jira.upexgalaxy.com/browse/BK-236) | TDS03 | Failed sync auto-retried | Candidate |
| [BK-237](https://jira.upexgalaxy.com/browse/BK-237) | TDS04 | Sync-failed state | Candidate |
| [BK-238](https://jira.upexgalaxy.com/browse/BK-238) | TDS05 | One-way: no reverse sync | Candidate |
| [BK-239](https://jira.upexgalaxy.com/browse/BK-239) | TDS06 | Workspace without integration | Candidate |
| [BK-240](https://jira.upexgalaxy.com/browse/BK-240) | TDS07 | Duplicate prevention | Candidate |
| [BK-241](https://jira.upexgalaxy.com/browse/BK-241) | TDS08 | Permanent auth failure stops retries | Candidate |
| [BK-242](https://jira.upexgalaxy.com/browse/BK-242) | TDS09 | Bug update propagates | Candidate |
| [BK-243](https://jira.upexgalaxy.com/browse/BK-243) | TDS10 | Deletion does not delete external | Candidate |
| [BK-244](https://jira.upexgalaxy.com/browse/BK-244) | TDS11 | Rate limit backoff | Candidate |
| [BK-245](https://jira.upexgalaxy.com/browse/BK-245) | TDS12 | Field mapping accuracy | Candidate |
| [BK-246](https://jira.upexgalaxy.com/browse/BK-246) | TDS13 | Workspace isolation | Candidate |
| [BK-247](https://jira.upexgalaxy.com/browse/BK-247) | TDS14 | External link back to Bunkai | Candidate |

All tests are tagged `@critical @defect-sync` and included in the CI regression + smoke pipeline. Results auto-sync to Xray via AUTO_SYNC.

***Next:*** When the Defect Sync API ships to staging, run the regression suite — results will flow to Xray and flip these tests from Candidate to Automated.

PR: [https://github.com/nelgoez/bunkai-qa-engineering/pull/1](https://github.com/nelgoez/bunkai-qa-engineering/pull/1)

---

### Nahuel Gomez - 22/7/2026, 21:26:10

## PR #1 Merged — Automation Code on `main`

14 KATA ATCs now on the default branch. CI pipeline green (including pre-existing [BK-169](https://jira.upexgalaxy.com/browse/BK-169) fix).

| ***Key**** | ****Status**** | ****QA Assignee*** |
| --- | --- | --- |
| [BK-234](https://jira.upexgalaxy.com/browse/BK-234) — [BK-247](https://jira.upexgalaxy.com/browse/BK-247) | Candidate → AUTOMATED (once feature ships) | Ely |

***Next:*** Once [BK-43](https://jira.upexgalaxy.com/browse/BK-43) defect sync endpoints deploy to staging, running regression will execute these ATCs and sync results to Xray automatically.

---

### Ely - 30/7/2026, 13:28:25

Mockup — Bug detail — Jira sync status states. Source: .context/designs/bunkai-test-management-tool/bk-31-bug-reports/bug-detail.html · spec: master-design-plan §4.6



---

### Ely - 1/8/2026, 19:17:44

## PO + Dev Ratification — explicit live authorization, 2026-08-01

Delegated by Ely (project owner) in a live conversation on 2026-08-01, NOT a blanket forward-dated batch comment. AI-authored, grounded in the evidence cited below. Answers are decisive engineering/product calls where within scope; anything genuinely requiring the human owner is flagged explicitly, not guessed.

> ***INFO:**** The 2026-06-29 / 2026-07-03 shift-left comments list ****9*** explicit Open Questions (4 for PO, 5 for Dev), not 8 — quoting all 9 verbatim below for completeness. All are answered; none require escalation to Ely.

### Evidence reviewed before deciding

- `.context/business/business-data-map.md` §6 "External Integrations > Jira (Atlassian)" — the outbound bug-sync direction is already architected: `bugs.external*id` + `bugs.external*url` + `jira*sync*status`, an `integrations` row with `kind=jira` + `config` + `secrets_ref`, a "Jira bug-sync worker" fired on `bugs` INSERT, and a `jira-bug-sync-retry` cron (every 5 min, exponential backoff) already named in §5.
- `.context/master-implementation-plan.md` — "Jira REST — Sprint 3 (inbound import) + Sprint 5 (outbound sync)" names a ***Jira Cloud**** sandbox tenant explicitly. GitHub Issues + Linear sync are explicitly ****Phase 3***, out of scope here.
- `.context/design/master-design-plan.md` §4.6 — `bug-detail.html` mockup already specs the "External tracker panel" with exactly four states: default (synced + linked run), standalone (no tracker attempted), sync-failed (badge + failure-reason card), no-integration-configured (panel absent, no error).
- `.context/ADR/ADR-0012-rpc-authorization-invariant.md` + `.claude/skills/sprint-development/references/rpc-authorization.md` — actor-bind + result-scoping invariant for any `SECURITY DEFINER` function.
- BK-43's own description/DoD (already Ready For Dev before this pass) — confirms one-way direction, non-blocking filing, sync-failed state, auto-retry.

***Conclusion on the authority boundary***: no sub-question below requires a new vendor choice (Jira Cloud is already the named target in project docs), a new credential-storage mechanism (`secrets_ref` on the `integrations` row is already established, shared with the BK-009 import direction), or a new data-exposure posture (the sync's approved purpose is to expose defect content externally; no broader leak surface was found). All 9 are decided below.

---

### Open Questions for PO

***1. "Sync on update******:****** When a Bunkai bug is edited, should the change propagate to the external tracker?"***
Decision: ***No — BK-43 is create-only sync.**** The DoD bullets only describe create-time behavior (filed → sent automatically, synced/sync-failed states, retry). None mentions edit-triggered re-sync, and `business-data-map.md`'s worker is documented as firing "on `bugs` INSERT" only, not UPDATE. ATP outline TDS09 ("Bug update propagates") is explicitly marked "(if confirmed)" in QA's own draft — now confirmed ****out of scope*** for this 1 SP story. Add an explicit Out of Scope line rather than leaving it silently unaddressed. Update-propagation is a follow-up story if the team wants it later.

***2. "Deletion semantics******:****** If a Bunkai bug is deleted, should the external issue also be deleted?"***
Decision: ***No — deletion never propagates.*** Consistent with the DoD's own one-way invariant ("never the reverse") and QA's ATP outline TDS10 ("Deletion does not delete external"), which already assumed this. Also, `business-data-map.md` §4.4 models `bugs.status` as a state machine (open/in_progress/resolved/closed/reopened) with no delete transition — Bugs are not hard-deleted in this system, so the question is close to moot; if a future admin hard-delete is added, it still must not cascade externally.

***3. "External tracker******:****** Confirm Jira Cloud?"***
Decision: ***Confirmed — Jira Cloud.*** Already named, not a new choice: `business-data-map.md` §6 documents the full Jira REST push/pull integration (`integrations.kind=jira`), and `master-implementation-plan.md` names "a Jira Cloud sandbox tenant for development." GitHub Issues / Linear sync are explicitly deferred to Phase 3 (`master-implementation-plan.md` lines 573/710) and are not this story. Per the authority boundary in this delegation, if the target had NOT already been named anywhere in project context, this specific sub-question would have been flagged to Ely instead of decided — it did not need to be, because it already was.

***4. "Field mapping******:****** severity→priority, module→component, evidence→attachment?"***
Decision: ***severity → Jira ****`priority`****. Module → embedded as full path text in the Jira issue body (NOT a Jira ****`component`****). Evidence/attachments → NOT synced in this story.*** Reasoning: Jira `components` must be pre-provisioned per target project and auto-creating them adds a fragile external dependency the 1 SP scope doesn't budget for; embedding the module's full path in the issue description (next to the required Bunkai backlink, per `business-data-map.md`'s "backlinks Jira issue body") gives engineers the same context without that coupling. Evidence attachments are excluded from sync scope — no DoD bullet requires it, and it narrows the sync's data-exposure surface rather than widening it (a conservative call, not one that needs escalation).

### Open Questions for Dev

***5. "Integration mechanism******:****** DB event trigger, pg******_******cron poller, or event bus webhook?"***
Decision: ***Neither a DB trigger nor pg*************cron — a fire-and-forget async call from the same API route right after the ****`bugs`**** INSERT commits, backed by the already-named ****`jira-bug-sync-retry`**** Vercel Cron sweep (every 5 min) for anything that didn't land synchronously.*** This matches the existing "Async Workers / Incoming Webhooks" pattern in `business-data-map.md` §5 (same shape as `run-timeout-sweeper` / `idempotency-cleanup`) and the project's MVP infra note that "MVP uses Vercel Cron with serverless functions" — there is no pg*cron or dedicated event-bus infra in this stack to reach for instead. This also satisfies the DoD's "filing never waits on or fails because of the sync" requirement directly: the initial attempt is async/non-blocking, and the cron is the safety net.

***6. "Retry policy******:****** max retries, backoff formula, permanent failure threshold"***
Decision: ***5 attempts, exponential backoff (5 min → 15 min → 45 min → 2 h → 6 h, i.e. roughly ×3 per step, capped), then flip to a terminal ****`failed`**** state with a manual "Retry" action in the UI*** — matching the mockup's sync-failed state (badge + failure-reason card) and QA's TDS08 ("permanent auth failure stops retries"). Auth failures (see Q9) skip the backoff ladder and go terminal immediately rather than burning retries against credentials that won't change on their own.

***7. "Deduplication key******:****** external******_******id field, content hash, or idempotency key?"***
Decision: `bugs.external*id` (nullable until first successful sync) as the dedup signal — reuses the same field `business-data-map.md` already documents for the inbound-import direction's dedup, applied symmetrically here: never create a second Jira issue for a bug whose `external*id` is already set. Additionally wrap the actual Jira-create call using the project's existing `idempotency_keys` mechanism (ADR-0002) to close the race window between two overlapping cron sweeps. No new dedup concept introduced — both mechanisms already exist in this codebase.

***8. "Rate limiting******:****** Expected external API limits, 429 backoff strategy"***
Decision: ***429 responses fold into the same retry/backoff path as Q6*** — respect `Retry-After` when Jira sends it, otherwise fall back to the standard backoff step. At the realistic volume for a QA team's manual defect filing (not bulk import), no dedicated rate-limiter/queue-throttle is warranted at this scope; revisit only if usage data shows otherwise.

***9. "Auth refresh******:****** How does admin update expired credentials?"***
Decision: ***No new credential UX is built in BK-43.*** Credential storage already goes through `secrets_ref` on the shared `integrations` row (`business-data-map.md` §6), the same row the BK-009 Jira import direction uses — BK-43 reuses it, it does not invent a new one. On a sync auth failure (401/403), mark the bug's sync state terminal-failed immediately (no retry burn — see Q6) with an "authentication failed" reason in the mockup's failure-reason card; once the admin re-saves the integration config (existing/future Settings flow, out of this story's scope), the next `bugs` INSERT or cron sweep naturally uses the refreshed credentials. Building a dedicated credential-rotation screen is not this story's job.

---

### Technical note for Stage 1 (binding, not a new decision)

If the sync worker's write-back to `bugs.external*id` / `external*url` / `jira*sync*status` is implemented as a `SECURITY DEFINER` RPC taking a caller-supplied identity or workspace-scope parameter, it is subject to `ADR-0012`'s actor-bind + result-scoping invariant (`.claude/skills/sprint-development/references/rpc-authorization.md`). Since this worker runs server-side (cron/service-role, not a user-invoked call), the `auth.uid() IS NULL` branch of the actor-bind guard applies — but ***result scoping still applies***: the sweep must only touch bugs whose `integrations` row (and thus `secrets_ref`) belongs to the same workspace as the bug being synced. Answer the six-question checklist in Stage 1 Technical Decisions before writing the migration, per the ADR's binding enforcement point.

---

***Refinement status******:****** READY***

---


_Synced from Jira by sync-jira-issues_
