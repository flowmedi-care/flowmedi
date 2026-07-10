# get_service_price

## Purpose

Consultar preço exato de procedimento para um médico.

## When to use

- "Quanto custa?", "qual o valor?", perguntas de preço

## When NOT to use

- Listar serviços → `list_procedures`
- Políticas/endereço → `search_faq`
- Horários → `find_available_slots`

## Requires

- `doctor_id` + `procedure_id` (ou service_id)

## Failure modes

- needs_input sem doctor ou procedure

## Examples (positive)

- Patient: "Quanto custa a endoscopia com o Dr. Daniel?" → após IDs no contexto, chame com doctor_id + procedure_id
