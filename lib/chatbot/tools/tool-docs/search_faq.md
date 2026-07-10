# search_faq

## Purpose

Buscar resposta em perguntas frequentes cadastradas.

## When to use

- Dúvidas institucionais: horário, endereço, estacionamento, políticas

## When NOT to use

- Preços → `get_service_price`
- Procedimentos → `list_procedures`
- Vagas → `find_available_slots`

## Failure modes

- **not_found**: FAQ não tem entrada — informe paciente e tente tool específica; NÃO transfira para humano

## Examples (positive)

- Patient: "Tem estacionamento?" → `search_faq(query="estacionamento")`

## Examples (negative)

- Patient: "Quanto custa endoscopia?" → DO NOT USE. Use `get_service_price`.
