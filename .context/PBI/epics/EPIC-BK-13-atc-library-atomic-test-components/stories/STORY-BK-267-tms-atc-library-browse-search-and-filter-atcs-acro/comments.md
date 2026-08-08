# Comments for BK-267

[View in Jira](https://jira.upexgalaxy.com/browse/BK-267)

---

### Facu Barea - 7/8/2026, 17:46:11

## Shift-Left QA Handoff — BK-267

> Pre-sprint refinement completed | 2026-08-07 | QA: Facu Barea

***Story quality verdict***: Significant Issues — ACs confirmed (14 blocks, 19 scenarios). Pre-sprint blockers remain.

### What was updated in this session

- `✅ Acceptance Criteria (Gherkin)` — 14 AC blocks (19 Gherkin scenarios) from PO source of truth written to the field.
- `🧪 Acceptance Test Plan (ATP)` — ATP DRAFT written: 22 test outlines across Positive (9) · Negative (5) · Boundary (4) · Security/Integration (4). No test code — names only.
- ***Description*** — "QA Refinements" section appended with critical gap summary.

### Pre-sprint blockers (do not start sprint without these)

1. ***API contract gap*** — `GET /api/v1/atcs/search` requires `project*id` (BK-20 contract). A cross-project endpoint or optional `project*id` parameter is needed before implementation starts.
2. ***Design file missing*** — `atc-library-global.html` does not exist locally. UI assertions are ungrounded.
3. ***PO sign-off*** — Badge count semantics, filter state persistence on Back, and exact route URL are undefined.

### Next QA step

When this story reaches ***Ready For QA*** post-implementation, `/sprint-testing` will read the `shift-left-reviewed` label and short-circuit Phases 1–3 directly to execution validation.

Full shift-left analysis at: `.context/PBI/epics/EPIC-BK-13-.../stories/STORY-BK-267-.../shift-left-refinement.md`

---

### Facu Barea - 7/8/2026, 17:58:34

@@Ely — necesito tu decisión en los siguientes puntos antes de poder estimar esta US. Son tanto preguntas de PO como de Dev, así que las junto acá para que las respondas de una vez.

---

## Bloqueantes para estimación

### Como PO — definición de alcance

***1. ¿Qué ATCs debe mostrar la Library?***

¿Todos los ATCs del workspace, o solo los de proyectos donde el usuario es miembro?

> La respuesta cambia el diseño de aislamiento y los casos de prueba de seguridad. Sugerencia: solo proyectos donde el usuario tiene membresía activa (`workspace_members`).

***2. ¿Qué cuenta el badge del sidebar?***

¿Total de ATCs en el workspace, total accesibles para el usuario, o total después de aplicar filtros?

> Son tres assertions distintas. Si esto queda sin definir, cualquier número pasa.

***3. ¿Está disponible el archivo de diseño?***

El campo ATP de esta US referencia `.context/designs/.../atc-library-global.html` pero el archivo no existe. Sin diseño, las assertions de UI son suposiciones.

> ¿Podés compartirlo o agregar el spec de UI inline en la descripción?

***4. ¿Se preserva el estado de filtros al navegar con browser Back?***

Si el usuario abre un ATC y vuelve con Back, ¿la Library vuelve con los mismos filtros activos?

> Si sí: hay un test case para eso. Si no: fuera de scope.

---

### Como Dev — contrato técnico

***5. ¿Cómo se implementa la búsqueda cross-project?***

El endpoint actual `GET /api/v1/atcs/search` (BK-20) requiere `project_id` obligatorio — no puede usarse para búsqueda workspace-wide sin cambios.

Las opciones son:

- Hacer `project_id` ***opcional***: cuando se omite, el endpoint devuelve ATCs de todos los proyectos accesibles para el usuario en el workspace.
- Crear un ***endpoint nuevo*** (ej. `GET /api/v1/atcs` sin scope de proyecto).

> Necesito saber cuál de las dos antes de escribir los test cases de API.

***6. ¿Cuál es la ruta de la ATC Library?***

`app/(app)/` no tiene ninguna ruta `/atc-library` todavía. ¿Cuál va a ser el path canonical?

> Afecta los assertions de navegación y deep-link.

---

## Lo que pido

Una vez que tengas las respuestas, respondé este comentario con las decisiones y ***devolveme la US*** para que pueda finalizar la estimación de testing y arrancar el sprint con todo claro.

Gracias!

---


_Synced from Jira by sync-jira-issues_
