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

### Refresh invariant

> Um refresh de uma coleção não deve invalidar uma referência ainda existente nessa coleção.

Ao listar com N>1, se `focused_appointment_id` atual ainda está em `active_appointments`, o focus é **preservado**. Só é limpo quando deixa de existir na lista nova (ou a lista tem exatamente 1 item, que passa a ser o focus).

## Identity Resolution Contract

Contrato interno de domínio para transformar a referência em `cancel_appointment.appointment_id` em um UUID canônico. Não é uma API pública.

`appointment_id` no arg da tool representa:

- um **UUID** de consulta (referência absoluta), **ou**
- um **índice da lista** (`active_appointments`), **1-based** — mesma ordem da listagem acima.

### Pipeline

```
appointment_id (arg da tool)
        │
        ▼
┌─────────────────────────────────────────────┐
│  resolveReference(arg, active)              │
│  Puro: só o que o chamador enviou.          │
│  Sem estado conversacional. Sem allowlist.  │
│                                             │
│  1. UUID sintaticamente válido? → esse UUID │
│  2. índice 1..N em active? → active[n-1]    │
│  3. senão → null                            │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  Orquestrador (fallback de estado)          │
│                                             │
│  canonical = resolveReference(arg)          │
│              ?? focused                     │
│                                             │
│  focused NÃO faz parte do resolve.          │
│  É contexto implícito escolhido pelo        │
│  orquestrador se a referência explícita     │
│  não resolveu.                              │
│                                             │
│  se !canonical → erro de resolução          │
└─────────────────────────────────────────────┘
        │
        ▼  canonicalUuid
┌─────────────────────────────────────────────┐
│  authorizeTarget(uuid, allowedAppointments) │
│  "Esse UUID pode ser usado neste contexto?" │
│                                             │
│  hoje allowed = active ∪ focused            │
│  (parametrizado pelo caller)                │
│                                             │
│  também rejeitar: patient_id, pending_slot  │
│                                             │
│  sim → ok | não → erro tipado               │
└─────────────────────────────────────────────┘
```

| Peça | Responsabilidade | Fontes |
|------|------------------|--------|
| `resolveReference` | Ref explícita → UUID canônico | arg + lista ativa |
| Orquestrador | Fallback se resolve falhou | `focused` do estado |
| `authorizeTarget` | Pode usar neste contexto? | `allowedAppointments` |

### Pós-condição

`resolveCancelAppointmentId` sempre retorna **ou**:

- um **UUID canônico** de consulta, **ou**
- um **erro tipado** (resolução ou autorização)

Nunca retorna índices de lista nem identificadores parcialmente resolvidos.

### Idempotência (`resolveReference`)

- `resolveReference(UUID) = UUID`
- `resolveReference(resolveReference(UUID)) = UUID`
- `resolveReference("2") → B` então `resolveReference(B) → B`

### Conceitos

1. Resolve ≠ Authorize
2. Allowlist parametrizado (`allowedAppointments`)
3. UUID canônico
4. Erro tipado
5. Idempotência
6. Refresh preserva focus

## Invariants

1. Never cancel without a valid `appointment_id`.
2. `appointment_id` must never be derived from `patient_id`.
3. `appointment_id` must never be derived from `pending_slot`.
4. User can list cancellable appointments throughout cancelamento.
5. A **valid** `focused_appointment_id` must not be discarded automatically on workflow entry.
6. Appointment selection must always derive from a **validated domain reference**.

   **Examples (current):** result of `list_patient_appointments`; previously validated `focused_appointment_id`; 1-based list index resolved via `resolveReference`.

   **Future:** other explicit domain entry points (e.g. confirmation deep-link with a server-validated id) may be added without changing this rule.

7. A collection refresh must not invalidate a reference still present in that collection.

## Related

- [booking.md](./booking.md) — booking state contracts
- [reference-resolution.md](./reference-resolution.md) — menu index → domain entity
