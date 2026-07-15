# Booking state contracts

When a booking bug appears, ask: **which contract was violated?** — not “where do I add another if?”.

Menu index resolution is defined in [reference-resolution.md](./reference-resolution.md).
Cancel selection is defined in [cancel.md](./cancel.md).

## Contract 1 — Day selection

```
offered_days + selectedIndex → booking.date
```

`resolveReferenceFacts` / `resolveBookingDate` map menu index (or label / MM-DD) to an offered ISO date. Never invent a year.

## Contract 2 — Slot selection

```
offered_slots + selectedIndex → pending_slot
```

Bare integer → index only (see reference-resolution). Clock forms (`"10:00"`, `"10h"`, `"4 da tarde"`) → 2-step extract (clock + period → local minutes) then match by **`display` / clinic-local**, never raw ISO comparison.

**State is the only truth:** the LLM must not say “Você escolheu…” unless `pending_slot` is set. `find_available_slots` always returns structured `slot_list` (display only).

`offered_slots` / `pending_slot` depend on `selection_context` (doctor, procedure, date, period, duration). Any filter change bumps `version` and invalidates the list until a new search.

Relative dates (`hoje` / `amanhã` / `dia N`) are extracted in clinic TZ; bare `dia N` is not a clock.

Runtime guards: `confirmed && !pending_slot` or unmatched clock → re-show `slot_list` without calling the LLM / spinning `find_available_slots` (only for valid lists; date-intent turns do not use this guard).

## Contract 3 — Confirm create (confirmed mutation)

```
facts.confirmed → create_slot_confirmed → args só do domain state → create_appointment → renderer
```

LLM only acknowledges confirmation. It does **not** supply `doctor_id` / `procedure_id` / `scheduled_at`.

`buildCreateAppointmentArgsFromState` / `create_slot_confirmed` use `booking.*` + `patient_id` + `pending_slot` only. Execute never prefers LLM placeholders (`doc_id`).

`resolveCreateAppointmentScheduledAt` prefers valid `pending_slot` over a hallucinated LLM `scheduled_at`.

## Contract 3b — Atomic terminal mutation

After `create_appointment` / `reschedule_appointment` / `cancel_appointment` starts in a turn:

| Resultado | Reply | Estado |
|---|---|---|
| OK | Renderer de sucesso | operação completa |
| ERRO | “Não consegui concluir …” + retry | **permanece** na mesma operação (`confirming` + `pending_slot` no create) |
| Nunca | erro → listar consultas / outra mutation | trocar operação no mesmo turno |

Until the terminal tool returns success **or** error, no further mutation or operation-changing tool runs in that turn.

## Contract 4 — Known patient intake

```
patient → hydrate → collected → GapResolver → Known / Missing prompt
```

Do not ask for fields already in `collected` / patient. Gap lists only Missing. Prompt describes; it does not decide.

## Contract 5 — After create

```
create success → focused_appointment_id + active_appointments = [id]
```

Cancel/reschedule use `aiState.patient_id` (fallback phone) and focused/active ids.

## Contract 6 — Slot conflict

```
AppointmentService → ConflictDetected { message }
Runtime → refetch findSlotsForDay → patch offered_slots
LLM → communicates updated options
```

The service returns domain facts only. It does **not** return `updatedSlots` / UX lists.

## Contract 7 — Period filter

```
extractPeriod → "manha" | "tarde" | null
null = all periods (e.g. "manhã e tarde")
```

Word boundary intent: `amanhã` / `amanha` must **not** match as morning (`(?<!a)manhã`). Phrases like “de manhã” / “pela manhã” do.

Listing without period covers morning and afternoon (not truncated to six morning slots only).

## Contract 8 — Soft fork (existing upcoming)

When starting `consulta` with upcoming appointments and no doctor/procedure yet:

> Vi que você já possui consultas futuras. Deseja marcar uma **nova** mesmo assim, ou pretende **alterar** alguma existente?

- nova → booking normal (`booking_fork.status = "new"`)
- alterar → remarcação (`booking_fork.status = "alter"` + workflow reschedule)

No mandatory 1/2 menu.