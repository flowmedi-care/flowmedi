# Cancel

Este documento define como o cancelamento de consultas é resolvido no assistente. O objetivo é garantir seleção e cancelamento determinísticos, independentes do comportamento da LLM.

## State machine

```
CancelIntent
      │
      ▼
Focused válido?
      │
      ├── Sim ─► Confirmar ─► Cancelar
      │                     │
      │                     ├── OK
      │                     └── Erro domínio
      │                              │
      │                              ▼
      │                     Invalidar focused inválido
      │                              │
      │                              ▼
      │                     Listar consultas canceláveis
      │
      └── Não ─► Listar consultas canceláveis
                      │
                      ▼
                Usuário escolhe
                      │
                      ▼
             focused_appointment_id
                      │
                      ▼
                Confirmar ─► Cancelar
                                 │
                                 ├── OK
                                 └── Erro domínio → Invalidar focused → Listar
```

## Focused válido

`focused_appointment_id` é **válido** se e somente se:

- existe na base;
- pertence ao `patient_id` atual;
- `status ∈ { agendada, confirmada }`.

## Listagem

> Durante o workflow de cancelamento, o usuário deve poder **listar ou revisar** as consultas canceláveis a qualquer momento.

## Invariants

1. Never cancel without a valid `appointment_id`.
2. `appointment_id` must never be derived from `patient_id`.
3. `appointment_id` must never be derived from `pending_slot`.
4. User can list cancellable appointments throughout cancelamento.
5. A **valid** `focused_appointment_id` must not be discarded automatically on workflow entry.
6. Appointment selection must always derive from a **validated domain reference**.

   **Examples (current):** result of `list_patient_appointments`; previously validated `focused_appointment_id`.

   **Future:** other explicit domain entry points (e.g. confirmation deep-link with a server-validated id) may be added without changing this rule.

## Related

- [booking.md](./booking.md) — booking state contracts
- [reference-resolution.md](./reference-resolution.md) — menu index → domain entity
