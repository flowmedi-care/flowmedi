# Check-in

Este documento define como o check-in de consultas é resolvido no assistente, em paridade com [cancel.md](./cancel.md) e [reschedule.md](./reschedule.md).

## Princípio

Check-in é um **evento** (`checked_in_at`), não um `status` da consulta.

| Campo | Papel |
|-------|--------|
| `status` | Ciclo de vida do agendamento (`agendada` / `confirmada` / …) |
| `checked_in_at` | Paciente (ou ator) anunciou chegada / concluiu check-in |
| `check_in_source` | Canal tipado: `assistant` \| `dashboard` \| `reception` \| `kiosk` \| `api` |
| `checked_in_by_patient_id` | Registro `patients` de quem executou o check-in (sessão ou responsável) |

**Adiado:** `arrived_at` (recepção confirmou presença presencial) — entra só com fluxo operacional de recepção, para não transformar `appointments` em timeline de timestamps.

## Duas máquinas

| Máquina | Responsabilidade |
|---------|------------------|
| **Conversation State** | Workflow `check_in`, goals, focus, tools |
| **Domain** | Elegibilidade, janela, persistência (`ListCheckInResult` / `PerformCheckInResult`) |

Execute **somente** traduz Domain → `ToolEnvelope` (`switch` em `type`). Proibido: filtrar janela, `eligible`, `reason ===`.

## Policy (clínica), não workflow.enabled

```ts
appointment_policy.check_in = {
  enabled: false, // default
  window: {
    opens_before_hours: 2,
    closes_after_minutes: 30,
  },
};
```

O workflow `check_in` **sempre existe** (pin estrutural). Disponibilidade = `policy.check_in.enabled`.

## Workflow vs Current Operation

```
Workflow (check_in)
  └── Current Operation
        goals: appointment_selected → check_in
        └── Mutation perform_check_in
```

`mutationKeys: ["check_in"]` → `mutation_done.check_in`.

`completeCurrentOperation({ complete: true })` após `SUCCESS` | `ALREADY_DONE`.

## Domain unions

### List

```ts
ListCheckInResult =
  | { type: "SUCCESS"; appointments }
  | { type: "DISABLED" }
  | { type: "TOO_EARLY"; nextEligibleAt }
  | { type: "NO_ELIGIBLE_APPOINTMENTS" }
```

### Perform (`DomainMutationResult`)

```ts
PerformCheckInResult =
  | { type: "SUCCESS"; data: { appointmentId; checkedInAt } }
  | { type: "ALREADY_DONE"; data? }
  | { type: "NOT_ALLOWED"; reason: "DISABLED" | "TOO_EARLY" | "WINDOW_CLOSED" | "NOT_ELIGIBLE"; nextEligibleAt? }
  | { type: "NOT_FOUND" }
```

Fora da janela (após `closes_after_minutes`) → `WINDOW_CLOSED` via policy — sem variante `TOO_LATE` na API.

## Tool

`perform_check_in` — verbo, paridade com `create_appointment` / `cancel_appointment` / `reschedule_appointment`.

Identity: mesmo contrato de cancel (`resolveCancelAppointmentId`).

## Renderer

`renderStrategy: "mutation_success"`, payload `{ mutation: "check_in" }` (mapa existente; sem strategy nova).

## State machine

```
CheckInIntent ("cheguei" / check-in)
      │
      ▼
listAppointmentsForCheckIn
      │
      ├── DISABLED / TOO_EARLY / NO_ELIGIBLE_APPOINTMENTS
      │         → abandon(endReason) → sync limpa pending
      │         → ReplyPolicy (domain/structured), LLM skip
      └── SUCCESS → Selecting (autofocus se N=1)
                        │
                        ▼
                  Confirmar → perform_check_in
                        │
                        ├── SUCCESS | ALREADY_DONE → complete: true → mutation_success
                        └── NOT_ALLOWED | NOT_FOUND → envelope
```

Interrupção explícita (`quero agendar`, …) → `ConversationTransition` HIGH → troca para `consulta` (ver [ARCHITECTURE.md](../../lib/chatbot/ARCHITECTURE.md)).

## Extensões futuras (fora do v1)

- Goals opcionais: intake / payment
- `arrived_at` + recepção
- Contact actor (`checked_in_by_contact_id`) quando existir entidade Contact
- Migrar create/cancel/reschedule para `DomainMutationResult`
