# Booking state contracts

When a booking bug appears, ask: **which contract was violated?** — not “where do I add another if?”.

## Contract 1 — Day selection

```
offered_days + selectedIndex → booking.date
```

`resolveReferenceFacts` / `resolveBookingDate` map menu index (or label / MM-DD) to an offered ISO date. Never invent a year.

## Contract 2 — Slot selection

```
offered_slots + selectedIndex → pending_slot
```

Time choice resolves against offered displays / clinic timezone, not host-local `Date` hours alone.

## Contract 3 — Confirm create

```
pending_slot + confirmed → create_appointment(scheduled_at = pending_slot)
```

`resolveCreateAppointmentScheduledAt` prefers valid `pending_slot` over a hallucinated LLM `scheduled_at`.

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

Listing without period covers morning and afternoon (not truncated to six morning slots only).
