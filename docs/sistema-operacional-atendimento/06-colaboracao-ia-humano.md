# 6. Colaboração IA + Humano

**Pergunta-guia:** Em qualquer instante, *quem deveria tomar a próxima decisão?* — e isso bate com o Responsável Atual?

## Matriz hoje × alvo

| Pergunta | Hoje | Alvo |
|----------|------|------|
| Quem está conduzindo? | Inferido: `ai_enabled` + `ai_handoff_at` + `ai_user_opt_out` (+ assign que **não** sincroniza) | Sempre um **Responsável Atual** explícito |
| Quem é responsável? | `assigned_secretary_id` parcial; IA “virtual assignee” | `IA` \| `Humano:<id>` \| `Sistema` \| `Paciente_aguardando` |
| Quem pode falar? | IA se `isAiHandling`; humano sempre pode enviar | Só o Responsável (salvo override Filosofia: humano sempre pode e ao falar assume) |
| Quem pausa? | Send humano; transfer tool; commands; **não** assign | Qualquer transição que tire Responsável da IA |
| Quem devolve? | Assign VA, ATIVAR, clear context, timeout handoff | Humano com **brief** ou Sistema por política |
| Quem tem autoridade? | Espalhado (tools vs UI vs médico) | Tabela na Filosofia § autoridade |
| Quem sabe o contexto? | IA: snapshot paciente/agenda; journey opcional/stale. Humano: N telas | **Mesmo Case** |
| Quem decide a próxima? | Implícito / suggestedAction / nada | `pending_decision` no Case |

## Máquina de estados — Responsável Atual

```text
                    ┌─────────────────────┐
                    │ Paciente_aguardando │
                    └─────────┬───────────┘
                              │ inbound / timer
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           ┌────┐        ┌────────┐     ┌─────────┐
           │ IA │◄──────►│ Humano │◄───►│ Sistema │
           └────┘        └────────┘     └─────────┘
```

### Transições permitidas (alvo)

| De | Para | Gatilho | Brief obrigatório? |
|----|------|---------|-------------------|
| IA | Humano | transfer, complaint, loop, humano claim/assign, humano enviou msg | Sim (motivo) |
| Humano | IA | Devolver IA / política + paciente ATIVAR se opt-out | Sim (o que humano fez) |
| IA/Humano | Sistema | “Me chama amanhã”, follow-up agendado | Sim (quando/o quê) |
| Sistema | IA ou Humano | Timer disparou | Não (contexto do schedule) |
| Qualquer | Paciente_aguardando | Pediu-se resposta do paciente | Opcional |
| Humano A | Humano B | Transfer | Sim |

### Regra de ouro (proposta para Filosofia)

> **Humano sempre vence a IA.** Se um humano envia mensagem ou claima, Responsável vira humano e IA silencia — sem exceção.

## Protocolo de passagem (handoff)

1. Registrar decisão: `change_owner`
2. Setar Responsável Atual
3. Gravar brief (texto curto): motivo + o que já foi feito + o que falta
4. Emitir evento (Event Map E07/E09/E11)
5. Atualizar filas Ops
6. Se destino=IA: próximo turno lê brief + Case (não só `ai_state` stale)

## Rupturas confirmadas (evidência)

1. **Assign → secretária** atualiza só `assigned_secretary_id` — não `ai_enabled`/`ai_handoff_at` (`assign-conversation/route.ts`). Decisor aparente ≠ decisora real.
2. **Journey no CRM** não invalida `ai_state.journey_step_code`.
3. **Notas humanas** não entram como bloco fixo de contexto operacional no prompt.
4. **Sem claim/SLA** na fila humana — “responsável” fraco.
5. **Reativação por timeout** pode devolver à IA sem brief do que o humano (não) fez.

## Entregável

Protocolo + máquina de estados acima. Implementação = campos no Case + corrigir assign + bloco prompt “Contexto operacional”.
