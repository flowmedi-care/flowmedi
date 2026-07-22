# Arquitetura Operacional

Documento **semipermanente**. Explica *como* a [Constituição](./CONSTITUICAO-FLOWMEDI.md) é implementada hoje.  
Muda quando o modelo evolui — não quando a sprint muda.

Prioridades da semana → [`ROADMAP-OPERACIONAL.md`](./ROADMAP-OPERACIONAL.md).

---

## Pipeline canônico

```text
Domain Events
      |
 +----+----+
 |         |
 v         v
Transition  Policy → Decision
 |         |
 +----> applyCaseCommands  (única porta de escrita)
              |
              v
         Atendimento (Case Aggregate)
              |
    Pendências / Workspace / projeções IA
```

**Invariantes de escrita**

1. Ninguém escreve o aggregate do Atendimento fora de `applyCaseCommands`.
2. IA só emite **intents** (ex.: pedido de agendamento) — nunca fatos de módulo (consulta criada, pagamento confirmado).
3. Eventos internos são rastreáveis na timeline do atendimento.

Alinhamento constitucional: Leis 3–5.

---

## Lei da Fonte Única (implementação)

**Lei:** Case é a única autoridade para owner e pending. Conversation é apenas projeção.

**Implementação atual:**

```text
UI → applyCaseCommands → Case → projectConversationFromCase → Conversation
```

- Helper: `lib/ops/case-synchronizer.ts` → `projectConversationFromCase` / `refreshConversationProjection`
- Mutators: `applyOwnerViaCase` / `applyPendingViaCase` (não escrevem Conversation como fonte)
- Snapshot: Case-first; se `journey_case_id` e Case falha → WARNING `CaseUnavailable` + fallback + telemetria
- Conversation **nunca sobrescreve** Case

**Projection:** qualquer materialização do Case em read models (Conversation, Inbox Snapshot, Workspace Snapshot, Agora view).

---

## Entidades

| Conceito (Constituição) | Implementação atual | Notas |
|-------------------------|---------------------|--------|
| Identidade da pessoa | `contact_id` virtual `lead:{uuid}` \| `patient:{uuid}` | Sem tabela `contacts` |
| **Atendimento** | `journey_cases` | Aggregate root operacional |
| Tipo de processo | `process_types` | Catálogo seeded |
| Fluxo | `workflows` + `workflow_versions` | Versionado (draft/published/deprecated) |
| Fase | `workflow_phases` | Por versão; Case aponta `phase_id` |
| Transição | `workflow_transitions` | manual \| event \| automation |
| Decisão | JSONB `pending_decision` no Case | Fonte canônica (Lei 3) |
| Decisão (espelho ops) | JSONB em `whatsapp_conversations` | Deve espelhar; mid-migration |
| Command | União TS + `journey_events` (auditoria) | Sem tabela de commands |
| Tasks | `case_tasks` | Fila auxiliar; Lei 2 = destaque da próxima ação |
| Eventos | `journey_events` | domain \| integration \| internal |
| Conversa | `whatsapp_conversations` | Superfície; `journey_case_id` → Case |

---

## Conversa como superfície (não cérebro)

```text
Paciente fala  →  Conversa (canal)
                      │
                      │ sync / resolve
                      ▼
                 Atendimento (cérebro)
                      │
         Responsável atual + próxima ação + fase
```

- **Synchronizer:** `lib/ops/case-synchronizer.ts` — ops informa mudança de ownership/decisão; Case aplica via commands.
- **Resolver:** `lib/case-management/resolve-case.ts` — resolve ou cria Case ativo para a conversa.
- Vínculo: `whatsapp_conversations.journey_case_id`.

Alinhamento: Leis 3–4 + Princípio Zero (atalhos da conversa devem abrir o Workspace do Atendimento).

---

## Responsável Atual (Lei 1)

| Camada | Campos |
|--------|--------|
| Case (fonte) | `owner_type` (`ai` \| `human` \| `system` \| `patient`) + `owner_id` |
| Conversa (espelho) | `ops_owner_*`, flags de IA, `assigned_secretary_id` |

UI deve mostrar **nome humano** quando `owner_type === human` e houver `owner_id` — nunca rótulo genérico “Humano” se o nome for resolvível.

Histórico de ownership (conversa) guarda `reason`; deve ser visível no painel ops / Workspace.

---

## Decisões e próxima ação (Lei 2)

- O Atendimento pode ter **fila** (tasks abertas + pending_decision + sinais de automação).
- A UI destaca **uma** próxima ação: preferencialmente `pending_decision` do Case; senão a task aberta de maior prioridade / prazo.
- Linguagem humana obrigatória: rótulo, quem espera (`waiting_for`), `due_at`, motivo quando houver.

Formato Case `pending_decision`:

```ts
{ type, waiting_for, label?, due_at? }
```

Ops (conversa) tem modelo mais rico (`actions`, `priority`, `status`) — o synchronizer reduz para o Case. Evolução desejada: enriquecer o Case e enfraquecer a conversa como dona da decisão.

---

## Projeções de UI

| Superfície | Papel constitucional | Código |
|------------|----------------------|--------|
| **Pendências** | Fila de decisões | Board Jornada (`case-board-client`) + projeção pending |
| **Workspace** | Executa decisão (Lei 6) | `/dashboard/crm/jornada/[caseId]` + `case-workspace-client` + `context/engine` |
| **Home / Agora** | Prioriza (Lei 7) | `/dashboard` por role |
| **Conversa** | Contexto + handoff | `/dashboard/whatsapp` + CasePanel |

`buildWorkspaceContext` monta header (owner, pending, agenda, finance) + `primaryPanels` por fase. Painéis declarados devem ser renderizados ou removidos da lista.

---

## Fluxo versionado

```text
ProcessType → Workflow → WorkflowVersion (published) → Phases + Transitions
```

Engine de transição: `lib/case-management/transition/`.  
Automação (regras default): `lib/case-management/automation/engine.ts`.  
Policies IA/clínica: `lib/case-management/policies/`.

Não há editor visual completo de workflow na UI — board consome versões publicadas.

---

## IA vs fatos de domínio (Lei 5)

| Pode | Não pode |
|------|----------|
| Emitir intent (`Booking.Requested`, transfer_to_human) | Afirmar `Appointment.Created` / `Payment.Paid` |
| Assumir / devolver com brief | Mutar Case sem commands |
| Sugerir próxima ação | Ser a fonte de verdade de ownership |

Runtime: `lib/virtual-assistant/`, `lib/chatbot/`.  
Handoff / reativação: policies de conversa — motivo deve aparecer na UI (transparência).

---

## Código de referência

| Peça | Path |
|------|------|
| Bus | `lib/case-management/bus.ts` |
| Commands | `lib/case-management/apply-commands.ts` |
| Types | `lib/case-management/types.ts` |
| Resolver | `lib/case-management/resolve-case.ts` |
| Context / Workspace | `lib/case-management/context/engine.ts` |
| Synchronizer | `lib/ops/case-synchronizer.ts` |
| Observability | `lib/case-management/observability.ts` |
| Migrations | `supabase/migration-case-management-core.sql`, `migration-ops-workflow-versioned.sql`, `migration-conversation-journey-case.sql` |

Doc técnico enxuto legado: [`CASE-MANAGEMENT-NUCLEO.md`](./CASE-MANAGEMENT-NUCLEO.md).  
Auditoria histórica: [`sistema-operacional-atendimento/`](./sistema-operacional-atendimento/).

---

## Lacunas mid-migration (estado conhecido)

Estas são dívidas de arquitetura/UX — o roadmap as ataca; a Constituição não muda por causa delas.

1. Conversa ainda funciona como cérebro diário (inbox “Operações”).
2. `pending_decision` dual (Case + Conversation) — sync parcial.
3. Owner na UI genérico (“Humano”) / ausente no board.
4. Workspace incompleto (painéis declarados não renderizados; chat sem deep-link).
5. Links ops → Pipeline/Jornada quebrados (violam Princípio Zero).
6. Quatro filas “pendente” com semânticas diferentes.
7. Superfícies mortas / paralelas (pipeline sem page, journey legado órfão).
