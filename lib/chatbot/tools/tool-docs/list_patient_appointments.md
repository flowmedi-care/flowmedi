# list_patient_appointments

## Purpose

Listar consultas do paciente (agendadas/confirmadas).

## When to use

- "minhas consultas", "consulta agendada", detalhes de horário
- Antes de cancel / reschedule / confirmar qual consulta

## When NOT to use

Agendar nova consulta (use list_doctors / list_procedures / find_available_slots).

## Output contract

Structured results are authoritative. Patient-visible content is a deterministic projection of `data.appointments`:

| Count | Presentation |
|-------|----------------|
| 0 | Não encontrou consultas |
| 1 | Exatamente essa consulta (option 1) |
| N>1 | Enumera 1…N na ordem do array e pede o número |

Index order: `appointments[i]` ↔ option `i+1` ↔ seleção numérica.

`renderStrategy: appointment_list` — o runtime usa o renderer; não reescreva a lista.
