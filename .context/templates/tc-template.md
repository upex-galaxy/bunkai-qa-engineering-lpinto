# TC — Test Case

> **ID**: TC-{{number}}
> **Title**: <<TITLE>>
> **Priority**: P0/P1/P2 | **Layer**: UI/API/Unit | **Type**: Happy/Edge/Error/Security/Performance
> **Source**: FR-BK-XXX | AC-{{number}} | US-{{id}}
> **Automation**: Automated/Manual/Deferred

---

## Preconditions

- {{PRECONDITION 1}}

## Test Data

```json
{{test data payload}}
```

## Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | {{action 1}} | {{expected 1}} |
| 2 | {{action 2}} | {{expected 2}} |

## Postconditions

- {{data clean-up, state verification}}

## Edge Cases

| Variant | Expected |
|---------|----------|
| {{empty value}} | {{error or default}} |
| {{boundary value}} | {{behavior at limit}} |
| {{invalid input}} | {{validation error}} |

## Verification Hooks

- **API**: `{{API call to verify}}`
- **DB**: `{{DB query to verify}}`
- **UI**: `{{visual assertion}}`
