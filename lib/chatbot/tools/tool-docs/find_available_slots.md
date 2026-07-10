# find_available_slots

## Purpose

Buscar disponibilidade de horários para agendamento.

## Inputs

- `doctor_id` (required)
- `procedure_id` (required)
- `date` (optional, YYYY-MM-DD) — com date retorna horários do dia (mode=times)
- `period` (optional, manha|tarde) — filtra turno quando date informado
- `skip_days` (optional) — pular dias já mostrados
- `days_ahead` (optional, default 14)

## Output

- **success**: `{ mode: "days", days[], options[] }` ou `{ mode: "times", slots[], options[] }`
- **needs_input**: falta doctor_id ou procedure_id
- **unavailable**: sem vagas no critério (recurso existe, indisponível agora)

## When to use

- Procedimento e médico conhecidos
- Paciente pergunta "tem vaga?" ou escolhe dia/turno ("segunda de manhã")

## When NOT to use

- Antes de `list_doctors` / `list_procedures`
- Para listar médicos ou procedimentos

## Failure modes

- Sem doctor_id → needs_input
- Sem vagas no critério → unavailable; re-chame com skip_days ou outro period

## Examples (positive)

- Patient: "sexta à tarde" → `find_available_slots(date=..., period=tarde)`
- Patient: "2" após lista de dias → re-chame com date do dia 2

## Examples (negative)

- Patient: "quais médicos?" → DO NOT USE. Use `list_doctors`.
