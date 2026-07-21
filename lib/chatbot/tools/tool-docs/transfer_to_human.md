# transfer_to_human

## Purpose

Transferir conversa para atendente humano (HandoffPolicy → HandoffDecision).

## When to use

- Pedido **explícito** de humano/atendente/pessoa
- Reclamação formal (Procon, advogado)
- Impossibilidade técnica real após tentar outras tools

## When NOT to use

- Durante booking ativo (procedimento/médico/horário em andamento)
- Dúvida resolvível com `list_procedures`, `find_available_slots`, `get_service_price`, `search_faq`
- Paciente responde "1", "2" ou "marca qualquer um" — continue o fluxo

## Copy

A mensagem ao paciente vem da HandoffPolicy (`patientReply`), não do LLM.

## Failure modes

- needs_input se booking ativo sem pedido explícito de humano
- unavailable fora do horário de handoff (stay_with_ai + copy de fora de horário)

## Examples (negative)

- Patient: "marca qualquer um" → DO NOT USE. Escolha primeira opção e continue booking.
