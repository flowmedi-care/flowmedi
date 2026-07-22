# Case Management — Ops de atendimento (esqueleto + física)

> **Documentação canônica:**  
> Princípios → [`CONSTITUICAO-FLOWMEDI.md`](./CONSTITUICAO-FLOWMEDI.md)  
> Arquitetura → [`ARQUITETURA-OPERACIONAL.md`](./ARQUITETURA-OPERACIONAL.md)  
> Roadmap → [`ROADMAP-OPERACIONAL.md`](./ROADMAP-OPERACIONAL.md)

## Pipeline canônico

```text
Domain Events
      |
 +----+----+
 |         |
 v         v
Transition  Policy → Decision
 |         |
 +----> applyCaseCommands  (única porta)
              |
              v
           Case Aggregate
              |
    Pendências / Workspace / IA
```

**Invariantes**

1. Ninguém escreve Case sem `applyCaseCommands`
2. IA só emite **Intents** (`Booking.Requested`, …) — nunca Domain Facts de módulo (`Appointment.Created`, `Payment.Paid`)
3. Todo evento é rastreável (timeline `journey_events` category `internal`)

## Migrations

1. `migration-case-management-core.sql`
2. `migration-ops-workflow-versioned.sql`
3. `migration-conversation-journey-case.sql` (`whatsapp_conversations.journey_case_id`)

## Código

| Peça | Path |
|------|------|
| Bus | `lib/case-management/bus.ts` |
| Commands | `lib/case-management/apply-commands.ts` |
| Resolver | `lib/case-management/resolve-case.ts` |
| Synchronizer | `lib/ops/case-synchronizer.ts` |
| Observability | `lib/case-management/observability.ts` |
