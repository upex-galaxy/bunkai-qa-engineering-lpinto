# Comments for BK-87

[View in Jira](https://jira.upexgalaxy.com/browse/BK-87)

---

### pinto.lucas.nahuel - 8/6/2026, 19:23:06

1. 

****Quality Score****: Needs Improvement
****Risk Score****: 10/20 (HIGH)
****Mode****: Pre-sprint refinement (Shift-Left)

1. 

- ****Ambiguities****: 4 — Settings section vs single page, identity fields, workspace list columns, entry point location
- ****Gaps****: 5 — zero ACs, no chrome location, RLS rules unstated, [https://jira.upexgalaxy.com/browse/BK-86#icft=BK-86](https://jira.upexgalaxy.com/browse/BK-86#icft=BK-86) sign-out boundary, error/empty states
- ****Edge cases****: 8 identified (no workspace, session expiry, direct URL, network failure, 10+ workspaces, null metadata, suspended user, RLS denial)
- ****ACs refined****: 7 (AC1-AC7)
- ****Test outlines drafted****: 9 (3 positive, 3 negative, 2 boundary, 1 integration)

1. 

1. 

—

***Refined by Shift-Left QA — 2026-06-08***

---

### pinto.lucas.nahuel - 8/6/2026, 21:36:36

***PO answers — 2026-06-08***

Both critical questions resolved:

1. ***Settings entry point*** → Topbar user menu (avatar/initials) with dropdown containing "Settings" and "Sign out". Also accessible via direct URL /settings.

1. ***BK-86/BK-87 boundary*** → Sign-out is exclusive to [https://jira.upexgalaxy.com/browse/BK-86#icft=BK-86](https://jira.upexgalaxy.com/browse/BK-86#icft=BK-86). [https://jira.upexgalaxy.com/browse/BK-87#icft=BK-87](https://jira.upexgalaxy.com/browse/BK-87#icft=BK-87) delivers only identity display + workspace list in the Account section within Settings.

[https://jira.upexgalaxy.com/browse/BK-87#icft=BK-87](https://jira.upexgalaxy.com/browse/BK-87#icft=BK-87) is now unblocked and ready for Estimation.

---

### Ely - 30/7/2026, 13:15:06

Mockup — Settings hub · Account section (/settings/account). Source: .context/designs/bunkai-test-management-tool/bk-85-account-settings/settings-account.html · spec: master-design-plan §4.10



---

### Ely - 30/7/2026, 13:28:48

Mockup — Settings — coming-soon pattern for future sections. Source: .context/designs/bunkai-test-management-tool/bk-85-account-settings/settings-coming-soon.html · spec: master-design-plan §4.10



---

### Automation for Jira - 30/7/2026, 18:02:50

🔎 Pull Request created. Task is pending to ANALYZE and REVIEW by the team. Waiting for PR Approval.

---

### Automation for Jira - 30/7/2026, 18:14:33

✅ Pull Request is successfully MERGED. Task is Done.

---

### Ely - 30/7/2026, 19:12:30

## Ready for QA — Settings hub + Account view deployed to staging

Both slices merged to `staging`:

- PR1 (shell, nav, auth guard, identity): [https://github.com/upex-galaxy/upex-bunkai-tms/pull/63](https://github.com/upex-galaxy/upex-bunkai-tms/pull/63) — branch `feat/BK-87-settings-hub-shell`
- PR2 (workspace membership list): [https://github.com/upex-galaxy/upex-bunkai-tms/pull/64](https://github.com/upex-galaxy/upex-bunkai-tms/pull/64) — branch `feat/BK-87-settings-workspace-list`

***Covers***: TC-AC1 through TC-AC7 (identity display, workspace list with role + active indicator, navigation from the account menu + direct URL, unauthenticated redirect, session expiry, empty-state CTA, retriable error on workspace-list failure).

***Out of scope for this story*** (per `out-of-scope.md`, unchanged): Tokens ([https://jira.upexgalaxy.com/browse/BK-88#icft=BK-88](https://jira.upexgalaxy.com/browse/BK-88#icft=BK-88)) and Workspaces management ([https://jira.upexgalaxy.com/browse/BK-89#icft=BK-89](https://jira.upexgalaxy.com/browse/BK-89#icft=BK-89)/90) render as honest "coming soon" placeholders in the nav; sign-out stays exclusive to [https://jira.upexgalaxy.com/browse/BK-86#icft=BK-86](https://jira.upexgalaxy.com/browse/BK-86#icft=BK-86).

***Fixed during review***: a workspace member-count bug (undercounted to 1 for non-owner/admin members due to an RLS-scoped query) — caught by adversarial review before merge, not shipped. Full adjudication in the repo at `.context/PBI/epics/EPIC-BK-85-account-settings/stories/STORY-BK-87-settings-open-a-settings-hub-and-view-my-account/review.md`.

\Former user over to you for QA verification on staging.

---


_Synced from Jira by sync-jira-issues_
