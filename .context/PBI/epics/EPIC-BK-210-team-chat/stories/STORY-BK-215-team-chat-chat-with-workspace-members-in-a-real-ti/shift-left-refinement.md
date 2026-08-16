# Shift-Left Refinement: BK-215 — Team Chat | Chat with workspace members in a real-time channel

***Status***: Refined - Awaiting PO Estimation
***Mode***: Shift-Left (pre-sprint)
***Refined on***: 2026-08-15
***Refined by***: QA - Shift-Left batch session
***Modality***: Jira-native draft

---

## Phase 1 — Critical Analysis

### Business context

- ***Primary persona affected***: Elena Vargas, Senior QA Engineer.
- ***Secondary personas***: QA engineers, workspace members who need real-time operational conversation.
- ***Business value proposition***: Operational questions like "is staging down?" get answered where the QA work lives instead of scattering into external tools like Slack.
- ***KPI(s) influenced***: Time-to-answer for operational questions, context retention (conversation stays attached to workspace entities), reduced tool-switching friction.
- ***User journey position***: Foundation story of the Team Chat epic. Every subsequent story (per-project channels, mentions, rich links, edit/delete, search) builds on the channel and message primitives introduced here.

### Technical context

- ***Frontend***: Right-side collapsible panel in the App Shell (consistent with tabbed-explorer patterns from BK-147). Channel header + scrollable message list (newest at bottom) + composer pinned to bottom. Presence dots on member avatars. Unread separator line.
- ***Backend***: No confirmed chat API endpoints exist in the baseline. New DB tables required: `channels`, `messages`, `channel_members`. Supabase Realtime configured in migration 0043 for broadcast (not chat-specific).
- ***Database***: New tables needed — no schema exists yet. Workspace membership model (BK-1) is the upstream dependency for channel access.
- ***External services***: Supabase Auth/Postgres/RLS are relevant because channel visibility depends on workspace membership. Supabase Realtime (broadcast) is configured but not wired for chat.
- ***Integration points specific to this Story***: Workspace membership (BK-1) for access control; App Shell (BK-147) for panel integration; Supabase Realtime for message delivery.

### Evidence-confirmed facts

- Supabase Realtime is configured in migration 0043 for broadcast channels.
- Chat features are explicitly marked as post-MVP in business-model.md — new DB tables (channels, messages, channel_members) are not yet in migrations.
- Workspace membership model (BK-1) exists and provides the RBAC ladder (viewer, member, admin, owner).
- The App Shell with tabbed explorer patterns (BK-147) exists and can host a right-side panel.
- No confirmed chat API endpoints, message delivery pipeline, or Realtime chat subscription exists in the baseline.
- No confirmed presence tracking system exists in the baseline.

### Proposals / pending decisions

- ***Proposal***: MVP should use Supabase Realtime broadcast for message delivery, with PostgreSQL as the durable store.
- ***Pending decision***: Whether to use Supabase Realtime broadcast or Presence for online status tracking.
- ***Pending decision***: Message delivery confirmation semantics (delivered vs read vs seen).
- ***Pending decision***: How to handle message ordering guarantees when multiple users send simultaneously.
- ***Pending decision***: Whether the general channel is a special case of a channels table or a separate concept.
- ***Pending decision***: Pagination strategy for message history (cursor-based vs offset-based).
- ***Pending decision***: Whether presence dots reflect real-time online status or last-seen timestamp.

### Story complexity

| ***Axis*** | ***Rating*** | ***Why*** |
| --- | --- | --- |
| Business logic | Medium | Clear user value but new domain (chat) with undefined API contracts and DB schema. |
| Integration | High | Depends on workspace membership, App Shell, Supabase Realtime, and new DB tables — all need to be wired together. |
| Data validation | Medium | Message length bounds (1-4000 chars), empty/whitespace rejection, ordering guarantees, and history retention. |
| UI | Medium | Panel layout is designed (BRIEF.md exists), but interaction states (typing, presence, unread, reconnect) need definition. |

***Estimated test effort***: High for refinement because the acceptance criteria are clear but the underlying infrastructure (DB schema, API endpoints, Realtime wiring) does not exist yet. Feasibility risk is high.

### Epic-level inheritance

- ***Risks restated at Story level***: Chat is a new domain for this codebase — no existing chat infrastructure, no message delivery pipeline, no presence system. All must be built from scratch.
- ***Integration points inherited***: Workspace membership (BK-1) → channel access; App Shell (BK-147) → panel hosting; Supabase Realtime → message delivery.
- ***PO/Dev answers already given at epic level***: Chat is post-MVP in business-model.md; new DB tables are expected.
- ***Test strategy inherited***: Treat workspace membership as upstream dependency; do not final-design message delivery assertions until API contract and Realtime subscription are confirmed.

---

## Critical Findings

| ***#*** | ***Finding*** | ***Impact*** | ***Action*** |
| --- | --- | --- | --- |
| 1 | No DB schema exists for channels, messages, or channel_members | Blocks all data-layer testing | Confirm schema design before sprint estimation |
| 2 | No chat API endpoints exist in the baseline | Blocks API contract testing | Confirm endpoint paths, auth, response shapes |
| 3 | Supabase Realtime is configured for broadcast, not chat | May need different Realtime subscription pattern | Confirm Realtime usage for chat vs broadcast |
| 4 | Presence tracking system does not exist | Roster online/offline status is untestable | Confirm presence implementation approach |
| 5 | Message ordering under concurrent sends is undefined | Ordering assertions are unstable | Confirm ordering guarantees (server timestamp vs client) |
| 6 | Pagination strategy for history is not defined | Scroll-up-to-load behavior is untestable | Confirm cursor format and page size |

---

## Phase 2 — Story Quality Analysis

### Ambiguities

| ***#*** | ***Location in Story*** | ***Question for PO/Dev*** | ***Impact on testing*** | ***Suggested clarification*** |
| --- | --- | --- | --- | --- |
| 1 | AC1 "without refreshing the page" | Does this mean WebSocket/Server-Sent Events, or polling? | Cannot decide whether to test automatic updates vs manual refresh | Confirm delivery mechanism (Supabase Realtime broadcast) |
| 2 | AC2 "oldest messages load as she scrolls up" | Is this infinite scroll, pagination, or lazy loading? What is the page size? | Cannot test pagination boundaries | Confirm pagination strategy and page size |
| 3 | AC3 "currently online" | Is online status real-time via Supabase Presence, or last-seen timestamp? | Cannot test presence accuracy | Confirm presence implementation |
| 4 | AC4 "composer is disabled with a hint" | What exact copy does the hint show? Where is it positioned? | Cannot assert exact UI text | Define hint copy and placement |
| 5 | AC5 "connection drops for 2 minutes" | How is connection drop simulated in testing? What is the reconnection window? | Cannot design reconnection test | Define reconnection semantics and timeout |
| 6 | AC5 "Elena does not need to refresh" | Does the client automatically reconnect and fetch missed messages? | Cannot test catch-up behavior | Confirm auto-reconnect and catch-up mechanism |
| 7 | Business Rules "Messages display in the order they were sent" | Is this server-assigned timestamp, client timestamp, or sequence number? | Ordering assertions depend on this | Confirm ordering mechanism |
| 8 | Business Rules "history is retained for the life of the Workspace" | Is there a maximum message count or storage limit? | Cannot test large-history scenarios | Confirm retention policy details |
| 9 | Mockup "send on Enter, newline on Shift+Enter" | Is this confirmed behavior or design intent? | Cannot test keyboard shortcuts | Confirm keyboard interaction model |

### Gaps (missing info)

| ***#*** | ***Type*** | ***Why critical*** | ***What to add*** | ***Risk if omitted*** |
| --- | --- | --- | --- | --- |
| 1 | DB schema | No tables exist for channels, messages, channel_members | Schema design with columns, types, constraints, indexes | Implementation and QA invent different data models |
| 2 | API contract | No chat endpoints exist | Endpoint paths, methods, auth, request/response shapes | Implementation and QA invent different contracts |
| 3 | Realtime subscription | Supabase Realtime is configured for broadcast, not chat | Confirm Realtime channel naming, event types, payload shape | Message delivery may not work as expected |
| 4 | Presence system | No online/offline tracking exists | Presence implementation approach (Supabase Presence vs custom) | Roster online status is untestable |
| 5 | Message ordering | Ordering guarantee is not defined | Confirm server timestamp vs sequence number vs client timestamp | Ordering assertions become subjective |
| 6 | Pagination | Scroll-up behavior is not defined | Cursor format, page size, loading states | History loading cannot be tested |
| 7 | Error states | No error handling is defined | Network error, auth failure, message send failure, Realtime disconnect | User may see broken UI on failure |
| 8 | Loading states | No loading indicators are defined | Message loading, history loading, send-in-progress | UX may feel broken during loads |
| 9 | Empty state copy | "friendly prompt" is vague | Exact copy for empty channel | Cannot assert exact UI text |

### Edge cases not in Story

| ***#*** | ***Scenario*** | ***Expected behavior (best guess)*** | ***Criticality*** | ***Action*** |
| --- | --- | --- | --- | --- |
| 1 | Two users send messages at the exact same millisecond | Messages appear in deterministic order (server timestamp tie-breaker) | High | NEEDS PO/DEV CONFIRMATION — define ordering guarantee |
| 2 | User sends message while disconnected | Message is queued and sent on reconnect, or user is notified of failure | High | NEEDS PO/DEV CONFIRMATION — define offline behavior |
| 3 | User has 10,000+ messages in history | History loads progressively without performance degradation | Medium | NEEDS PO/DEV CONFIRMATION — define pagination and performance limits |
| 4 | User opens channel with 0 messages | Empty state with friendly prompt appears | Medium | NEEDS PO/DEV CONFIRMATION — define empty state copy |
| 5 | User is the only member in the workspace | Channel shows 1 member, no other online indicators | Low | NEEDS PO/DEV CONFIRMATION — single-member behavior |
| 6 | User's role changes from member to viewer while channel is open | Composer becomes disabled in real-time without page refresh | High | NEEDS PO/DEV CONFIRMATION — role change behavior |
| 7 | Workspace is deleted while user has channel open | Channel becomes inaccessible, user is redirected or shown error | Medium | NEEDS PO/DEV CONFIRMATION — deletion behavior |
| 8 | User opens same channel in two browser tabs | Messages appear in both tabs without duplication | Medium | NEEDS PO/DEV CONFIRMATION — multi-tab behavior |
| 9 | Message exceeds 4000 characters | Send button disabled or error shown before sending | Medium | NEEDS PO/DEV CONFIRMATION — client-side vs server-side validation |
| 10 | User pastes message with only whitespace | Message is rejected with clear error | Medium | NEEDS PO/DEV CONFIRMATION — whitespace handling |

### Contradictions

- Story says "real-time channel" but business-model.md marks chat as post-MVP with no DB tables. The story assumes infrastructure that does not exist yet.
- Mockup says "send on Enter, newline on Shift+Enter" but this is not confirmed in the ACs or business rules.
- Business Rules say "history is retained for the life of the Workspace" but no storage limits or purge policy are defined.

### Testability validation

***Verdict***: Partial

Issues blocking full testability:

- No DB schema exists for channels, messages, or channel_members.
- No chat API endpoints exist in the baseline.
- Supabase Realtime is configured for broadcast, not chat — the subscription pattern is undefined.
- Presence tracking system does not exist.
- Message ordering guarantee is not defined.
- Pagination strategy and page size are not defined.
- Error and loading states are not defined.
- Empty state copy is not defined.

---

## Phase 3 — Refined Acceptance Criteria

### Original AC1 — Real-time message delivery

#### Scenario 1.1: Should deliver a message to all channel members in real time without page refresh (Type: Positive, Priority: Critical)

- ***Given***: Elena and Sara are both members of the workspace "Bunkai QA" and have the workspace general channel open.
- ***When***: Elena sends the message "Is staging down? My run just stalled".
- ***Then***: Sara sees the message appear in the channel within 2 seconds without refreshing the page. The message shows Elena's name and the time it was sent.
- ***Evidence basis***: Supabase Realtime is configured in migration 0043; no chat-specific subscription exists yet.

#### Scenario 1.2: Should display sender name and timestamp on each message (Type: Positive, Priority: High)

- ***Given***: A message has been sent by Elena in the general channel.
- ***When***: The message renders in the channel.
- ***Then***: The message displays Elena's display name and the send time in a consistent format.
- ***Evidence basis***: Mockup confirms layout; timestamp format is undefined.

#### Scenario 1.3: Should not deliver messages to users who are not channel members (Type: Negative, Priority: Critical)

- ***NEEDS PO/DEV CONFIRMATION***: Security scenario inferred from workspace membership model.
- ***Given***: A user belongs to a different workspace and is not a member of "Bunkai QA".
- ***When***: A message is sent in the "Bunkai QA" general channel.
- ***Then***: The non-member does not receive or see the message.
- ***Evidence basis***: Workspace membership (BK-1) provides RBAC; channel access mirrors workspace membership.

#### Scenario 1.4: Should reject empty or whitespace-only messages (Type: Negative, Priority: High)

- ***Given***: Elena has the general channel open.
- ***When***: Elena attempts to send a message that is empty or contains only whitespace.
- ***Then***: The message is not sent and a clear error message is shown.
- ***Evidence basis***: Business Rules state "1 to 4000 characters after trimming; empty or whitespace-only messages are rejected."

#### Scenario 1.5: Should reject messages exceeding 4000 characters (Type: Boundary, Priority: High)

- ***NEEDS PO/DEV CONFIRMATION***: Whether validation is client-side, server-side, or both.
- ***Given***: Elena has the general channel open.
- ***When***: Elena types a message of 4001 characters.
- ***Then***: The send button is disabled or an error is shown before/after attempting to send.
- ***Evidence basis***: Business Rules state "1 to 4000 characters after trimming."

#### Scenario 1.6: Should accept messages at exactly 1 character (Type: Boundary, Priority: Medium)

- ***Given***: Elena has the general channel open.
- ***When***: Elena sends a single character message (e.g., "OK").
- ***Then***: The message is sent and appears in the channel.

#### Scenario 1.7: Should accept messages at exactly 4000 characters (Type: Boundary, Priority: Medium)

- ***Given***: Elena has the general channel open.
- ***When***: Elena sends a message of exactly 4000 characters.
- ***Then***: The message is sent and appears in the channel.

### Original AC2 — Message history persistence

#### Scenario 2.1: Should display message history in chronological order across sessions (Type: Positive, Priority: Critical)

- ***Given***: The "Bunkai QA" general channel contains 20 messages.
- ***When***: Elena signs out, signs back in, and opens the channel.
- ***Then***: She sees the same 20 messages in chronological order (oldest at top, newest at bottom).

#### Scenario 2.2: Should load older messages on scroll-up (Type: Positive, Priority: High)

- ***NEEDS PO/DEV CONFIRMATION***: Pagination strategy and page size are not defined.
- ***Given***: The general channel contains more messages than fit on one screen.
- ***When***: Elena scrolls up to the top of the visible messages.
- ***Then***: Older messages load progressively without losing her scroll position.
- ***Evidence basis***: Mockup says "oldest messages load as she scrolls up"; pagination details are undefined.

#### Scenario 2.3: Should maintain message ordering under concurrent sends (Type: Edge, Priority: High)

- ***NEEDS PO/DEV CONFIRMATION***: Ordering guarantee is not defined.
- ***Given***: Elena and Sara both send messages at nearly the same time.
- ***When***: Both messages appear in the channel.
- ***Then***: Messages appear in a deterministic order consistent across all members' views.
- ***Evidence basis***: Business Rules say "messages display in the order they were sent"; mechanism is undefined.

### Original AC3 — Workspace roster

#### Scenario 3.1: Should display all workspace members with their roles (Type: Positive, Priority: High)

- ***Given***: The workspace "Bunkai QA" has 3 members: Elena, Sara, and Mateo.
- ***When***: Elena opens the channel roster.
- ***Then***: She sees all 3 members listed with their workspace role (e.g., "Admin", "Member", "Viewer").

#### Scenario 3.2: Should show online/offline presence for each member (Type: Positive, Priority: Medium)

- ***NEEDS PO/DEV CONFIRMATION***: Presence implementation is not defined.
- ***Given***: Elena opens the channel roster.
- ***When***: She views the member list.
- ***Then***: Each member shows a presence indicator (e.g., green dot for online, gray for offline).
- ***Evidence basis***: Business Rules mention "presence dots on member avatars"; implementation is undefined.

### Original AC4 — Viewer read-only access

#### Scenario 4.1: Should allow viewers to read full message history (Type: Positive, Priority: High)

- ***Given***: Mateo's account in "Bunkai QA" has the viewer role.
- ***When***: Mateo opens the workspace general channel.
- ***Then***: He can read the full message history without restrictions.

#### Scenario 4.2: Should disable the composer for viewers with a read-only hint (Type: Positive, Priority: High)

- ***NEEDS PO/DEV CONFIRMATION***: Exact hint copy is not defined.
- ***Given***: Mateo has the viewer role and opens the general channel.
- ***When***: He looks at the composer area.
- ***Then***: The composer is disabled and shows a hint indicating viewers have read-only access.
- ***Evidence basis***: Mockup says "disabled composer with read-only hint for viewers"; exact copy is undefined.

#### Scenario 4.3: Should prevent viewers from sending messages via API (Type: Negative, Priority: Critical)

- ***NEEDS PO/DEV CONFIRMATION***: Server-side enforcement is not confirmed.
- ***Given***: Mateo has the viewer role.
- ***When***: Mateo attempts to send a message (e.g., via API manipulation).
- ***Then***: The server rejects the request with an appropriate error (e.g., 403 Forbidden).
- ***Evidence basis***: Business Rules state "viewers are read-only"; server-side enforcement is not confirmed.

### Original AC5 — Reconnection catch-up

#### Scenario 5.1: Should show missed messages after connection drop without page refresh (Type: Positive, Priority: High)

- ***NEEDS PO/DEV CONFIRMATION***: Reconnection mechanism and catch-up window are not defined.
- ***Given***: Elena has the channel open and her connection drops for 2 minutes. Sara sends 3 messages during that gap.
- ***When***: Elena's connection comes back.
- ***Then***: The 3 missed messages appear in the channel in the right order without Elena needing to refresh the page.
- ***Evidence basis***: AC5 specifies behavior; reconnection mechanism is undefined.

#### Scenario 5.2: Should handle extended disconnection gracefully (Type: Edge, Priority: Medium)

- ***NEEDS PO/DEV CONFIRMATION***: Maximum disconnection window before requiring manual refresh is not defined.
- ***Given***: Elena's connection drops for 30 minutes.
- ***When***: Her connection comes back.
- ***Then***: She sees all missed messages or is prompted to refresh if the gap exceeds the catch-up window.

### New scenarios surfaced from Phase 2 edge cases — NEEDS PO/DEV CONFIRMATION

#### Scenario E1: Should queue messages sent while disconnected (Type: Edge, Priority: High)

- ***NEEDS PO/DEV CONFIRMATION***: Offline behavior is not defined.
- ***Given***: Elena loses connection while composing a message.
- ***When***: She finishes typing and hits send while still disconnected.
- ***Then***: The message is either queued for delivery on reconnect or the user is notified of failure.

#### Scenario E2: Should reflect role changes in real-time (Type: Edge, Priority: High)

- ***NEEDS PO/DEV CONFIRMATION***: Role change propagation is not defined.
- ***Given***: Elena is a member with the channel open.
- ***When***: An admin changes Elena's role to viewer.
- ***Then***: The composer becomes disabled without requiring a page refresh.

#### Scenario E3: Should handle message validation client-side and server-side (Type: Edge, Priority: Medium)

- ***NEEDS PO/DEV CONFIRMATION***: Whether validation is client-side only, server-side only, or both.
- ***Given***: Elena types a message that exceeds 4000 characters.
- ***When***: She attempts to send.
- ***Then***: Validation prevents the send at the appropriate layer with a clear error.

#### Scenario E4: Should meet delivery latency SLA under concurrent load (Type: NFR - Performance, Priority: High)

- ***NEEDS PO/DEV CONFIRMATION***: Delivery latency SLA under load is not defined.
- ***Given***: 10 members have the general channel open and send messages simultaneously.
- ***When***: All messages are delivered to all members.
- ***Then***: Message delivery latency stays within the agreed SLA (scenario 1.1: under 2 seconds).

#### Scenario E5: Should load large message histories within a defined time (Type: NFR - Performance, Priority: Medium)

- ***NEEDS PO/DEV CONFIRMATION***: History load time budget is not defined.
- ***Given***: The general channel contains 10,000+ messages.
- ***When***: A member opens the channel.
- ***Then***: The history loads within a defined time budget (e.g., under 3 seconds).

#### Scenario E6: Should support keyboard-only navigation (Type: NFR - Accessibility, Priority: High)

- ***NEEDS PO/DEV CONFIRMATION***: WCAG 2.1 AA accessibility target is not confirmed.
- ***Given***: A user navigates the channel panel with keyboard only.
- ***When***: They interact with the message list, composer, and roster.
- ***Then***: All interactions are keyboard-accessible with visible focus (send on Enter, newline on Shift+Enter).

#### Scenario E7: Should announce new messages to screen readers (Type: NFR - Accessibility, Priority: Medium)

- ***NEEDS PO/DEV CONFIRMATION***: Screen reader / live region behavior is not defined.
- ***Given***: A screen reader user has the channel open.
- ***When***: A new message arrives or presence changes.
- ***Then***: New messages are announced via a live region and presence indicators are not color-only.

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate

| ***Type*** | ***Count*** | ***Notes*** |
| --- | --- | --- |
| Positive | 7 | Core message delivery, history, roster, viewer access, reconnection |
| Negative | 4 | Cross-workspace isolation, viewer send prevention, empty message rejection, concurrent ordering |
| Boundary | 5 | Message length 0/1/4000/4001, history pagination, disconnection window |
| Integration | 4 | Workspace membership, App Shell panel, Supabase Realtime, DB persistence |
| Security-RBAC | 3 | Viewer read-only, cross-workspace isolation, server-side role enforcement |
| State-Transition | 3 | Connected/disconnected, member/viewer role change, empty/non-empty channel |
| Non-Functional | 4 | Performance (delivery latency, history load time) + Accessibility (keyboard, screen reader) |
| ***Total*** | ***30*** | High count driven by new domain, missing infrastructure, and RBAC risk |

***Rationale***: BK-215 is the foundation story for a new domain (chat) with no existing infrastructure. The ACs are clear but the underlying DB schema, API endpoints, Realtime wiring, and presence system do not exist. This drives high integration and security-RBAC outline counts.

### Outline list (NAMES ONLY — preconditions in 1 line, expected in 1 line)

#### Positive

- ***Should deliver a new message to all channel members in real time*** — Pre: two members have the channel open. Expected: new message appears for both without refresh.
- ***Should display sender name and timestamp on each message*** — Pre: a message exists in the channel. Expected: message shows sender display name and formatted timestamp.
- ***Should load full message history when user opens the channel*** — Pre: channel has 20+ messages. Expected: all messages visible in chronological order.
- ***Should load older messages when user scrolls up*** — Pre: channel has more messages than fit on screen. Expected: older messages load progressively on scroll-up.
- ***Should display all workspace members with roles in the roster*** — Pre: workspace has 3 members with different roles. Expected: roster shows all members with role badges.
- ***Should allow viewers to read full message history*** — Pre: viewer opens the channel. Expected: full history is readable.
- ***Should show missed messages after reconnection*** — Pre: connection drops while messages arrive. Expected: missed messages appear in correct order on reconnect.

#### Negative

- ***Should not deliver messages to non-members of the workspace*** — Pre: user belongs to a different workspace. Expected: foreign messages do not appear.
- ***Should prevent viewers from sending messages*** — Pre: viewer attempts to send. Expected: send is rejected at server level.
- ***Should reject empty or whitespace-only messages*** — Pre: user types only spaces. Expected: message is not sent, error is shown.
- ***Should not show messages from other workspaces*** — Pre: user has access to multiple workspaces. Expected: channel shows only current workspace messages.

#### Boundary

- ***Should accept message at exactly 1 character*** — Pre: user types a single character. Expected: message is sent successfully.
- ***Should accept message at exactly 4000 characters*** — Pre: user types 4000 characters. Expected: message is sent successfully.
- ***Should reject message at 4001 characters*** — Pre: user types 4001 characters. Expected: message is rejected with error.
- ***Should handle message with leading/trailing whitespace correctly*** — Pre: user types " Hello ". Expected: message is trimmed and sent as "Hello".
- ***Should handle disconnection window boundary*** — Pre: connection drops for exactly the catch-up window. Expected: messages load or refresh is prompted.

#### Integration

- ***Should enforce channel access through workspace membership*** — Pre: user is/is not a workspace member. Expected: channel access granted/denied based on membership.
- ***Should render the chat panel within the App Shell*** — Pre: user opens the panel. Expected: panel appears as right-side dock consistent with BK-147 patterns.
- ***Should persist messages to the database*** — Pre: message is sent. Expected: message is stored in the messages table with correct foreign keys.
- ***Should subscribe to Supabase Realtime for message delivery*** — Pre: channel is open. Expected: Realtime subscription is active and receives new messages.

#### Security-RBAC

- ***Should enforce viewer read-only access at the API level*** — Pre: viewer sends message via API. Expected: 403 Forbidden returned.
- ***Should隔离 workspace channels from each other*** — Pre: user accesses channels from different workspaces. Expected: no cross-workspace message leakage.
- ***Should enforce role-based access on channel operations*** — Pre: user with different roles attempts operations. Expected: operations permitted/denied per RBAC rules.

#### State-Transition

- ***Should handle connected-to-disconnected state transition*** — Pre: user is connected then loses connection. Expected: UI reflects disconnection state, reconnects automatically.
- ***Should handle member-to-viewer role transition*** — Pre: member's role changes to viewer. Expected: composer becomes disabled in real-time.
- ***Should handle empty-to-populated channel transition*** — Pre: channel has 0 messages, then a message is sent. Expected: empty state disappears, message appears.

#### Non-Functional (4) — NFR outlines — NEEDS PO/DEV CONFIRMATION

- ***Should deliver messages within the latency SLA under concurrent load*** — Pre: 10 members send simultaneously. Expected: all messages delivered within the agreed SLA (2 seconds).
- ***Should load large message history within a defined time*** — Pre: channel has 10,000+ messages. Expected: history loads within the agreed time budget (e.g., 3 seconds).
- ***Should support keyboard-only navigation of the channel panel*** — Pre: user navigates with keyboard only. Expected: all interactions keyboard-accessible with visible focus (WCAG 2.1 AA).
- ***Should announce new messages to screen readers*** — Pre: screen reader user has channel open. Expected: new messages announced via live region; presence not color-only (WCAG 2.1 AA).

---

## Phase 5 — Edge Cases (DRAFT)

| ***#*** | ***Edge case*** | ***In original Story?*** | ***Criticality*** | ***Action*** |
| --- | --- | --- | --- | --- |
| 1 | Two users send messages at the exact same millisecond | No | High | NEEDS PO/DEV CONFIRMATION — define ordering tie-breaker |
| 2 | User sends message while disconnected | No | High | NEEDS PO/DEV CONFIRMATION — define offline queue behavior |
| 3 | User's role changes from member to viewer while channel is open | No | High | NEEDS PO/DEV CONFIRMATION — define real-time role propagation |
| 4 | User opens same channel in two browser tabs | No | Medium | NEEDS PO/DEV CONFIRMATION — define multi-tab behavior |
| 5 | Message contains only whitespace | No | Medium | NEEDS PO/DEV CONFIRMATION — confirm trimming and rejection |
| 6 | User pastes message with Unicode/emoji | No | Medium | NEEDS PO/DEV CONFIRMATION — confirm character counting |
| 7 | Workspace is deleted while user has channel open | No | Medium | NEEDS PO/DEV CONFIRMATION — define deletion handling |
| 8 | User has 10,000+ messages in history | No | Medium | NEEDS PO/DEV CONFIRMATION — define pagination and performance |
| 9 | User opens channel with 0 messages | No | Medium | NEEDS PO/DEV CONFIRMATION — define empty state copy |
| 10 | Connection drops during message send | No | High | NEEDS PO/DEV CONFIRMATION — define send failure handling |

---

## Story Quality Assessment

***Verdict***: Significant Issues

***Key findings***:

- The story has clear user value and well-defined ACs, but the underlying infrastructure (DB schema, API endpoints, Realtime wiring, presence system) does not exist yet.
- The acceptance criteria are testable in isolation, but the integration points are undefined — this creates high feasibility risk.
- Several critical details are missing: message ordering guarantee, pagination strategy, error states, loading states, and empty state copy.

---

## Critical Questions for PO

> These BLOCK sprint planning until answered. — **STATUS: RESOLVED**

1. **Should the general channel be a special case of a channels table or a separate concept?**
   - **Context**: The story assumes a general channel exists per workspace, but no DB schema exists. The channels table design affects all subsequent chat stories.
   - **Decision**: Treat it as a row in a unified `channels` table with a `type: 'general'` and `is_default: true` flag, scoped to `workspace_id`. This allows future project and topic channels to reuse the same table and RLS policies.
   - **Impact**: Dev can estimate a single model; QA designs data-layer tests around a unified table.

2. **What is the message ordering guarantee when multiple users send simultaneously?**
   - **Context**: Business Rules say "messages display in the order they were sent" but the mechanism (server timestamp, sequence number, or client timestamp) is not defined.
   - **Decision**: Use server-assigned timestamps (`created_at` with microsecond precision via `clock_timestamp()`); tie-break by message `id ASC` for true simultaneity.
   - **Impact**: QA can write deterministic ordering assertions.

3. **What is the pagination strategy for message history (cursor-based vs offset-based) and what is the page size?**
   - **Context**: AC2 says "oldest messages load as she scrolls up" but the mechanism is undefined.
   - **Decision**: Keyset cursor-based pagination using the last loaded message ID and timestamp, with a page size of **50 messages**.
   - **Impact**: QA tests pagination boundaries on `GET /messages?limit=50&before=<cursor>`.

4. **Is the message validation client-side only, server-side only, or both?**
   - **Context**: AC5 mentions message length bounds but does not specify where validation occurs.
   - **Decision**: Both — client-side for UX (trimmed length 1-4000 characters; disable send button when empty or exceeding 4000), server-side for security (PostgreSQL check constraint + API schema validation returning `422`).
   - **Impact**: QA tests client-side button state and API 422 responses.

5. **What is the maximum disconnection window before requiring a manual refresh?**
   - **Context**: AC5 mentions "connection drops for 2 minutes" but no maximum window is defined.
   - **Decision**: **5 minutes**. Drops < 5 min auto-reconcile missed messages via Realtime re-subscription and an incremental gap-fetch. Drops > 5 min trigger a subtle "reconnecting…" banner with silent background history resync — **no modal prompt**; the UI self-heals silently.
   - **Impact**: QA tests the reconnection catch-up boundary at <5 min (auto-heal) vs >5 min (background resync).

6. **How should the empty channel state be worded?**
   - **Context**: Business Rules mention "a friendly prompt inviting the first message" but no exact copy is defined.
   - **Decision**: Headline: *"Welcome to #general!"*, Body: *"No messages yet — start the conversation."* Interactive **Quick Prompt Chips** for Members/Admins only: `👋 Say hello to the team` / `🚀 Share an update`. **Viewers** see read-only variant: *"Messages from your team will appear here."* (no chips).
   - **Impact**: QA asserts exact text on initial workspace setup; Viewer state verified separately.

7. **Should presence dots reflect real-time online status via Supabase Presence or a last-seen timestamp?**
   - **Context**: AC3 mentions "currently online" but the implementation is undefined.
   - **Decision**: Use **Supabase Presence** (WebSocket heartbeats) for real-time online/offline indicators, backed by a `last_seen_at` DB timestamp.
   - **Impact**: QA verifies indicator transitions on connect (<2s) and disconnect (<10s).

8. **What happens when a user's role changes from member to viewer while the channel is open?**
   - **Context**: This is an edge case not covered by the ACs but affects the viewer read-only scenario.
   - **Decision**: Real-time propagation via Supabase Realtime broadcast. The composer input disables instantly with read-only copy, a toast notifications is shown, and any pending write API request is rejected with `403` by RLS.
   - **Impact**: QA tests real-time session transition and API RBAC.

9. **Should messages be queued for delivery when the user is disconnected, or should the user be notified of failure?**
   - **Context**: This edge case is not covered by the ACs but affects the reconnection scenario.
   - **Decision**: Optimistic rendering in the message feed at 50% opacity. If sending fails or times out (>10s), display a red error indicator with retry/delete options.
   - **Impact**: QA tests UI state machine transitions (`sending` -> `sent` / `failed`).

---

## Technical Questions for Dev

> These do not block PO but block implementation. — **STATUS: RESOLVED**

1. **What DB schema will be used for channels, messages, and channel_members?**
   - **Architectural Solution**: Three tables with production-grade constraints.
     - **`channels`**: `id`, `workspace_id` (FK), `name`, `slug` (unique per workspace), `type` CHECK (`'general'|'project'|'topic'`), `is_default` (partial unique index `WHERE is_default`), `is_archived`, timestamps.
     - **`channel_members`**: composite PK (`channel_id`, `user_id`), `joined_at`, `last_read_at`.
     - **`messages`**: `content` CHECK (`char_length(trim(content)) BETWEEN 1 AND 4000`), `metadata jsonb`, `created_at` (`clock_timestamp()`), `updated_at` (nullable = never edited), `deleted_at` (soft delete).
     - **Índice cubierto**: `idx_messages_channel_pagination` on `(channel_id, created_at DESC, id DESC) WHERE deleted_at IS NULL`.
     - **Trigger**: `bunkai_set_updated_at()` reutilizado en `channels` y `messages`.

2. **What API endpoints will power the chat (message send, history load, roster, presence)?**
   - **Architectural Solution**: Channel-scoped REST endpoints under `/api/v1/workspaces/{workspaceId}/channels/{channelId}/...`.
     - `POST /messages` — Body: `{ content, client_nonce }` (idempotency). Returns `201` + `MessageSchema` + `client_nonce`.
     - `GET /messages?limit=50&cursor=<base64>` — Returns `200` + `{ messages: MessageSchema[], next_cursor }`.
     - `GET /roster` — Returns `200` + `{ members: RosterMemberSchema[] }` con `presence` + `role`.
     - Patrones Bunkai: `withApiHandler({ auth: 'required' })`, `assertWorkspaceContext()`, idempotencia vía `client_nonce`, envelope `{ data, meta }`.

3. **How will Supabase Realtime be wired for chat message delivery?**
   - **Architectural Solution**: Dual-channel approach.
     - **Durable messages**: `postgres_changes` listener on `messages` table for `INSERT` filtered by `channel_id=eq.<channelId>`.
     - **Ephemeral events**: Broadcast channel `chat:ws_<workspaceId>:ch_<channelId>` for `typing:start/stop`, optimistic messages, presence.
     - **⚠️ CRÍTICO — Seguridad Realtime**: El cliente **DEBE** llamar `supabase.realtime.setAuth(userAccessToken)` antes de suscribirse. Sin esto, `postgres_changes` **ignora RLS** y expone mensajes de otros workspaces. La autenticación Realtime es obligatoria para que RLS se aplique a los eventos `postgres_changes`.

4. **How will presence tracking be implemented?**
   - **Architectural Solution**: **Supabase Realtime Presence** con estados granulares.
     - Estados: `online` (activo <30s), `away` (inactivo >30s), `offline` (desconectado).
     - Multi-tab: `presenceState()` retorna array por `user_id`; merge = `online` si CUALQUIER tab está online.
     - Metadatos: `channel_id` en payload para filtrar roster por canal activo.
     - Fallback DB: `channel_members.last_seen_at` actualizado en `join`/`leave` + cron nocturno.
     - TTL auto-limpieza: Supabase Presence limpia en desconexión; fallback cron nocturno para sesiones huérfanas.

5. **What is the message ordering mechanism?**
   - **Architectural Solution**: Strictly server-assigned `created_at` timestamp with microsecond precision (`timestamptz(6)` generated via `clock_timestamp()`). Tie-breaker on simultaneous inserts is message `id ASC`.

6. **What cursor format and page size will be used for history pagination?**
   - **Architectural Solution**: Cursor opaco Base64 URL con validación cross-workspace.
     - Payload: `{ w: "workspace_id", c: "channel_id", t: "created_at_ISO", i: "message_uuid" }` codificado en Base64 URL-safe.
     - Validación servidor: **rechazar cursor si `w !== workspaceId` o `c !== channelId`** (defensa cross-workspace).
     - Query keyset: `WHERE (m.created_at < cursor.t OR (m.created_at = cursor.t AND m.id < cursor.i))`.
     - Page size: **50 messages** (máx 100).

7. **How will RLS policies be implemented for channel access?**
   - **Architectural Solution**: Políticas explícitas en las 3 tablas usando funciones SECURITY DEFINER de Bunkai.
     - **`channels`**: `SELECT` si `bunkai_is_workspace_member(workspace_id)`; `INSERT/UPDATE` solo `admin/owner`.
     - **`channel_members`**: `SELECT` vía subquery a `channels` + `bunkai_is_workspace_member()`.
     - **`messages`**: `SELECT` con JOIN a `channel_members` + `channels` + `bunkai_is_workspace_member()`; `INSERT` con `WITH CHECK (sender_id = auth.uid() AND bunkai_can_write_workspace(workspace_id))` — **rechaza `viewer` a nivel BD**; `UPDATE` solo sender con mismo check.
     - **Fuente única de verdad**: `bunkai_can_write_workspace()` para toda escritura (rechaza `viewer`).

8. **What error codes and shapes will the API return for auth failures, validation errors, and server errors?**
   - **Architectural Solution**: Envelope estándar `{ "error": { "code", "message", "details" } }`.
     - Códigos base: `CHAT_UNAUTHORIZED` (401), `CHAT_FORBIDDEN_VIEWER_READONLY` (403), `CHAT_CHANNEL_NOT_FOUND` (404), `CHAT_MESSAGE_EMPTY`/`CHAT_MESSAGE_TOO_LONG` (422), `CHAT_RATE_LIMITED` (429).
     - **Nuevos códigos**: `CHAT_FORBIDDEN_NOT_CHANNEL_MEMBER` (403 — en workspace pero no en canal), `CHAT_INVALID_CURSOR` (400 — cursor malformado/cross-workspace), `CHAT_REALTIME_UNAVAILABLE` (503 — degradación graceful a polling), `CHAT_CONCURRENT_EDIT` (409 — futuro).

9. **Will there be a typing indicator or message delivery confirmation?**
   - **Architectural Solution**: Máquina de estados explícita + TTL auto-limpieza.
     - **Typing**: Broadcast `typing:start` (debounce 500ms) + `typing:stop`. **TTL 3s** auto-expira si no llega `stop` (receiver limpia espejo +500ms buffer).
     - **Delivery (optimista)**: Estados `sending` (50% opacity) → `sent` (201) / `failed` (>10s timeout → badge rojo + `[Retry] [Delete]`).
     - **Read receipts**: OUT OF SCOPE v1. Unread a nivel canal con `channel_members.last_read_at`. Per-message read → v2 (`message_reads` table + broadcast).

10. **What performance SLAs apply to message delivery and history loading?**
   - **Architectural Solution**: SLAs con P95/P99, condiciones de carga y metodología.
     - **Message delivery**: P95 < 200ms, P99 < 500ms (client→client via Realtime).
     - **Initial history load**: P95 < 500ms, P99 < 1000ms (frío, 1000 msgs).
     - **Pagination**: P95 < 200ms, P99 < 400ms (cursor válido, 50 msgs).
     - **Presence sync**: P95 < 1000ms, P99 < 2000ms (join → sync).
     - **Reconnection catch-up**: P95 < 1500ms, P99 < 3000ms (WS reconnect + gap-fetch).
     - **Índice**: `idx_messages_channel_pagination` fetch < 5ms (index-only scan).
     - **Condiciones**: 10 miembros concurrentes, 500 chars/msg, misma región Supabase.
     - **Medición**: k6/Artillery 10 users × 50 msg/min; timestamp `client_sent_at` en metadata para latencia real.

11. **Will the chat panel meet WCAG 2.1 AA accessibility (keyboard navigation, screen reader)?**
   - **Architectural Solution**: Implementación completa WCAG 2.1 AA.
     - **Anuncios SR**: `#sr-announcer` dedicado `role="status" aria-live="polite" aria-atomic="true"` — garantiza cada mensaje anunciado (evita pérdidas con `aria-live="polite"` en log rápido).
     - **Focus management**: Panel open → focus composer (Member) / primer mensaje (Viewer); `Escape` cierra panel y devuelve foco al trigger; roster flyout usa `FocusTrap` (Radix); click en separador "New messages" enfoca primer no leído.
     - **Presence no-color**: Dot + label `sr-only` ("Online"/"Away"/"Offline") — pasa WCAG 1.4.1.
     - **Reduced motion**: `@media (prefers-reduced-motion: reduce)` desactiva transiciones/animaciones.
     - **Atajos**: `Cmd/Ctrl+Shift+K` (toggle panel), `Escape` (cerrar), `Enter` (enviar), `Shift+Enter` (nueva línea).
     - **Log**: `role="log" aria-live="polite" aria-atomic="false" aria-relevant="additions text"` en feed.

---

## Design Questions

> From the BRIEF.md and mockup — design-specific gaps that affect testing. — **STATUS: RESOLVED**

1. **What exact copy does the viewer read-only hint show?**
   - **Design Specification**: **Banner inline focusable** (no tooltip en input deshabilitado).
     - Contenedor: `bg-muted/40 border border-muted rounded-lg p-3` — mantiene layout estable (sin shift).
     - Copy: *"You have read-only access to this channel"* + *"Only Members, Admins & Owners can post messages. [Contact Admin →]"*.
     - Icono: `Lock` 16px `aria-hidden="true"`.
     - Botones (Attach/Send): **VISIBLES pero `disabled`** (`opacity-40 cursor-not-allowed`) — evita layout shift.
     - Accesibilidad: Banner `tabIndex={0} role="status" aria-live="polite"` — anuncia en cambio de rol.

2. **How should the empty channel state be visually represented?**
   - **Design Specification**: Card centrado `max-w-md p-8 border-dashed border-border/50`.
     - Icono `Hash` 24px en `bg-primary/10 rounded-full` — contraste WCAG AA.
     - Título: *"Welcome to the general channel!"*, Cuerpo: *"No messages yet — start the conversation."*
     - **Quick Prompt Chips** (Members/Admins only): `👋 Say hello to the team` / `🚀 Share an update` — `focus-visible:outline-2`, click → popula composer + focus.
     - **Viewer state**: Chips ocultos; cuerpo: *"Messages from your team will appear here."*
     - Animación: `animate-fade-in-up` 300ms; chips stagger 50ms.

3. **How should the roster behave? Should it be a flyout overlay or a persistent sidebar?**
   - **Design Specification**: **Slide-in Flyout Panel** accesible (`w-full absolute inset-y-0 right-0 bg-background/95 backdrop-blur-md z-20`).
     - Trigger: `aria-expanded={isOpen} aria-controls="chat-roster" aria-label="Open workspace roster"`.
     - Focus trap (Radix `FocusTrap`): foco inicial en botón cerrar `[×]`; `Escape` cierra y devuelve foco al trigger.
     - Backdrop: `fixed inset-0 bg-black/20 z-40` — click cierra.
     - Animación: `translateX(100%) ↔ translateX(0)` 200ms; `prefers-reduced-motion: duration-0`.
     - Encabezados: `ONLINE — 3`, `OFFLINE — 1` (`text-xs font-semibold uppercase`).
     - Filas: `tabIndex={0} role="option"` — presencia no-color (`sr-only` label "Online, Admin").

4. **How should the unread separator line be styled and positioned?**
   - **Design Specification**: Divisor semántico persistente hasta acción del usuario.
     - Línea: `border-t-2 border-destructive` — token semántico (WCAG AA light/dark).
     - Badge: `NEW MESSAGES` en `bg-destructive text-destructive-foreground rounded-full px-3 py-1`.
     - Acción: Botón `[Mark read]` — `text-xs underline focus-visible:outline-2`.
     - Posición: Antes del primer mensaje no leído; auto-scroll suave `block: 'center'` al abrir.
     - **No expira automáticamente** — desaparece al: (a) scroll pasado, (b) click "Mark read", (c) nuevos mensajes la empujan.
     - Accesibilidad: `tabIndex={0} role="separator" aria-label="New messages separator, 2 unread"`.

5. **Should the panel remember its open/closed state across page navigations?**
   - **Design Specification**: Estado persistente versionado en `localStorage`.
     - Clave: `bunkai:chat:panel:v1` — schema: `{ isOpen, scrollTop, lastActiveChannelId, version }`.
     - Persiste: `isOpen`, `scrollTop` (posición scroll), `lastActiveChannelId` (restaura canal).
     - Atajo global: `Ctrl+Shift+K` / `Cmd+Shift+K` — `K` = Chat (evita conflicto con Copy/Command Palette).
     - Badge: `bg-destructive rounded-full animate-pulse` — `prefers-reduced-motion: animate-none`; `aria-label="3 unread messages"`.
     - Limpieza: `scrollTop` reseteado en cambio de canal; todo limpio en sign out.

6. **How should the panel behave on narrow viewports (<1440px)?**
   - **Design Specification**: Breakpoint-tiered con APIs nativas.
     | Breakpoint | Modo | Especs Críticas |
     |---|---|---|
     | **≥1440px** | Persistent docked | `w-[380px] flex-shrink-0 border-l` — sin backdrop |
     | **1024–1399px** | Overlay slide-sheet | `fixed inset-y-0 right-0 w-[380px] max-w-[90vw] z-50` + backdrop `fixed inset-0 bg-black/30 z-40` |
     | **768–1023px** | Bottom drawer → side sheet | Default: bottom `h-[60vh] max-h-[80vh] rounded-t-2xl`; landscape: side `w-[400px]` |
     | **<768px** | Full-screen modal | `fixed inset-0 z-50 flex flex-col` — **safe-area insets** (`env(safe-area-inset-top/bottom)`) |
     - **Mobile críticos**: `visualViewport` API para teclado virtual (`padding-bottom = keyboardHeight`); swipe horizontal >100px OR velocity >0.5px/ms → close; `body overflow: hidden` lock; focus composer `preventScroll: true`; header sticky con `← Back to Workspace` + `safe-area-inset-top`.

---

## Open Questions — Proposed Answers

| ***#*** | ***Question Category*** | ***Question / Area*** | ***Decision / Resolved Answer*** | ***Product / Tech Rationale*** |
| --- | --- | --- | --- | --- |
| 1 | **PO - Product** | General channel: special case or table row? | Row in `channels` table with `type: 'general'`, `is_default: true` | Reusable for project channels (BK-216); single RLS |
| 2 | **PO - Product** | Message ordering guarantee | Server `created_at` timestamp with microsecond precision + `id ASC` | Prevents client clock drift; deterministic ordering |
| 3 | **PO - Product** | Pagination strategy & page size | Keyset cursor-based pagination; page size = **50 messages** | $O(1)$ index lookup; stable history scroll |
| 4 | **PO - Product** | Validation layers | Both client-side (UX limits 1-4000 chars) and server-side (DB check constraint) | UX feedback + direct API security |
| 5 | **PO - Product** | Max disconnection window | **5 minutes** limit; <5m auto-reconciliation, >5m **silent background resync** (no prompt) | Seamless auto-healing; zero user friction |
| 6 | **PO - Product** | Empty state copy | Title: *"Welcome to #general!"*, Body: *"No messages yet — start the conversation."* Chips solo Members/Admins; Viewer: texto estático | Microcopy nítida; estado Viewer explícito sin chips |
| 7 | **PO - Product** | Presence implementation | **Supabase Presence** (WS heartbeats) for active; `last_seen_at` fallback | Real-time low latency; no DB write heartbeat overhead |
| 8 | **PO - Product** | Role demotion while open | Real-time composer disable + toast; RLS rejects pending writes (`403`) | Session security integrity without page reload |
| 9 | **PO - Product** | Offline message behavior | Optimistic render (50% opacity); retry and failure state after 10s | Clear user feedback; client persistence out-of-scope v1 |
| 10 | **Dev - Tech** | Database Schema | 3 tablas: `channels` (partial unique `is_default`, CHECK `type`), `channel_members`, `messages` (CHECK `trim(content) 1..4000`, `metadata jsonb`, `updated_at` trigger, soft delete) + índice cubierto | Robustez BD: partial unique, trim+length, metadata forward-compat, soft delete |
| 11 | **Dev - Tech** | API Endpoints | Paths scoped: `POST /messages` (client_nonce), `GET /messages` (cursor), `GET /roster` (+presence) | RESTful + idempotencia; roster incluye presence |
| 12 | **Dev - Tech** | Realtime broadcast wiring | `postgres_changes` INSERT + Broadcast channel + **`supabase.realtime.setAuth()` obligatorio para RLS** | Sin `setAuth()` RLS se salta en Realtime — crítico |
| 13 | **Dev - Tech** | Presence technically | Estados `online/away/offline`; 30s away threshold; multi-tab merge; `channel_id` metadata | UX realista; multi-tab correcto |
| 14 | **Dev - Tech** | Sub-second simultaneity | `clock_timestamp()` microsegundos + UUID | Tiempo real ejecución vs transacción |
| 15 | **Dev - Tech** | Cursor structure | Base64 URL `{ w: workspace_id, c: channel_id, t, i }` + validación servidor cross-workspace | Defensa en profundidad; anti-leak |
| 16 | **Dev - Tech** | Security & RLS | Policies explícitas 3 tablas; `bunkai_can_write_workspace()` en INSERT/UPDATE messages | Fuente única verdad; `viewer` rechazado en BD |
| 17 | **Dev - Tech** | Error payloads | Envelope estándar + nuevos: `CHAT_FORBIDDEN_NOT_CHANNEL_MEMBER`, `CHAT_INVALID_CURSOR`, `CHAT_REALTIME_UNAVAILABLE` | Observabilidad granular; degradación graceful |
| 18 | **Dev - Tech** | Typing indicators | Broadcast + **TTL 3s auto-limpieza**; máquina estados optimista `sending→sent/failed` (10s timeout) | Máquina estados robusta; sin leaks |
| 19 | **Dev - Tech** | Performance SLAs | P95/P99 + condiciones: delivery 200/500ms, load 500/1000ms, pagination 200/400ms, presence 1s/2s, reconnect 1.5s/3s | Contratos medibles; metodología k6 |
| 20 | **Dev - Tech** | Accessibility implementation | `#sr-announcer` atómico, focus management, reduced-motion, presence no-color, atajos `Ctrl+Shift+K` | WCAG 2.1 AA real; no solo declarativo |
| 21 | **Design - UI/UX** | Viewer composer banner | Banner inline focusable `bg-muted/40` + lock icon + botones visibles disabled + `role="status" aria-live="polite"` | Accesible, sin layout shift, anuncia cambio rol |
| 22 | **Design - UI/UX** | Empty channel UI | Card centrado, Hash icon AA, microcopy `#general`, chips keyboard-accessible, Viewer sin chips | Limpio, contrast-safe, estado Viewer explícito |
| 23 | **Design - UI/UX** | Roster behaviour | Slide-in Flyout + **FocusTrap** + Escape/backdrop close + `aria-expanded` + reduced-motion | Accesible, focus trap, no trap leaks |
| 24 | **Design - UI/UX** | Unread separator styling | Token `destructive` semántico, **persiste hasta acción** + botón `[Mark read]` + focusable | Control usuario; no expira; WCAG AA |
| 25 | **Design - UI/UX** | Panel state persistence | `localStorage` versionado `v1` + `scrollTop` + `lastActiveChannelId` + shortcut `Ctrl+Shift+K` | Fluido, versionado, sin conflictos shortcut |
| 26 | **Design - UI/UX** | Breakpoint tier layout | 4 tiers + `visualViewport` API + swipe thresholds + safe areas + body scroll lock | Desktop-first con mobile-first real |

---

## Suggested Story Improvements

| ***#*** | ***Current state*** | ***Suggested change*** | ***Benefit*** |
| --- | --- | --- | --- |
| 1 | "real-time channel" | Define delivery mechanism (Supabase Realtime broadcast) | Removes ambiguity about implementation |
| 2 | "without refreshing the page" | Define reconnection mechanism and catch-up window | Makes AC5 testable |
| 3 | "currently online" | Define presence implementation (Supabase Presence) | Makes AC3 testable |
| 4 | "oldest messages load as she scrolls up" | Define pagination strategy and page size | Makes AC2 testable |
| 5 | "friendly prompt" for empty state | Provide exact copy | Makes empty state assertable |
| 6 | "messages display in the order they were sent" | Define ordering mechanism (server timestamp) | Makes ordering assertions objective |
| 7 | No error states defined | Add AC for network error, auth failure, send failure | Prevents broken UI on failure |
| 8 | No loading states defined | Add AC for message loading, history loading, send-in-progress | Prevents UX gaps during loads |

---

## Data feasibility flags

- ***Entity / fixture missing***: No `channels`, `messages`, or `channel_members` tables exist in the database schema.
- ***API contract gap***: No chat API endpoints exist — message send, history load, roster, presence are all undefined.
- ***Required pre-work***: Design and implement DB schema for channels, messages, channel_members; implement chat API endpoints; wire Supabase Realtime for chat delivery; implement presence tracking.
- ***Data risk***: All data-layer testing is blocked until the schema and API contracts are defined. The story cannot be estimated without this pre-work.

---

## Recommended testing strategy

### Pre-implementation

- Confirm DB schema design (channels, messages, channel_members tables) with Dev.
- Confirm API endpoint contracts (send, history, roster, presence) with Dev.
- Confirm Supabase Realtime wiring for chat delivery with Dev.
- Confirm presence implementation approach with Dev.
- Confirm message ordering mechanism and pagination strategy with Dev.

### During implementation

- Pair chat API work with contract tests for message send, history load, roster, and presence.
- Validate DB schema matches the agreed design.
- Test Realtime subscription for message delivery.
- Test RBAC enforcement at the API level.

### Post-implementation (in-sprint by /sprint-testing)

- Run UI tests for panel rendering, message send/receive, history scroll, roster, viewer access.
- Run API tests for message CRUD, history pagination, roster, presence.
- Run integration tests for Realtime delivery, reconnection catch-up, role change propagation.
- Run security-RBAC tests for viewer read-only, cross-workspace isolation.

---

## Assumptions and Blockers

### Assumptions

1. Workspace membership (BK-1) is complete and provides the RBAC ladder.
2. App Shell (BK-147) can host a right-side panel.
3. Supabase Realtime (migration 0043) can be extended for chat delivery.
4. The general channel is created automatically with the workspace.
5. Message history is retained indefinitely in v1 (no auto-purge).

### Blockers

1. DB schema design for channels, messages, channel_members — blocks all data-layer testing.
2. API endpoint contracts — blocks API contract testing.
3. Supabase Realtime wiring for chat — blocks Realtime delivery testing.
4. Presence implementation approach — blocks roster online/offline testing.
5. Message ordering mechanism — blocks ordering assertions.

---

## Risks & mitigation

| ***#*** | ***Risk*** | ***Likelihood*** | ***Impact*** | ***Mitigated by which outlines*** |
| --- | --- | --- | --- | --- |
| 1 | DB schema does not exist — blocks all testing | High | Critical | Integration #3, Security-RBAC #1 |
| 2 | API contracts undefined — QA and Dev invent different interfaces | High | Critical | Integration #4, Technical Questions #2 |
| 3 | Realtime wiring misconfigured — messages do not deliver | Medium | Critical | Integration #4, Positive #1 |
| 4 | Presence tracking inaccurate — roster shows wrong online status | Medium | High | Positive #6, Technical Questions #4 |
| 5 | Message ordering inconsistent under concurrent sends | Medium | High | Positive #7, Edge #1 |
| 6 | Viewer can bypass client-side restrictions via API | Medium | Critical | Security-RBAC #1, Negative #2 |
| 7 | Pagination breaks on large histories | Medium | High | Boundary #4, Edge #3 |
| 8 | Role changes not propagated in real-time | Medium | High | State-Transition #2, Edge #6 |
| 9 | NFRs undefined (performance SLA, accessibility) — QA cannot assert non-functional acceptance | Medium | Medium | NFR1-NFR4, Technical Questions #10, #11 |

---

## Traceability Map

| ***Original AC*** | ***Refined Scenarios*** | ***Outlines*** |
| --- | --- | --- |
| AC1: Real-time message delivery | 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7 | Positive #1, #2; Negative #1, #3; Boundary #1, #2, #3 |
| AC2: Message history persistence | 2.1, 2.2, 2.3 | Positive #3, #4; Boundary #4 |
| AC3: Workspace roster | 3.1, 3.2 | Positive #5; State-Transition #3 |
| AC4: Viewer read-only access | 4.1, 4.2, 4.3 | Positive #6; Negative #2; Security-RBAC #1 |
| AC5: Reconnection catch-up | 5.1, 5.2 | Positive #7; Boundary #5; State-Transition #1 |
| E1: Offline message queue | E1 | Edge #2 |
| E2: Role change propagation | E2 | State-Transition #2; Edge #6 |
| E3: Validation layers | E3 | Boundary #3; Edge #9 |
| E4: NFR - Performance delivery latency | E4 | NFR1; needs PO confirmation |
| E5: NFR - Performance history load | E5 | NFR2; needs PO confirmation |
| E6: NFR - Accessibility keyboard | E6 | NFR3; needs PO confirmation |
| E7: NFR - Accessibility screen reader | E7 | NFR4; needs PO confirmation |

---

## Handoff Notes for Phase 3

> Jira sync completed on 2026-08-15 (content separated by purpose).

### Jira mutations executed

1. **Updated Jira description** with "QA Refinements (Shift-Left Analysis)" section containing:
   - Story Quality Assessment
   - Refined Acceptance Criteria (24 scenarios with Given/When/Then — 20 core + E4-E7 NFR proposals)
   - Critical Findings (summary)
   - Clarified Business Rules
   - Critical Questions for PO (9 questions)
   - Technical Questions for Dev (11 questions)
   - Design Questions (6 questions)
   - Open Questions — Proposed Answers (table)
   - Suggested Story Improvements
   - Next Steps

2. **Populated ATP DRAFT field** (`customfield_10067`) with test plan content:
   - Coverage Estimate (30 outlines)
   - Test Outlines (Positive, Negative, Boundary, Integration, Security-RBAC, State-Transition, Non-Functional)
   - Traceability Map (incl. E4-E7 → NFR1-NFR4)
   - Test Data Requirements
   - Test Environment Requirements
   - Entry/Exit Criteria
   - Risk-Based Prioritization (P1 incl. NFR1-NFR4)

3. **Added comment mirror** pointing to the ATP DRAFT field.

4. **Added labels**: `shift-left-reviewed`, `shift-left-2026-08-15`.

5. **Set QA Assignee** to `pinto.lucas.nahuel@gmail.com`.

6. **Transitioned**: `shift_left_qa → estimation` (BK-215 now in Estimation status).

7. **Verified trace**: Description has ACs + questions, ATP DRAFT has test plan, comment mirror present.

8. **Added NFR proposals (Option B, 2026-08-15)**: Description gains E4-E7 NFR scenarios (NEEDS PO/DEV CONFIRMATION) + Technical Questions #10-#11; ATP DRAFT gains Non-Functional outlines NFR1-NFR4, Coverage Total 26→30, Risk #9, Exit Criteria NFR line, Prioritization P1 + NFR1-NFR4. PO/Dev confirmation upgrades NFRs to contract → future failures = Defect (per defect-management doctrine).

### Content separation rationale

- **Description**: WHAT to build (ACs, findings, questions for PO/Dev)
- **ATP DRAFT**: HOW to test (outlines, coverage, test data, environment, criteria)

---

## Next steps

- [ ] PO answers Critical Questions before sprint planning
- [ ] PO/Dev confirm NFR proposals (E4-E7, NFR1-NFR4): performance SLA + WCAG 2.1 AA target — confirmation upgrades them to contract
- [ ] Dev answers Technical Questions before estimation
- [ ] DB schema design is confirmed and implemented
- [ ] API endpoint contracts are confirmed and implemented
- [ ] Supabase Realtime wiring for chat is confirmed
- [ ] Story enters sprint at status `Ready For Dev` once estimated
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected)

---
_Synced from Jira by sync-jira-issues_
