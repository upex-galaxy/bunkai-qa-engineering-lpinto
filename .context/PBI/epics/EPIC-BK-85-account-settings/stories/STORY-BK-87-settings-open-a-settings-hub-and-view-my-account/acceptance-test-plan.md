# ATP — BK-87: Settings hub + Account

## Coverage

| ID | Priority | Type | Status | Needs PO |
|----|----------|------|--------|----------|
| TC-AC1 | Critical | Positive | Ready | No |
| TC-AC2 | Critical | Positive | Ready | No |
| TC-AC3 | High | Positive | Ready | No |
| TC-AC4 | Critical | Negative | Draft | Yes |
| TC-AC5 | High | Negative | Draft | Yes |
| TC-AC6 | High | Boundary | Draft | Yes |
| TC-AC7 | Medium | Negative | Draft | Yes |

## Test Cases

### TC-AC1: Debería mostrar identidad del usuario en Account section

**Priority**: Critical | **Type**: Positive
**Data**: User `email=sara@example.com`, `user_metadata.name="Sara Iglesias"`, belongs to ≥1 workspace
**Pre**: Auth session active, workspace_members 200
**Steps**:
1. Sign in
2. Navigate to Settings → Account
3. Observe identity card
**Expected**:
- Email `sara@example.com` como label principal
- Name `Sara Iglesias` visible
- Role in current workspace visible
**Edge**: name=null → solo email

### TC-AC2: Debería listar workspaces con rol e indicador del actual

**Priority**: Critical | **Type**: Positive
**Data**: User in 3 workspaces: "Bunkai Core" (Owner, current), "QA Sandbox" (Member), "Docs Team" (Viewer)
**Pre**: Auth session active, workspace_members 200 (3 rows)
**Steps**:
1. Sign in
2. Navigate to Settings → Account
3. Observe workspace list
**Expected**:
- Section title "Workspaces" or "My Workspaces"
- Cada workspace: name + role
- Current workspace indicado
**Edge**: 10+ → scroll

### TC-AC3: Debería acceder a Settings desde la navegación global

**Priority**: High | **Type**: Positive
**Data**: Signed-in user on any post-login page
**Pre**: Topbar tiene entrada a Settings
**Steps**:
1. Click gear icon / avatar dropdown "Settings"
2. Also test direct URL `/settings`
**Expected**:
- Redirect a `/settings`
- Account section carga
- URL final = `/settings`

### TC-AC4: Debería redirigir a login si no autenticado

**Priority**: Critical | **Type**: Negative | **⚠️ Needs PO**
**Data**: Anonymous browser
**Pre**: No session
**Steps**:
1. Private window → navegar a `/settings`
**Expected**:
- Redirect a `/login` con `returnUrl=/settings`

### TC-AC5: Debería manejar expiración de sesión

**Priority**: High | **Type**: Negative | **⚠️ Needs PO**
**Data**: User on `/settings`
**Pre**: Sesión activa
**Steps**:
1. Forzar expiración/revoke de sesión
2. Observar comportamiento
**Expected**:
- Redirect a login O mensaje "Session expired"
- Sin crash ni error toast

### TC-AC6: Debería mostrar estado vacío sin workspaces

**Priority**: High | **Type**: Boundary | **⚠️ Needs PO**
**Data**: User sin workspace memberships
**Pre**: workspace_members returns []
**Steps**:
1. Sign in como usuario nuevo
2. Navegar a Settings → Account
**Expected**:
- Identidad visible
- "You don't belong to any workspaces yet" + CTA

### TC-AC7: Debería mostrar error si falla workspace_members

**Priority**: Medium | **Type**: Negative | **⚠️ Needs PO**
**Data**: User con memberships conocidas
**Pre**: workspace_members query fails (500/network)
**Steps**:
1. Simular network failure
2. Navegar a Settings → Account
**Expected**:
- Identidad visible (AuthContext client-side)
- Mensaje error + botón Retry
- Retry exitoso → lista normal
