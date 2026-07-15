# Reschedule (Remarcação)

Este documento define como a remarcação de consultas é resolvida no assistente, em paridade com [cancel.md](./cancel.md). Objetivo: seleção, hydrate e mutação determinísticos, independentes do comportamento da LLM.

## Princípio UX

Remarcação **preserva** médico/procedimento da consulta focada. O chatbot pede só novo dia/horário. Não reinicia o funil de novo agendamento.

**Intent:** enquanto Current Operation de remarcação/cancelamento tem mutation pendente, `isActiveBooking` **não** troca o workflow para `consulta` (booking.collecting após hydrate não é consulta nova).

**Hydrate:** com `focused_appointment_id` e sem doctor/procedure no booking, o runtime hidrata a partir da linha do appointment antes da LLM.

## Duas máquinas concorrentes

| Máquina | Responsabilidade |
|---------|------------------|
| **Conversation State** | Workflow, goals, focus, tools |
| **Safety / Loop State** | `bot_loop_detected` / `high_outbound_rate` |

Isenção de handoff por `high_outbound_rate`: o guard consulta apenas `hasPendingDeterministicStep` (via Conversation Engine). O guard **não** conhece nomes de workflows nem goals.

Fallbacks auxiliares no engine (focus / `active_appointments` / booking ativo) existem só para **compatibilidade na migração** e devem diminuir com o tempo, não crescer.

## Workflow vs Current Operation

```
Workflow (reschedule)
  └── Current Operation
        status: active | completed
        goals + focus + collected + booking draft
        └── Mutation (reschedule_appointment) como transição
```

### Encerramento

`completeCurrentOperation({ complete: true })` é a **única** porta de saída:

1. `current_operation.status = "completed"`
2. `markMutationDoneInternal` (privado ao engine) nas `runtime.resetSpec.mutationKeys`
3. `pending = []` — a operação **deixa de existir** para o sync

`syncFlowState` consulta **`current_operation.status === "completed"`** e **não** reavalia goals. Não infere fechamento por `mutation_done`.

Após remarcação OK:

- `booking = undefined` (draft sumiu)
- `focused_appointment_id` preservado
- reply estruturada `renderStrategy: "mutation_success"`, `action: "reschedule"`

Cancel multi-alvo continua com `remainingTargets` (sem `complete`) → `resetCurrentOperation` → `status = "active"`.

## `runtime` metadata

`WorkflowDefinition.runtime` contém **somente metadata** (ex.: `resetSpec`). Nunca funções.

## State machine

```
RescheduleIntent
      │
      ▼
Focused válido? (auto-focus se N=1 && !focus && mutation pending)
      │
      ├── Sim ─► hydrate ─► Slots ─► Confirmar ─► rescheduleSlotConfirmedRule / tool
      │                                                              │
      │                                                              ├── OK → complete: true → completed
      │                                                              └── Erro domínio → invalidar focus → Listar
      │
      └── Não ─► Listar (rescheduleNeedsListRule)
```

## Hydrate

Após focus válido, o estado recebe do appointment:

- `focused_appointment_id`
- `booking.doctor_id` / `booking.procedure_id` (draft)
- `booking.status = collecting`

Após sucesso o draft some (`booking = undefined`).

## Identity Resolution

Mesmo contrato de [cancel.md](./cancel.md): `resolveCancelAppointmentId`.

## Critérios de sucesso

1. "Quero remarcar essa" após listagem não dispara bot-loop / `high_outbound_rate`.
2. Remarcação reutiliza `resolveCancelAppointmentId`.
3. Doctor/procedure hidratados automaticamente do appointment focado.
4. Execute só usa `completeCurrentOperation` após mutation (nunca `markMutationDone` externo).
5. Guard sem nomes de workflows/goals.
6. Cancelamento continua passando nos testes.
7. Após remarcação OK: `current_operation.status = completed`, `booking = undefined`, mensagem `mutation_success`, sync não reabre seleção.

## Related

- [cancel.md](./cancel.md)
- [booking.md](./booking.md)
- [reference-resolution.md](./reference-resolution.md)
