# Case Management — Núcleo Flowmed (V5+)

Arquitetura congelada. Ganhos futuros vêm de **disciplina nos limites de domínio**, não de redesenho.

## Pipeline canônico

```text
Modules / Humanos / IA
  → Domain Events (+ Integration / Internal)
  → Policies (Domain → Clinic → AI)
  → Automation (priority / exclusive)
  → Commands
  → Transition Engine  (só Case + Tasks + pending_decision)
  → Domain Events de audit / intenção (PaymentRequested, …)
  → Module responsável
  → Projections → Context Engine → Workspace / listas
```

## Invariantes (checklist de PR)

1. Module A **não** importa/chama Module B para side-effect  
2. Transition **não** referencia Finance / Agenda / WhatsApp / Prontuário  
3. Novo efeito de negócio = Domain Event (+ Command se for Case)  
4. Config de clínica em Clinic Policy, não `if` na Automation  
5. UI lê Projection / Context Engine, não events crus  
6. IA só `publishDomainEvent` — nunca MoveToStage / Commands de fase  

## Case Aggregate Root (mínimo)

Campos: `id`, `clinic_id`, `contact_id`, `journey_type`, `phase` (materializado), `owner`, `pending_decision`, `status`, `opened_at`, `closed_at`.

- **Tasks** = o que fazer (N)  
- **pending_decision** = quem decide agora (0..1)  
- **phase** = read model; verdade histórica = `journey_events`  

## Código

| Área | Path |
|------|------|
| Tipos / exports | [`lib/case-management/`](../lib/case-management/) |
| Bus | [`lib/case-management/bus.ts`](../lib/case-management/bus.ts) |
| Policies | [`lib/case-management/policies/`](../lib/case-management/policies/) |
| Automation | [`lib/case-management/automation/engine.ts`](../lib/case-management/automation/engine.ts) |
| Transition | [`lib/case-management/transition/engine.ts`](../lib/case-management/transition/engine.ts) |
| Projections | [`lib/case-management/projections/`](../lib/case-management/projections/) |
| Context Engine | [`lib/case-management/context/engine.ts`](../lib/case-management/context/engine.ts) |
| Migration | [`supabase/migration-case-management-core.sql`](../supabase/migration-case-management-core.sql) |
| Board / Workspace | `/dashboard/crm/jornada` |

## Event Bus — 3 categorias

- **Domain**: `Appointment.*`, `Lead.*`, `Payment.*`, `Form.*`, …  
- **Integration**: webhooks, sync externo  
- **Internal**: `Projection.Rebuilt`, `Automation.Applied`, `Command.Rejected`  

## Workspace

Posto de trabalho do Case. Listas (board Jornada, Leads, Agenda) são **entrada**. Painéis dinâmicos via Context Engine conforme `phase`.

## Migration

Execute `supabase/migration-case-management-core.sql` no Supabase SQL Editor antes de usar o board em produção.
