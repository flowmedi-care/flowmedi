# Reschedule (Remarcação)

Este documento define como a remarcação de consultas é resolvida no assistente, em paridade com [cancel.md](./cancel.md). Objetivo: seleção, hydrate e mutação determinísticos, independentes do comportamento da LLM.

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
        goals + focus + collected + booking hidratado
        └── Mutation (reschedule_appointment) como transição
```

Após remarcação OK com restantes:

```
Current Operation → completeCurrentOperation → reset → New Current Operation
Workflow permanece vivo
```

Se não há restantes → `completeCurrentOperation` marca mutation done; workflow completa.

**Regra arquitetural:** `completeCurrentOperation` é a **única** API autorizada para finalizar uma Current Operation após uma mutation. Executes não chamam `markMutationDone` nem `resetCurrentOperation` diretamente.

## `runtime` metadata

`WorkflowDefinition.runtime` contém **somente metadata** (ex.: `resetSpec`, futuros `timeout` / `retryPolicy`). Nunca funções (`reset()`, `execute()`, `interpreter()`).

## State machine

```
RescheduleIntent
      │
      ▼
Focused válido?
      │
      ├── Sim ─► hydrateBookingFromAppointment ─► Slots ─► Confirmar ─► Remarcar
      │                                                              │
      │                                                              ├── OK + restantes → reset Current Operation
      │                                                              ├── OK sem restantes → workflow completa
      │                                                              └── Erro domínio → invalidar focus → Listar
      │
      └── Não ─► Listar (rescheduleNeedsListRule)
                      │
                      ▼
                Usuário escolhe → focus → hydrate → …
```

## Hydrate

Após focus válido, o estado recebe do appointment:

- `focused_appointment_id`
- `booking.doctor_id` / `booking.procedure_id`
- `booking.status = collecting`

Sem reperguntar médico/procedimento. Utilitário: `hydrateBookingFromAppointment`.

## Identity Resolution

Mesmo contrato de [cancel.md](./cancel.md): `resolveCancelAppointmentId` (UUID / índice 1-based / focused / active allowlist).

## Critérios de sucesso

1. "Quero remarcar essa" após listagem não dispara bot-loop / `high_outbound_rate`.
2. Remarcação reutiliza `resolveCancelAppointmentId`.
3. Doctor/procedure hidratados automaticamente do appointment focado.
4. Execute só usa `completeCurrentOperation` após mutation.
5. Guard sem nomes de workflows/goals.
6. Cancelamento continua passando nos testes.
7. Após remarcação OK: se há outra consulta na Current Operation, o workflow continua; senão, a operação conclui.

## Related

- [cancel.md](./cancel.md)
- [booking.md](./booking.md)
- [reference-resolution.md](./reference-resolution.md)
