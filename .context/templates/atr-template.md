# ATR — Acceptance Test Report

> **US**: <<USER_STORY_ID>> — <<USER_STORY_TITLE>>
> **Test Run**: <<TEST_RUN_ID>>
> **Tester**: <<TESTER>>
> **Date**: <<DATE>>
> **Environment**: <<ENVIRONMENT>>

---

## 1. Summary

| Metric | Value |
|--------|-------|
| Total TC | {{total}} |
| Passed | {{passed}} |
| Failed | {{failed}} |
| Blocked | {{blocked}} |
| Skipped | {{skipped}} |
| Pass Rate | {{pass_rate}}% |
| Bugs Filed | {{bug_count}} |

## 2. Results by Priority

| Priority | Total | Pass | Fail | Blocked | Skipped |
|----------|-------|------|------|---------|---------|
| P0 | | | | | |
| P1 | | | | | |
| P2 | | | | | |

## 3. Failed Tests

| TC | Issue | Root Cause | Bug ID | Status |
|----|-------|------------|--------|--------|
| TC-1 | {{failure description}} | {{root cause}} | BK-{{n}} | Open |

## 4. Bugs Filed

| Bug ID | Summary | Severity | Status | Related TC |
|--------|---------|----------|--------|------------|
| BK-{{n}} | {{summary}} | S1/S2/S3/S4 | Open | TC-1 |

## 5. Verdict

- [ ] **PASS** — All P0/P1 pass, no S1/S2 bugs
- [ ] **CONDITIONAL PASS** — <3 P0 fail with workaround, S2 bugs accepted
- [ ] **FAIL** — Any P0 blocked, S1 bug, unrecoverable regression

## 6. Notes

{{additional observations, environment issues, flaky tests}}
