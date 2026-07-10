# create_appointment

## Purpose

Criar agendamento confirmado. Operação irreversível.

## When to use

- Após `find_available_slots`, paciente escolheu horário **e confirmou explicitamente** ("sim", "isso", "pode marcar")

## When NOT to use

- Antes de `find_available_slots`
- Sem confirmação explícita
- `scheduled_at` inventado ou fora de `offered_slots`

## Failure modes

- needs_input se horário ∉ offered_slots
- error se conflito na agenda

## Examples (negative)

- Patient: "10/07 14h" sem ter visto slots → DO NOT invent scheduled_at. Chame `find_available_slots` primeiro.
