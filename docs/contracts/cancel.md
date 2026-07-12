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

`list_patient_appointments` também fica disponível em qualquer workflow quando `patient_id` está definido (intenção de consultas existentes).

### Structured output (authoritative)

Patient-visible content must be a **deterministic projection** of the returned `appointments` array (`renderStrategy: appointment_list`). The LLM must not invent, omit, or summarize away rows.

With N>1 canceláveis, selection requires presenting the full numbered list. Order:

```
appointments[0]  →  option 1
appointments[1]  →  option 2
selectedIndex k  →  appointments[k - 1]  →  focused_appointment_id
```

When cancelamento starts without `focused_appointment_id`, the runtime deterministically calls `list_patient_appointments`.

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
