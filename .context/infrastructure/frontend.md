# Frontend Infrastructure — Bunkai (QA Lens)

> Source: Target repo source code analysis (app/, components/)
> Purpose: Frontend architecture for test context — routing, components, styling, state

---

## Stack Overview

| Layer | Technology | Test Approach |
|-------|-----------|---------------|
| Framework | Next.js 15 App Router | Visual + functional E2E |
| UI Library | React 19, shadcn/ui (New York, neutral) | Component tests |
| Styling | Tailwind CSS, CSS custom properties (dark only) | Visual regression |
| Icons | lucide-react | Smoke (icons render) |
| Tables | @tanstack/react-table | Sort/filter/bulk-edit |
| Editor | @monaco-editor/react | Step/assertion editing |
| Toasts | sonner | Success/error notifications |
| Auth Context | React Context (auth-context.tsx) | Login/logout flows |
| State | Server Components + local useState | Data fetching via RSC |
| Fonts | Inter, JetBrains Mono, Noto Serif JP | Visual |

## Route Structure

```
/                          → redirect to /login
/login                     → Magic link form (auth layout)
/auth/callback             → Supabase OTP exchange
/onboarding                → Workspace creation (app layout)
/projects/[projectSlug]    → Project dashboard + ATC table
/projects/[projectSlug]/atcs/[atcId] → ATC editor
```

### Route Group Architecture

| Group | Layout | Auth Required | Shell |
|-------|--------|---------------|-------|
| `(auth)` | AuthProvider | No | Minimal (brand side panel) |
| `(app)` | AuthProvider | Yes (middleware redirect) | Sidebar + Topbar |

### Frontend Test Map

| Route | Key Components | Testable Actions |
|-------|---------------|-----------------|
| `/login` | MagicLinkForm | Submit email, loading state, success toast, invalid email |
| `/onboarding` | OnboardingForm | Create workspace, slug validation, error states |
| `/projects/[slug]` | Sidebar, Topbar, AtcTable, CommandPalette | Tree nav, table sort, cmd+K |
| `/projects/[slug]/atcs/[id]` | AtcEditor, StepEditor, AnchoringPanel | Save ATC, add steps, anchor AC |

## Key Components

### UI Primitives (`components/ui/`)

| Component | CVA Variants | Test |
|-----------|-------------|------|
| `button.tsx` | default/primary/ghost/danger × sm/default/lg/icon | All variants render, disabled state, click handler |
| `card.tsx` | Card/Header/Title/Description/Content/Footer | Structure renders |
| `input.tsx` | Standard input | Value changes, placeholder, error styling, disabled |
| `label.tsx` | Uppercase label | Text renders, associated input |

### Layout Components (`components/layout/`)

| Component | Client? | Behavior to Test |
|-----------|---------|------------------|
| `Sidebar.tsx` | Yes | Recursive tree expand/collapse, module nav, status dots |
| `Topbar.tsx` | Yes | Breadcrumb navigation, slot rendering |
| `WorkspaceSwitcher.tsx` | Yes (stub) | Workspace/project display |
| `Wordmark.tsx` | No | Rendering at different sizes |
| `CommandPalette.tsx` | Yes (stub) | Cmd+K open/close, search results |

### ATC Components (`components/atcs/`)

| Component | Client? | Behavior to Test |
|-----------|---------|------------------|
| `AtcTable.tsx` | Yes | Column sort, row click, bulk actions, empty state |
| `AtcEditor.tsx` | Yes | Title input, layer selector, step/assertion editing, anchoring, save action |
| `StepEditor.tsx` | Yes | Monaco editor mount, markdown/yaml editing |
| `AnchoringPanel.tsx` | Yes | US search, AC selection, multi-select |

### Providers

| Provider | What It Manages | Test |
|----------|----------------|------|
| `auth-context.tsx` | User session, loading, signIn, signOut | Login success, login failure, session restore, signOut |

## Styling Architecture

### Design Tokens (CSS Variables in `globals.css`)

| Token Group | Purpose | Test |
|-------------|---------|------|
| `--surface-{0..5}` | Background layers | Visual contrast check |
| `--fg-{0..4}` | Foreground text tiers | Color contrast (axe-core) |
| `--stroke-{1,2,3,strong}` | Border strokes | Border visibility |
| `--accent*` | Vermillion accent | Accent color applied correctly |
| `--signal-{pass,fail,blocked,skipped,running}` | Status signals | Status indicators correct color |
| `--layer-{ui,api,unit}` | ATC layer | Layer chip color matches type |

### Utility Classes (`@layer components`)

| Class | Purpose | Test |
|-------|---------|------|
| `.dot` | Status indicator dots | Color + size |
| `.kbd` | Keyboard shortcut hint | Visual style |
| `.layer-chip` | UI/API/Unit badge | Correct color per type |
| `.status-chip` | Pass/fail/blocked/skipped/running badge | Correct color per status |

### Responsive Breakpoints

MVP is desktop-only. Mobile: read-only OK. Test at 1440px+.

## State Management

| Concern | Mechanism | Test Implication |
|---------|-----------|------------------|
| Auth state | React Context (`auth-context.tsx`) | Wrapping tests in AuthProvider |
| ATC table data | Server Component (RSC) + TanStack Table | Table sort/filter is client-side |
| ATC editor | Local useState | Form state survives re-renders |
| Module tree | Server Component (recursive query) | Tree data loaded before hydration |
| UI state (expanded folders) | Local useState | State persists within session |

## Accessibility Baseline

| Requirement | Implementation | Test |
|-------------|---------------|------|
| Color contrast | Custom tokens designed for dark theme | axe-core color-contrast check |
| Keyboard navigation | Native HTML elements + ARIA | Tab through all interactive elements |
| ARIA labels | shadcn/ui base components | axe-core ARIA checks |
| Focus indicators | Tailwind `focus-visible:ring` | Visible focus ring on Tab navigation |
| Reduced motion | `prefers-reduced-motion` in globals.css | Animation disabled when preferred |
| Dark mode only | `darkMode: 'class'` on `<html>` | No light mode (design decision) |

## Cross-References

- `backend.md` — how UI connects to API/Database
- `infrastructure.md` — build/deploy pipeline for frontend
- `architecture-specs.md` — C4 system context
- `non-functional-specs.md` — accessibility, performance NFRs
- `user-personas.md` — keyboard navigation (Elena), mobile read-only
