# Shift-Left Testing Prompt — Reusable Template

Use this prompt when you want to run a shift-left QA analysis on a user story before sprint planning.

---

## PROMPT

```
Ejecutá shift-left testing para el ticket [TICKET-KEY]. Seguí esta estructura exacta:

## FASE 1 — Análisis Crítico

### Contexto Business
- Persona primaria afectada
- Personas secundarias
- Propuesta de valor de negocio
- KPIs influenciados
- Posición en el user journey

### Contexto Técnico
- Frontend
- Backend
- Base de datos
- Servicios externos
- Puntos de integración específicos del Story

### Hechos confirmados con evidencia
- [Listar hechos verificados en el codebase]

### Propuestas / decisiones pendientes
- [Listar propuestas y pending decisions]

### Complejidad del Story

| Eje | Rating | Por qué |
|-----|--------|---------|
| Business logic | [Low/Medium/High] | [razón] |
| Integración | [Low/Medium/High] | [razón] |
| Data validation | [Low/Medium/High] | [razón] |
| UI | [Low/Medium/High] | [razón] |

**Esfuerzo estimado de testing**: [Low/Medium/High] — [razón]

### Herencia del Epic
- Riesgos restated a nivel de Story
- Puntos de integración heredados
- Respuestas de PO/Dev ya dadas a nivel de epic
- Estrategia de testing heredada

---

## FASE 2 — Análisis de Calidad del Story

### Veredicto
**[Issues menores / Significant Issues / Blockers]**

- [Hallazgos clave]

---

## FASE 3 — ACs Refinados

Refinar cada AC original en escenarios con formato Gherkin:

```
AC[N]: [Título del AC]

  Scenario [N].1 ([Prioridad]): [Descripción del escenario]
    Given [precondición]
    When [acción]
    Then [resultado esperado]

  Scenario [N].2 ([Prioridad]): [Descripción del escenario]
    Given [precondición]
    When [acción]
    Then [resultado esperado]
```

**Reglas:**
- Cada AC → mínimo 2-3 escenarios (1:N por defecto)
- Colapsar a 1 solo con justificación `trivially atomic`
- Prioridades: Critical / High / Medium / Low
- Agregar escenarios de edge cases al final (Scenario E1, E2, E3...)
- **NFR gaps (si aplica)**: agregar escenarios propuestos E4-E7 (Performance + Accessibility) al final, cada uno terminando en `NEEDS PO/DEV CONFIRMATION.` — NUNCA como ACs formales. Formato y numeración en `references/nfr-proposal-procedure.md` §3.1

---

## FASE 4 — Hallazgos Críticos

| # | Hallazgo | Impacto | Acción |
|---|----------|---------|--------|
| 1 | [qué falta] | [qué bloquea] | [qué hacer] |

---

## FASE 5 — Ambigüedades

| # | Ubicación en Story | Pregunta para PO/Dev | Impacto en testing | Clarificación sugerida |
|---|---------------------|----------------------|--------------------|------------------------|
| 1 | [AC/Regla] | [pregunta] | [impacto] | [sugerencia] |

---

## FASE 6 — Gaps (info faltante)

| # | Tipo | Por qué es crítico | Qué agregar | Riesgo si se omite |
|---|------|---------------------|-------------|---------------------|
| 1 | [DB/API/Realtime/etc] | [razón] | [qué falta] | [consecuencia] |

---

## FASE 7 — Business Rules Clarificadas

| Regla | Clarificación |
|-------|---------------|
| [regla] | [aclaración] |

---

## FASE 8 — Preguntas Críticas para PO

> Estas BLOQUEAN la planificación del sprint hasta que se respondan.

**1. [Pregunta]**
- Contexto: [por qué importa]
- Impacto: [qué pasa si no se responde]
- Sugerencia: [respuesta propuesta]

---

## FASE 9 — Preguntas Técnicas para Dev

> Estas no bloquean al PO pero bloquean la implementación.

1. **[Pregunta]** — [por qué bloquea el testing]

---

## FASE 10 — Preguntas de Diseño

1. **[Pregunta]** — [por qué importa para testing]

---

## FASE 10.1 — Resolución Cross-Role (opcional — preguntar al usuario)

> **Pregunta al usuario**: "¿Querés que lance subagentes cross-role (PO Senior, Dev Senior, UX/UI Designer) para responder las preguntas abiertas para resolver ambigüedades, gaps, conflictos y contradicciones?"

**Si el usuario acepta:**
1. Lanzar 3 subagentes en paralelo:
   - **PO Senior**: responde preguntas PO (Q#1-Q#9 del refinement)
   - **Dev Senior**: responde preguntas Dev (Q#10-Q#20 del refinement)
   - **UX/UI Designer**: responde preguntas Design (Q#21-Q#26 del refinement)
2. Integrar respuestas inline:
   - `NEEDS PO/DEV CONFIRMATION` → `CONFIRMED` (con Q# reference)
   - Ambigüedades → `RESOLVED`
   - Gaps → `FILLED`
   - Conflictos → `RESOLVED`
3. Crear 4 subtasks (ver FASE 15, paso 8):
   - #1 User Story - Refinement Draft (siempre)
   - #2 User Story - Refined (solo si acepta)
   - #3 ATP Draft - Refinement Draft (siempre)
   - #4 ATP Draft - Refined (solo si acepta)

**Si el usuario rechaza:**
- Crear solo #1 y #3 (drafts)
- Las preguntas quedan como `NEEDS PO/DEV CONFIRMATION`
- #2 y #4 NO se crean

---

## FASE 11 — Preguntas Abiertas — Respuestas Propuestas

| # | Pregunta | Respuesta Propuesta | Fuente |
|---|----------|---------------------|--------|
| 1 | [pregunta] | [respuesta] | [fuente] |

---

## FASE 12 — Mejoras Sugeridas al Story

| # | Estado actual | Cambio sugerido | Beneficio |
|---|---------------|-----------------|-----------|
| 1 | [actual] | [sugerencia] | [beneficio] |

---

## FASE 13 — Próximos Pasos

- [ ] [ACCIONES Pendientes]

---

## FASE 14 — ATP DRAFT (Acceptance Test Plan)

Generar el ATP DRAFT con esta estructura:

### Coverage Estimate

| Tipo | Count | Notas |
|------|-------|-------|
| Positive | [N] | [resumen] |
| Negative | [N] | [resumen] |
| Boundary | [N] | [resumen] |
| Integration | [N] | [resumen] |
| Security-RBAC | [N] | [resumen] |
| State-Transition | [N] | [resumen] |
| Non-Functional | [N] | [resumen] (si aplica) |
| **Total** | **[N]** | **[resumen]** |

### Test Outlines

#### Positive
| # | Outline | Preconditions | Expected Result | Confirmed By |
|---|---------|---------------|-----------------|--------------|
| P1 | [nombre] | [precondición] | [resultado esperado] | [Q# si cross-role resolvió, sino vacío] |

#### Negative
| # | Outline | Preconditions | Expected Result | Confirmed By |
|---|---------|---------------|-----------------|--------------|
| N1 | [nombre] | [precondición] | [resultado esperado] | [Q# si cross-role resolvió, sino vacío] |

#### Boundary
| # | Outline | Preconditions | Expected Result | Confirmed By |
|---|---------|---------------|-----------------|--------------|
| B1 | [nombre] | [precondición] | [resultado esperado] | [Q# si cross-role resolvió, sino vacío] |

#### Integration
| # | Outline | Preconditions | Expected Result | Confirmed By |
|---|---------|---------------|-----------------|--------------|
| I1 | [nombre] | [precondición] | [resultado esperado] | [Q# si cross-role resolvió, sino vacío] |

#### Security-RBAC
| # | Outline | Preconditions | Expected Result | Confirmed By |
|---|---------|---------------|-----------------|--------------|
| S1 | [nombre] | [precondición] | [resultado esperado] | [Q# si cross-role resolvió, sino vacío] |

#### State-Transition
| # | Outline | Preconditions | Expected Result | Confirmed By |
|---|---------|---------------|-----------------|--------------|
| ST1 | [nombre] | [precondición] | [resultado esperado] | [Q# si cross-role resolvió, sino vacío] |

#### Non-Functional (si aplica)
| # | Outline | Preconditions | Expected Result | Confirmed By |
|---|---------|---------------|-----------------|--------------|
| NFR1 | [performance: latency bajo carga concurrente] | [precondición] | [resultado esperado] | [Q# si cross-role resolvió, sino vacío] |
| NFR2 | [performance: carga de historial grande] | [precondición] | [resultado esperado] | [Q# si cross-role resolvió, sino vacío] |
| NFR3 | [accesibilidad: navegación por teclado] | [precondición] | [resultado esperado] | [Q# si cross-role resolvió, sino vacío] |
| NFR4 | [accesibilidad: screen reader / live region] | [precondición] | [resultado esperado] | [Q# si cross-role resolvió, sino vacío] |

> **Consistencia numérica (MANDATORY)**: fila Non-Functional en Coverage Estimate + Total incrementado + filas E4-E7 en Traceability Map + "All N outlines executed" en Exit Criteria + NFRs en Risk-Based Prioritization + Risk row adicional — TODO debe coincidir. Ver `references/nfr-proposal-procedure.md` §4.

### Traceability Map

| AC Original | Escenarios Refinados | Outlines |
|-------------|----------------------|----------|
| AC1: [título] | 1.1, 1.2, 1.3 | P1, N1, B1 |

### Test Impact Summary

| Decisión | Impacto en Testing |
|----------|-------------------|
| [decisión técnica] | [cómo afecta los tests] |

### Test Data Requirements

- [dato]: [requisito] — [notas]

### Test Environment Requirements

- [componente]: [requisito] — [notas]

### Entry Criteria
- [ ] [criterio]

### Exit Criteria
- [ ] [criterio]

### Risk-Based Prioritization

| Prioridad | Test Outlines | Rationale |
|-----------|---------------|-----------|
| P0 — Must Have | [outlines] | [razón] |
| P1 — Should Have | [outlines] | [razón] |
| P2 — Nice to Have | [outlines] | [razón] |

### Open Items for Sprint
- [ ] [item]

### Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|------------|--------|----------------------------|
| 1 | [riesgo] | [Low/Medium/High] | [Low/Medium/High/Critical] | [outlines] |

---

## FASE 15 — Sincronización con Jira

### Contenido por campo

**Descripción (WHAT):**
- User Story + Context
- Critical Analysis
- Story Complexity
- Epic-level Inheritance
- Evidence-Confirmed Facts
- Refined Acceptance Criteria (code block con `gherkin`)
- Critical Findings
- Ambiguities (all resolved if cross-role, else with NEEDS PO/DEV CONFIRMATION)
- Gaps (all filled if cross-role, else with NEEDS PO/DEV CONFIRMATION)
- Edge Cases (all confirmed if cross-role, else with NEEDS PO/DEV CONFIRMATION)
- Contradictions (all resolved if cross-role)
- Testability Validation
- Open Questions (as interrogatives, with answers if cross-role resolved)
- Clarified Business Rules
- Suggested Story Improvements
- Data Feasibility Flags
- Next Steps (with checkmarks)

**ATP DRAFT (HOW):**
- Coverage Estimate (with Status column: CONFIRMED if cross-role)
- Test Outlines (with `Confirmed By` column if cross-role resolved)
- Traceability Map
- Test Impact Summary
- Test Data Requirements
- Test Environment Requirements
- Entry/Exit Criteria (with Status: CONFIRMED if cross-role)
- Risk-Based Prioritization
- Open Items for Sprint (checked if cross-role resolved)
- Risks & Mitigation (strikethrough + RESOLVED if cross-role resolved)

### Reglas de formato

1. **Code block para ACs**: Usar ` ```gherkin ` para syntax highlighting
2. **Sin dos puntos en Gherkin**: `Given` (no `Given:`)
3. **Una sección por campo**: Descripción ≠ ATP DRAFT
4. **Tablas con headers**: Siempre incluir cabeceras

### Comandos de sincronización

```bash
# 1. Generar markdown
# 2. Convertir a ADF
bun .claude/skills/acli/scripts/md-to-adf.ts input.md output.adf.json

# 3. Actualizar descripción
[ISSUE_TRACKER_TOOL] — PUT REST /rest/api/3/issue/{{PROJECT_KEY}}-<KEY> con {"fields":{"description":<ADF-content>}} (ver `/acli` references para auth y gotchas)

# 4. Actualizar ATP DRAFT ({{jira.acceptance_test_plan}})
[ISSUE_TRACKER_TOOL] — PUT REST /rest/api/3/issue/{{PROJECT_KEY}}-<KEY> con {"fields":{"{{jira.acceptance_test_plan}}":<ADF-content>}}

# 5. Agregar comment mirror
[ISSUE_TRACKER_TOOL] — crear comentario "## Shift-Left QA Summary..." en {{PROJECT_KEY}}-<KEY>

# 6. Agregar labels
[ISSUE_TRACKER_TOOL] — agregar labels `shift-left-reviewed` + fecha (ver `/acli`)

# 7. Transicionar (si aplica)
[ISSUE_TRACKER_TOOL] — transition a Estimation (ver {{jira.transition.*}})

# 8. Crear subtasks (ver references/subtask-separation.md)
#    SIEMPRE crear:
[ISSUE_TRACKER_TOOL] — Create Issue:
  fields:
    project: { key: "{{PROJECT_KEY}}" }
    parent: { key: "<<STORY_KEY>>" }
    issuetype: { id: "10018" }  # Task
    summary: "<<STORY_KEY>> - User Story - Refinement Draft"
    description: <Description content BEFORE cross-role resolution>

[ISSUE_TRACKER_TOOL] — Create Issue:
  fields:
    project: { key: "{{PROJECT_KEY}}" }
    parent: { key: "<<STORY_KEY>>" }
    issuetype: { id: "10018" }  # Task
    summary: "<<STORY_KEY>> - ATP Draft - Refinement Draft"
    description: <ATP DRAFT content BEFORE cross-role resolution>

#    SOLO si cross-role fue aceptado:
[ISSUE_TRACKER_TOOL] — Create Issue:
  fields:
    project: { key: "{{PROJECT_KEY}}" }
    parent: { key: "<<STORY_KEY>>" }
    issuetype: { id: "10018" }  # Task
    summary: "<<STORY_KEY>> - User Story - Refined"
    description: <Description content AFTER cross-role resolution>

[ISSUE_TRACKER_TOOL] — Create Issue:
  fields:
    project: { key: "{{PROJECT_KEY}}" }
    parent: { key: "<<STORY_KEY>>" }
    issuetype: { id: "10018" }  # Task
    summary: "<<STORY_KEY>> - ATP Draft - Refined"
    description: <ATP DRAFT content AFTER cross-role resolution>
```

---

## FASE 16 — Comparación con Mejores Prácticas del Mercado (OPTIONAL — preguntar siempre)

> Ejecutar SOLO después de FASE 15 (handoff completo: Description + ATP DRAFT sincronizados). **NUNCA automática** — preguntar primero:

**Pregunta al usuario (texto sugerido):**
> "¿Querés que haga una búsqueda exhaustiva en internet sobre qué debería tener una user story luego de un shift-left testing, para comparar los resultados con la story que estamos refinando?"

**Si el usuario acepta:**
1. **Investigar** con `[WEB_SEARCH_TOOL]` (Tavily, search_depth advanced, 3-5 resultados por query):
   - user story best practices after shift-left testing refinement
   - acceptance criteria structure INVEST 3Cs user story
   - non-functional requirements in user stories performance accessibility
   - user story dependencies scope out-of-scope definition of ready
   - test plan coverage traceability user story refinement QA
   - queries específicas del dominio de la story (2-3)
2. **Construir tabla de gaps**: `Dimensión del mercado | ¿Está en la story? (✅/⚠️/❌) | Dónde (campo/sección) | Gap / propuesta | Fuente`
3. **Presentar opciones por gap** (p.ej. A: ACs formales · B: outlines propuestos + NEEDS PO/DEV CONFIRMATION — default, preserva clasificación Defect/Improvement · C: dejar como está) y **ESPERAR decisión del usuario**
4. **Cambios aprobados** → aplicar a Jira con protocolo de FASE 15 (backup → PUT → verificar GET, separación WHAT/HOW, tablas con `tableHeader`, consistencia numérica)
5. **Persistir** investigación en `.session/shift-left-testing/<batch-id>/market-comparison.md`

**Reglas:**
- NUNCA modificar Jira sin aprobación explícita del usuario
- Veredicto ✅/⚠️/❌ por dimensión (sin muros de prosa)
- Citar fuente por fila (URL o publicación)
- Procedimiento completo: `references/market-comparison.md`

---

## FASE 17 — Presentación HTML (OBLIGATORIA — última fase)

> Después de TODAS las fases (handoff FASE 15 + market comparison FASE 16 si aplicó). Generar la presentación visible del shift-left pass. **NUNCA omitir.** Procedimiento + checklist completo: `references/presentation-template.md`.

1. **Leer el input completo**: `shift-left-refinement.md` + campos Jira sincronizados (description + ATP DRAFT vía `bun run jira:sync-issues get <STORY_KEY> --include-comments`) + tabla de gaps Phase 4 si se ejecutó
2. **Generar** `{STORY_KEY}-shift-left-presentation.html` en la carpeta PBI del Story:
   - **Modo oscuro SOLO** — paleta Tokyo Night (CSS inline, archivo único autocontenido, sin assets externos)
   - Contenido en inglés
   - Secciones según checklist `references/presentation-template.md` §3: análisis completo, calidad + gaps, TODOS los escenarios refinados (grupos AC + E-scenarios con badge `NEEDS PO/DEV CONFIRMATION`), preguntas + mejoras, ATP DRAFT completo (coverage + TODOS los grupos de outlines + traceability + data/env + entry/exit criteria + priorización + open items + risks), output Phase 4 si aplica, estado del handoff
   - **No omitir NINGÚN detalle** — recorrer el checklist ítem por ítem contra las fuentes
3. **Verificar**:
   - Cruce numérico: Coverage Total == outlines listados == Exit Criteria count == filas de Traceability
   - Abrir el archivo en browser (o capturar con `/playwright-cli`) para confirmar render oscuro + markup sin romper
4. **Reportar**: ruta repo-relativa + resultado del checklist para el session footer

**Reglas:**
- Archivo NO-Jira: vive en `.context/PBI/**` (gitignored), NO commit, NO escritura a Jira
- NO mover con el archive de sesión — vive con el Story

---

## NOTAS IMPORTANTES

1. **NO pushear sin aprobación explícita del usuario**
2. **Commits locales primero**, push después
3. **Contenido separado por propósito**: Descripción = WHAT, ATP = HOW
4. **Gherkin keywords sin dos puntos**: `Given`, `When`, `Then`
5. **Code block con lenguaje**: `gherkin` para syntax highlighting
6. **Backup antes de modificar**: Guardar JSON actual antes de PUT
7. **Verificar después de cada PUT**: Confirmar HTTP 204 y contenido
8. **Tablas ADF exigen `tableHeader`** en filas de cabecera (NO `tableCell` + marks strong → HTTP 400 `INVALID_INPUT`); replicar la estructura de una tabla existente del mismo campo
9. **Tras `splice()` en el array ADF, los índices posteriores se desplazan** — re-mapear anchors antes de más ediciones (o editar de abajo hacia arriba)
10. **NFR consistency**: "All N outlines executed" en Exit Criteria DEBE igualar el Total del Coverage Estimate
