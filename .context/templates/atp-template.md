# ATP — Acceptance Test Plan

> **US**: <<USER_STORY_ID>> — <<USER_STORY_TITLE>>
> **Module**: <<MODULE_NAME>>
> **Test Strategy**: <<TEST_STRATEGY>> <!-- e.g., UI + API, API-only, Manual -->
> **Environment**: <<ENVIRONMENT>>

---

## 1. Scope

### In Scope
- {{FEATURE 1}}
- {{FEATURE 2}}

### Out of Scope
- {{FEATURE 3}}

## 2. Test Conditions

| # | Condition | Priority | Source |
|---|-----------|----------|--------|
| TC-1 | {{description}} | P0 | AC-1 |
| TC-2 | {{description}} | P1 | AC-2 |

## 3. Test Cases

### TC-1: <<TITLE>>

**Priority**: P0 | **Layer**: API/UI/Unit | **Type**: Happy/Edge/Error

**Preconditions**:
- {{PRECONDITION 1}}

**Steps**:
1. {{step 1}}
2. {{step 2}}

**Expected**:
- {{expected result}}

**Test Data**:
```json
{{test data}}
```

## 4. Environment & Data

| Item | Value |
|------|-------|
| Base URL | `<<URL>>` |
| Auth | {{auth method}} |
| Test User | {{email}} |
| Seed Data | {{seed description}} |

## 5. Risks & Assumptions

| Risk | Mitigation |
|------|-----------|
| {{risk 1}} | {{mitigation 1}} |
