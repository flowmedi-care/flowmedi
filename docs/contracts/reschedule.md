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

## Seleção de horário (contrato)

Princípio (vale para médico/procedimento/data/horário/consulta): a LLM **nunca** afirma que algo foi selecionado se o estado não contém essa seleção.

Para horário:

| Estado | Permitido |
|--------|-----------|
| `booking.pending_slot` definido | Confirmar / mutar |
| `pending_slot` ausente | Proibido “Você escolheu…” |

- `find_available_slots` (modo times) **sempre** emite `renderStrategy: "slot_list"` (só `display` numerado; nunca ISO).
- Extrator em 2 etapas: clock + período → minutos locais → match por `display` / hora clinic-local (nunca comparar ISO cru).
- Guards de runtime: `confirmed && !pending_slot` ou `time_unmatched` → reexibir `slot_list` **sem** LLM e sem novo `find_available_slots` — só contra lista **válida** (ver selection_context). Mensagens de data (`hoje`/`amanhã`/`dia N`) não disparam esse guard.
- Mensagem de sucesso / whenLabel prioritiza `offered_slots[].display`.

### `selection_context`

`offered_slots` e `pending_slot` são derivados dos filtros de busca:

- `doctor_id`, `procedure_id`, `date`, `period`, `duration_minutes`
- Qualquer mudança → `selection_context.version++`, limpa slots/pending, `selection_epoch` só volta a casar após novo `find_available_slots`
- Readers usam `getValidOfferedSlots` (epoch ≠ version → lista ignorada)

Datas relativas (`hoje`/`amanhã`/`dia N`) são determinísticas em TZ da clínica; `dia N` **não** é horário.

`find_available_slots` registra no trace: `date`, ids, `period`, `period_arg_raw`, `returned_displays`, `selection_context_version`.

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
