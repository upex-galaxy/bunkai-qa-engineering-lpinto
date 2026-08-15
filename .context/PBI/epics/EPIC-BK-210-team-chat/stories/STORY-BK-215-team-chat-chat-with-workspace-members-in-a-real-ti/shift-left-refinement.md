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
| ***Total*** | ***26*** | High count driven by new domain, missing infrastructure, and RBAC risk |

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

> These BLOCK sprint planning until answered.

1. **Should the general channel be a special case of a channels table or a separate concept?**
   - **Context**: The story assumes a general channel exists per workspace, but no DB schema exists. The channels table design affects all subsequent chat stories.
   - **Impact if unanswered**: Dev cannot estimate the data model; QA cannot design data-layer tests.
   - **Suggested answer**: Treat it as a row in a channels table with a `type: 'general'` flag, allowing future project channels to reuse the same table.

2. **What is the message ordering guarantee when multiple users send simultaneously?**
   - **Context**: Business Rules say "messages display in the order they were sent" but the mechanism (server timestamp, sequence number, or client timestamp) is not defined.
   - **Impact if unanswered**: QA cannot write deterministic ordering assertions.
   - **Suggested answer**: Use server-assigned timestamps with microsecond precision; tie-break by sender ID for true simultaneity.

3. **What is the pagination strategy for message history (cursor-based vs offset-based) and what is the page size?**
   - **Context**: AC2 says "oldest messages load as she scrolls up" but the mechanism is undefined.
   - **Impact if unanswered**: QA cannot test pagination boundaries or scroll-up behavior.
   - **Suggested answer**: Cursor-based pagination using the last message ID, with a page size of 50 messages.

4. **Is the message validation client-side only, server-side only, or both?**
   - **Context**: AC5 mentions message length bounds but does not specify where validation occurs.
   - **Impact if unanswered**: QA cannot determine whether to test client-side, server-side, or both.
   - **Suggested answer**: Both — client-side for UX (disable send button), server-side for security (reject invalid messages).

5. **What is the maximum disconnection window before requiring a manual refresh?**
   - **Context**: AC5 mentions "connection drops for 2 minutes" but no maximum window is defined.
   - **Impact if unanswered**: QA cannot test the reconnection catch-up boundary.
   - **Suggested answer**: 5 minutes; beyond that, prompt the user to refresh.

6. **How should the empty channel state be worded?**
   - **Context**: Business Rules mention "a friendly prompt inviting the first message" but no exact copy is defined.
   - **Impact if unanswered**: QA cannot assert the exact UI text.
   - **Suggested answer**: "No messages yet. Start the conversation!"

7. **Should presence dots reflect real-time online status via Supabase Presence or a last-seen timestamp?**
   - **Context**: AC3 mentions "currently online" but the implementation is undefined.
   - **Impact if unanswered**: QA cannot test presence accuracy or refresh behavior.
   - **Suggested answer**: Use Supabase Presence for real-time online status; fall back to last-seen for recently disconnected users.

8. **What happens when a user's role changes from member to viewer while the channel is open?**
   - **Context**: This is an edge case not covered by the ACs but affects the viewer read-only scenario.
   - **Impact if unanswered**: QA cannot test real-time role propagation.
   - **Suggested answer**: The composer becomes disabled in real-time; the user sees a toast notification explaining the role change.

9. **Should messages be queued for delivery when the user is disconnected, or should the user be notified of failure?**
   - **Context**: This edge case is not covered by the ACs but affects the reconnection scenario.
   - **Impact if unanswered**: QA cannot test offline behavior.
   - **Suggested answer**: Queue messages for delivery on reconnect; show a "sending" indicator that resolves on reconnect or shows failure after timeout.

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **What DB schema will be used for channels, messages, and channel_members?** — Columns, types, constraints, indexes, foreign keys. Blocks all data-layer testing.
2. **What API endpoints will power the chat (message send, history load, roster, presence)?** — Paths, methods, auth, request/response shapes. Blocks API contract testing.
3. **How will Supabase Realtime be wired for chat message delivery?** — Channel naming, event types, payload shape. Blocks Realtime subscription testing.
4. **How will presence tracking be implemented?** — Supabase Presence vs custom solution. Blocks roster online/offline testing.
5. **What is the message ordering mechanism?** — Server timestamp, sequence number, or hybrid. Blocks ordering assertions.
6. **What cursor format and page size will be used for history pagination?** — Blocks pagination boundary testing.
7. **How will RLS policies be implemented for channel access?** — Blocks security-RBAC testing.
8. **What error codes and shapes will the API return for auth failures, validation errors, and server errors?** — Blocks error-state testing.
9. **Will there be a typing indicator or message delivery confirmation?** — If yes, blocks additional test scenarios.

---

## Design Questions

> From the BRIEF.md and mockup — design-specific gaps that affect testing.

1. **What exact copy does the viewer read-only hint show?** — The mockup says "disabled composer with a read-only hint" but no exact text is provided.
2. **How should the empty channel state be visually represented?** — Business Rules say "friendly prompt" but no design is provided.
3. **Should the roster be a flyout overlay or a persistent sidebar?** — Mockup says "roster flyout" but behavior is not defined.
4. **How should the unread separator line be styled and positioned?** — Business Rules mention it but no visual spec exists.
5. **Should the panel remember its open/closed state across page navigations?** — Not defined in ACs or mockup.
6. **How should the panel behave on narrow viewports (<1440px)?** — BRIEF.md says "desktop-first 1440px" but no responsive behavior is defined.

---

## Open Questions — Proposed Answers

| ***#*** | ***Question*** | ***Proposed Answer*** | ***Source*** |
| --- | --- | --- | --- |
| 1 | General channel: special case or separate table? | Row in channels table with `type: 'general'` | Consistency with future project channels (BK-216) |
| 2 | Message ordering guarantee | Server-assigned timestamps with microsecond precision; tie-break by sender ID | Industry standard for chat systems |
| 3 | Pagination strategy | Cursor-based using last message ID; page size = 50 | Standard for real-time feeds |
| 4 | Validation layers | Both client-side (UX) and server-side (security) | Security best practice |
| 5 | Max disconnection window | 5 minutes; beyond that, prompt refresh | Reasonable for QA tool context |
| 6 | Empty state copy | "No messages yet. Start the conversation!" | Friendly, action-oriented |
| 7 | Presence implementation | Supabase Presence for real-time; last-seen fallback | Leverages existing Supabase infrastructure |
| 8 | Role change propagation | Real-time composer disable + toast notification | Consistent with real-time chat UX |
| 9 | Offline message behavior | Queue for delivery on reconnect; show sending indicator | Standard chat pattern |

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
| 7 | Pagination breaks on large histories | Medium | High | Boundary #4, Edge #8 |
| 8 | Role changes not propagated in real-time | Medium | High | State-Transition #2, Edge #3 |

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
| E2: Role change propagation | E2 | State-Transition #2; Edge #3 |
| E3: Validation layers | E3 | Boundary #3; Edge #10 |

---

## Handoff Notes for Phase 3

> Jira sync completed on 2026-08-15 (full content synced).

### Jira mutations executed

1. **Updated Jira description** with complete "QA Refinements (Shift-Left Analysis)" section containing:
   - Story Quality Assessment
   - Refined Acceptance Criteria (20 scenarios with Given/When/Then)
   - Critical Findings
   - Clarified Business Rules
   - Critical Questions for PO (9 questions with context, impact, suggested answer)
   - Technical Questions for Dev (9 questions)
   - Design Questions (6 questions)
   - Open Questions — Proposed Answers (table)
   - Suggested Story Improvements (8 improvements)
   - Edge Cases Identified (10 edge cases)
   - Risks & Mitigation (8 risks)
   - Traceability Map
   - Next Steps

2. **Populated ATP DRAFT field** (`customfield_10067`) with the full shift-left-refinement.md body.

3. **Added comment mirror** pointing to the ATP DRAFT field.

4. **Added labels**: `shift-left-reviewed`, `shift-left-2026-08-15`.

5. **Set QA Assignee** to `pinto.lucas.nahuel@gmail.com`.

6. **Transitioned**: `shift_left_qa → estimation` (BK-215 now in Estimation status).

7. **Verified trace**: Description contains all sections from HTML preview, ATP DRAFT field populated, comment mirror present.

---

## Next steps

- [ ] PO answers Critical Questions before sprint planning
- [ ] Dev answers Technical Questions before estimation
- [ ] DB schema design is confirmed and implemented
- [ ] API endpoint contracts are confirmed and implemented
- [ ] Supabase Realtime wiring for chat is confirmed
- [ ] Story enters sprint at status `Ready For Dev` once estimated
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected)

---
_Synced from Jira by sync-jira-issues_
