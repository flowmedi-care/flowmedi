# reschedule_appointment

## Purpose

Remarcar consulta para novo horário (`new_scheduled_at` de `find_available_slots`).

## When to use

Após focus válido + hydrate (doctor/procedure) + slots + confirmação do paciente.

## When NOT to use

- `new_scheduled_at` inventado (sempre de `find_available_slots`).
- Sem `appointment_id` resolvível (UUID, índice da lista ou focused).

## Identity

Usa o mesmo contrato de cancel: `resolveCancelAppointmentId` (UUID / índice 1-based / focused / active).

## Pós-sucesso

Somente via `completeCurrentOperation`: restam consultas → reset Current Operation; senão → mutation done.
