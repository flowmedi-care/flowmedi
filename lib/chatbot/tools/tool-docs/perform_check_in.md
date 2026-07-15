# perform_check_in

Registra check-in (presença anunciada) da consulta. Não altera `status` — só `checked_in_at`.

## When to use

- Workflow `check_in` ativo
- Consulta focada (ou índice/UUID)
- Confirmação explícita do paciente

## When NOT

- Cancelar / remarcar
- Inventar `appointment_id`
- Antes de listar/selecionar a consulta

## Identity

Mesmo contrato de cancel/reschedule: UUID, índice 1-based da lista, ou `focused_appointment_id`.

## Domain

Elegibilidade e janela só em `performCheckIn` (`ListCheckInResult` / `PerformCheckInResult`).
