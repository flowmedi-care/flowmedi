# Case Management — Ops de atendimento (arquitetura 10/10)

Arquitetura congelada. Ganhos futuros vêm de **disciplina nos limites de domínio**, não de redesenho.

## Pipeline canônico

```text
Domain Event (entrada)
  → Transition Engine (resolve Transition + conditions + automation_policy)
  → atualiza Case (phase_id, pending_decision, …)
  → emite Domain Event (saída), ex. case.phase_changed
  → notificações / analytics / IA / auditoria consomem o evento de saída
```

Transition **não** acopla side-effects de módulo; side-effects reagem a eventos emitidos.

## Case (magro)

`contact_id`, `process_type_id`, `workflow_version_id`, `phase_id`, `owner_type`/`owner_id`,
`pending_decision` (quem decide), `execution_context` (tool em voo — **não** misturar),
`status`: `active | waiting | completed | cancelled`.

Tasks são tabela separada; Case expõe `open_tasks_count` via query.

## WorkflowVersion

`status`: `draft | published | deprecated` (≠ Case.status).  
Phases + Transitions na version. `automation_policy.on_enter_phase`.

## Telas (uma pergunta cada)

| Tela | Pergunta |
|------|----------|
| KPIs (`/crm/pipeline`) | Como o negócio está indo? |
| Pendências (Jornada home) | O que exige ação agora? |
| Fluxo | Onde o Case está neste WorkflowVersion? |
| Comparecimento | Quais consultas precisam de ação? |
| Workspace | Tudo para operar este Case? |
| Financeiro (módulo) | Quais obrigações existem? |

Comandas → Módulo Financeiro → FinanceProjection → resumo no Workspace.

## Código

| Área | Path |
|------|------|
| Package | [`lib/case-management/`](../lib/case-management/) |
| Transition Engine | [`lib/case-management/transition/engine.ts`](../lib/case-management/transition/engine.ts) |
| Context Adapter | [`lib/case-management/context/engine.ts`](../lib/case-management/context/engine.ts) |
| FinanceProjection | [`lib/case-management/projections/finance.ts`](../lib/case-management/projections/finance.ts) |
| Migration core | [`supabase/migration-case-management-core.sql`](../supabase/migration-case-management-core.sql) |
| Migration versionada | [`supabase/migration-ops-workflow-versioned.sql`](../supabase/migration-ops-workflow-versioned.sql) |
| Board / Workspace | `/dashboard/crm/jornada` |

## Migration

Execute **ambos** no Supabase SQL Editor (nessa ordem):

1. `migration-case-management-core.sql`
2. `migration-ops-workflow-versioned.sql`
