# BK-229 — Shift-Left Refinement

**Story:** Billing | View my workspace plan, seats, and usage
**Date:** 2026-08-13
**Risk:** MEDIUM (read-only, no money movement, but access control + meter accuracy are critical)

---

## 1. Critical Analysis

### AC Coverage Gaps (Original → Refined)

| # | Original Gap | Technique | Severity | Decision |
|---|--------------|-----------|----------|----------|
| G1 | AC4 tests "member not owner/admin" but business rules say admins CAN view | Decision Table | HIGH | **Admin CAN view billing.** Added owner + admin positive scenarios. |
| G2 | AC2 tests warning at 9/10 but no test for 10/10 (limit-reached) | State-Transition | HIGH | **Added reached limit (10/10) and exceeded limit (11/10).** |
| G3 | AC1 shows "8 of 10 seats" but no test for 10/10 or 11/10 (over-limit) | BVA | HIGH | **Added exceeded seat limit scenario.** |
| G4 | AC5 says "pending invitations don't consume seat" but no test for suspended members | Boundary | MEDIUM | **Added suspended members scenario.** |
| G5 | AC1 expects "per-seat price" but Free plan has no price | State-Transition | MEDIUM | **Added Enterprise plan scenario with "Custom" price.** |
| G6 | AC3 says "no renewal date" for Free but doesn't test what IS shown | Edge Case | LOW | **Added "No active subscription" text.** |
| G7 | No AC for workspace with 0 active members | Boundary | LOW | **Added zero active members scenario.** |
| G8 | No AC for workspace with Enterprise plan | State-Transition | MEDIUM | **Added Enterprise plan scenario.** |
| G9 | No AC for loading/error state when billing API fails | Edge Case | MEDIUM | **Added API failure scenario.** |
| G10 | No AC for auto-refresh of meters | Edge Case | LOW | **Decision: Fetch on mount only. No auto-refresh.** |

### PO/Dev Decisions Applied

1. **Admin access**: Admins CAN view billing (role IN ('owner', 'admin'))
2. **Over-limit seats**: Show "11 of 10" in limit-reached state, no block
3. **Free plan limits**: 3 projects, 5 seats, 30-day retention
4. **Seat counting**: Only `status = 'active'`. Pending and suspended don't count
5. **Auto-refresh**: No. Fetch on open only
6. **Visual tokens**: Existing design system (default <80%, warning 80-99%, destructive 100%+)

---

## 2. Refined Acceptance Criteria (14 Scenarios)

```gherkin
Scenario: Workspace owner views the billing overview of a paid workspace
  Given Mateo is the owner of the workspace "Acme QA" on the Team plan
  And the workspace has 8 active members out of a 10-seat limit
  When Mateo opens the Billing section in Settings
  Then he sees the plan name "Team", the per-seat price, and the next renewal date
  And he sees the seat meter "8 of 10 seats"
  And he sees a usage meter for each plan-limited resource, including projects and run history retention
```

```gherkin
Scenario: Workspace owner views the billing overview of an Enterprise workspace
  Given Mateo is the owner of the workspace "Acme QA" on the Enterprise plan
  And the workspace has 15 active members out of a 50-seat limit
  When Mateo opens the Billing section in Settings
  Then he sees the plan name "Enterprise", the per-seat price "Custom", and the next renewal date
  And he sees the seat meter "15 of 50 seats"
  And he sees a usage meter for each plan-limited resource, including projects and run history retention
```

```gherkin
Scenario: Usage meter signals an approaching limit
  Given the workspace "Acme QA" has created 9 projects out of a 10-project limit
  When Mateo opens the Billing section in Settings
  Then the projects meter shows "9 of 10" in a warning state
```

```gherkin
Scenario: Usage meter signals a reached limit
  Given the workspace "Acme QA" has created 10 projects out of a 10-project limit
  When Mateo opens the Billing section in Settings
  Then the projects meter shows "10 of 10" in a limit-reached state
```

```gherkin
Scenario: Usage meter signals an exceeded limit
  Given the workspace "Acme QA" has created 11 projects out of a 10-project limit
  When Mateo opens the Billing section in Settings
  Then the projects meter shows "11 of 10" in a limit-reached state
```

```gherkin
Scenario: Free workspace shows limits and an upgrade entry instead of renewal data
  Given the workspace "Acme QA" is on the Free plan
  And the Free plan has a limit of 3 projects and 5 seats
  When Mateo opens the Billing section in Settings
  Then he sees the plan name "Free" with its limits
  And he sees the text "No active subscription" instead of a renewal date
  And he sees a usage meter for projects showing current usage against the 3-project limit
  And he sees an option to upgrade to a paid plan
```

```gherkin
Scenario: A workspace owner can open the billing view
  Given Mateo is the owner of the workspace "Acme QA"
  When he opens the Settings hub
  Then the Billing section is shown to him
```

```gherkin
Scenario: A workspace admin can open the billing view
  Given Carlos is an admin of the workspace "Acme QA"
  When he opens the Settings hub
  Then the Billing section is shown to him
```

```gherkin
Scenario: A workspace member cannot open the billing view
  Given Elena is a member (not owner or admin) of the workspace "Acme QA"
  When she opens the Settings hub
  Then the Billing section is not offered to her
```

```gherkin
Scenario: Seat meter counts active members only
  Given the workspace "Acme QA" has 8 active members and 2 pending invitations
  When Mateo opens the Billing section in Settings
  Then the seat meter shows "8 of 10 seats"
  And the pending invitations do not consume a seat
```

```gherkin
Scenario: Suspended members do not count toward the seat meter
  Given the workspace "Acme QA" has 7 active members, 1 suspended member, and 2 pending invitations
  When Mateo opens the Billing section in Settings
  Then the seat meter shows "7 of 10 seats"
```

```gherkin
Scenario: Seat meter shows zero when no active members exist
  Given the workspace "Acme QA" has 0 active members
  When Mateo opens the Billing section in Settings
  Then the seat meter shows "0 of 10 seats"
```

```gherkin
Scenario: Seat meter shows exceeded limit when active members surpass plan limit
  Given the workspace "Acme QA" has 11 active members out of a 10-seat limit
  When Mateo opens the Billing section in Settings
  Then the seat meter shows "11 of 10 seats" in a limit-reached state
```

```gherkin
Scenario: Billing view handles API failure gracefully
  Given Mateo is the owner of the workspace "Acme QA"
  And the billing API is unavailable
  When Mateo opens the Billing section in Settings
  Then he sees an error message "Unable to load billing info"
  And he sees a retry button
```

```gherkin
Scenario: Billing view handles API timeout gracefully
  Given Mateo is the owner of the workspace "Acme QA"
  And the billing API takes longer than 10 seconds to respond
  When Mateo opens the Billing section in Settings
  Then he sees a loading state
  And after timeout he sees an error message "Unable to load billing info"
  And he sees a retry button
```

```gherkin
Scenario: Usage meter signals warning state at exactly 80% boundary
  Given the workspace "Acme QA" has created 8 projects out of a 10-project limit
  When Mateo opens the Billing section in Settings
  Then the projects meter shows "8 of 10" in a warning state
```

```gherkin
Scenario: Run history retention meter shows correct limit for paid plan
  Given the workspace "Acme QA" is on the Team plan with 90-day run history retention
  When Mateo opens the Billing section in Settings
  Then the run history meter shows current usage against 90-day limit
```

```gherkin
Scenario: Free workspace shows run history retention limit
  Given the workspace "Acme QA" is on the Free plan
  When Mateo opens the Billing section in Settings
  Then the run history meter shows current usage against 30-day limit
```

---

## 3. ATP DRAFT (Outline Names)

| # | Outline | Type | Coverage |
|---|---------|------|----------|
| 1 | should show plan name, price, and renewal date for Team workspace | Positive | AC1 |
| 2 | should show plan name, Custom price, and renewal date for Enterprise workspace | Positive | AC2 |
| 3 | should show warning state when meter is at 80-99% | Boundary | AC3 |
| 4 | should show warning state when meter is at exactly 80% | Boundary | AC15 |
| 5 | should show limit-reached state when meter is at 100% | Boundary | AC4 |
| 6 | should show limit-reached state when meter exceeds 100% | Boundary | AC5 |
| 7 | should show Free plan limits, "No active subscription", and upgrade entry | Positive | AC6 |
| 8 | should show run history retention meter for paid plan | Positive | AC16 |
| 9 | should show run history retention meter for Free plan | Positive | AC17 |
| 10 | should show billing to owner | Positive | AC7 |
| 11 | should show billing to admin | Positive | AC8 |
| 12 | should hide billing from member | Negative | AC9 |
| 13 | should not count pending invitations in seat meter | Boundary | AC10 |
| 14 | should not count suspended members in seat meter | Boundary | AC11 |
| 15 | should show "0 of N seats" when no active members | Boundary | AC12 |
| 16 | should show limit-reached state when exceeding seat limit | Boundary | AC13 |
| 17 | should handle billing API failure gracefully | Negative | AC14 |
| 18 | should handle billing API timeout gracefully | Negative | AC18 |

**Coverage: 7 Positive / 3 Negative / 8 Boundary = 18 outlines**

---

## 4. Edge Cases

| # | Edge Case | Criticality | Status |
|---|-----------|--------------------------|--------|
| E1 | Workspace with 0 active members | LOW | Cubierto (AC12) |
| E2 | Meter at exactly 80% (boundary warning) | MEDIUM | **Cubierto (AC15)** |
| E3 | Meter at exactly 100% (boundary limit-reached) | MEDIUM | Cubierto (AC4) |
| E4 | Enterprise plan with -1 limits (display as "Unlimited") | MEDIUM | Pendiente |
| E5 | Billing API timeout (not error, just slow) | LOW | **Cubierto (AC18)** |
| E6 | User with multiple roles (owner + admin) | LOW | Pendiente |

---

_Decision sources: PO senior + Dev senior review on 2026-08-13_
