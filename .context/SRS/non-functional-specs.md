# Non-Functional Specs — Bunkai (QA Lens)

> Authoritative source: `../upex-bunkai-tms/.context/SRS/non-functional-specs.md`
> Purpose: NFR verification strategy, tooling, and pass/fail criteria.

---

## Performance

| NFR | Target | Verification Method | Tool |
|-----|--------|-------------------|------|
| LCP | <2.0s p75 | Lighthouse CI on staging URL | Playwright + Lighthouse |
| TTI | <3.0s p75 | Web Vitals via Playwright | Playwright `webVital` fixture |
| API single-entity read | <200ms p95 | Timed GET requests (100 iterations) | KATA Api + `performance.now()` |
| API listing | <500ms p95 | Timed GET with realistic dataset (50+ entities) | KATA Api |
| Tree view | <800ms p95 at 500 modules/5K ATCs | Load test dataset via API, measure tree render | Playwright + API seed |
| Realtime latency | <1.5s p95 | Measure time from POST to WebSocket event received | Playwright multi-tab |
| Concurrent users | 50 (MVP) | k6 virtual users executing voyages | k6 (or Postman collection runner) |
| Bulk import | <30s for 500 issues | POST imports/jira, poll until complete, measure | KATA Api |
| JS bundle | ≤300KB gzipped | `bun run analyze` or Lighthouse | CI pipeline step |
| CSS bundle | ≤60KB gzipped | Lighthouse or manual check | CI pipeline step |

### Performance Test Scenarios

| Scenario | Dataset | Threshold |
|----------|---------|-----------|
| Tree view with large module hierarchy | 500 modules, 5000 ATCs, 1000 tests | LCP <2s, tree render <800ms |
| Run listing with many results | 5000 runs across 100 tests | List API <500ms p95 |
| Search with partial match | 1000 ATCs named "Login *" | Search API <500ms p95 |
| Concurrent run execution | 10 agents starting runs simultaneously | All start within 2s, no 429 |

---

## Security

| Requirement | Verification | Method |
|-------------|-------------|--------|
| RLS per row (workspace isolation) | Create data as Member in Workspace A, verify not visible from Workspace B | KATA Api (two PATs, two workspaces) |
| RBAC at workspace level | Repeat every entity CRUD per role (viewer/member/admin/owner) | KATA Api (4 auth contexts) |
| PAT: SHA-256 hashed, constant-time compare | Verify token prefix, cannot retrieve full token after creation | KATA Api |
| TLS 1.3 + HSTS | SSL Labs test or `curl -vI` | CI pipeline |
| Zod validation (client + server) | Submit malformed payloads to every endpoint | KATA Api (fuzz-like) |
| CSP headers | Check response headers for CSP | Playwright (response assertion) |
| Rate limiting: 100 writes/min, 600 reads/min | Burst requests, verify 429 at correct threshold | KATA Api |
| Idempotency key binding | Same key + same payload → 200; same key + diff payload → 409 | KATA Api |

### Auth Attack Vectors

| Attack | Expected Behavior | Test |
|--------|------------------|------|
| Use PAT from workspace A against workspace B | 403 Forbidden | Cross-workspace API call |
| Reuse expired PAT | 401 Unauthorized | Wait for expiry, attempt request |
| Modify PAT prefix | 401 Unauthorized | Send `bk_pat_invalid...` |
| Direct DB write bypassing API | Blocked by RLS | Attempt `supabase.from(...).insert()` with PAT |
| XSS in US/AC description field | Sanitized output, CSP blocks inline scripts | Submit `<script>alert(1)</script>` in markdown |

---

## Reliability

| NFR | Target | Verification |
|-----|--------|-------------|
| Uptime | 99.5% | Not testable in automation (ops metric) |
| 5xx rate | <1% | API test suite: verify no 5xx on valid requests |
| MTTR | <30 min | Not testable (ops metric) |
| Backups | Daily, 7-day retention | Not testable (ops metric) |
| Migrations | Forward-only | Verify migration rolls forward cleanly on clean DB |
| Idempotency TTL | 24h | Same key after TTL → new resource created |

---

## Scalability

| Concern | MVP Approach | When to Escalate | Test |
|---------|-------------|-----------------|------|
| `run_steps` | Single table | Partition by month if >20M rows | Verify query plan with 1M rows |
| Connection pooling | Supavisor | — | Verify connection limit not breached |
| HTTP caching | `stale-while-revalidate=300` | — | Verify cache headers on GET responses |
| Search performance | tsvector index | Meilisearch if p95 >500ms | Verify tsvector query plan with 10K ATCs |
| Evidence storage | Cloudflare R2 | — | Upload/download performance test |

---

## Accessibility (WCAG 2.1 AA)

| Requirement | Verification | Tool |
|-------------|-------------|------|
| Color contrast | All text passes 4.5:1 (normal) / 3:1 (large) | axe-core / Lighthouse |
| Keyboard navigation | Tab through every interactive element, verify focus visible | Playwright keyboard |
| ARIA labels | All controls have non-empty aria-label or aria-labelledby | axe-core |
| Focus indicators | Visible focus ring on all interactive elements | Playwright CSS assertion |
| Skip-to-content link | First focusable element on page | Playwright keyboard (Tab) |
| Reduced motion | `prefers-reduced-motion: reduce` → no animations | Playwright CSS assertion |

---

## Browser / Device Support

| Requirement | Target | Test |
|-------------|--------|------|
| Desktop browsers | Latest 2 versions Chrome/Firefox/Safari/Edge | Run smoke suite on 4 browsers via Playwright projects |
| Mobile browsers | Read-only OK for MVP | Responsive layout test (viewport 375×812) on read-only flows |

---

## Maintainability

| NFR | Target | Verification |
|-----|--------|-------------|
| Code coverage | ≥70% lines, ≥65% branches | `bun run test:coverage` |
| Linting | ESLint + Prettier + Husky | `bun run lint` passes |
| TypeScript | Strict mode | `bun run typecheck` passes |
| Monitoring | Sentry + PostHog + Supabase logs + Vercel Analytics | Integration smoke test (not automated assertion) |

---

## Compliance

| Requirement | Status | Test |
|-------------|--------|------|
| SOC 2 (designed-toward) | Not certified for MVP | N/A |
| GDPR (data deletion, export) | Designed-toward | Verify account deletion cascades, data export endpoint |
| Self-hosted (Phase 2) | Not in scope | N/A |

## Cross-References

- `functional-specs.md` — FR-to-test mapping (P0/P1/P2)
- `architecture-specs.md` — system layer that each NFR targets
- Target `non-functional-specs.md` — full NFR detail (quantified targets)
