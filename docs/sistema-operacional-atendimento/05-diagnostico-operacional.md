# 5. Diagnóstico Operacional — a secretária às 8h

**Pergunta-guia o dia inteiro:** Em cada caso da fila, *quem deveria tomar a próxima decisão?* Se for ela, o caso aparece. Se for IA/Sistema/Paciente, ela só supervisiona.

## Fluxo hoje (hipótese validada pela arquitetura de telas)

```text
08:00 abre WhatsApp
  → responde urgentes / não lidas
  → abre CRM / Centro de Leads (se lembra)
  → abre Agenda
  → abre Jornada / Centro de Jornada (se lembra)
  → volta WhatsApp
  → às vezes Pipeline (quase nunca para trabalhar)
  → Agenda de novo
```

**Problema:** a decisão está espalhada. Não há fila única de “eu sou a decisora”.

## Fluxo alvo

```text
08:00 abre Centro de Operações
  → vê filas por Responsável / tipo de decisão / SLA
  → escolhe próximo Case
  → decide (responder / CRM / agenda / devolver IA / transferir)
  → executa sem sair da tela (ou deep-link com retorno)
  → passa Responsável ou fecha decisão
  → fim do turno: zero decisões humanas órfãs acima do SLA
```

## Wireflow — Centro de Operações

```text
┌──────────────────┬─────────────────────────────┬────────────────────┐
│ FILAS            │ ATENDIMENTO (Case)          │ CONTEXTO           │
│                  │                             │                    │
│ Preciso decidir  │ Timeline unificada          │ Responsável Atual  │
│  (eu = humano)   │ Chat WhatsApp               │ Próxima decisão    │
│ IA conduzindo    │ Composer (só se eu conduzo) │ Estágio comercial  │
│ Sistema / SLA    │                             │ Agenda vinculada   │
│ Paciente aguarda │ [Pausar IA] [Claim]         │ Notas / brief      │
│ Aging > SLA      │ [Devolver IA + brief]       │ Suggested actions  │
│                  │ [Transferir] [Fechar]       │                    │
└──────────────────┴─────────────────────────────┴────────────────────┘
```

### Passos do turno

1. **Abrir** — default filtro: `Responsável = eu` ∪ `pool humano` ∪ `SLA estourando`.
2. **Escolher Case** — ordenar por SLA / prioridade decisão (handoff > comercial parado > IA supervisionada).
3. **Claim** (se pool) — Responsável Atual = `Humano:<eu>`; IA silenciosa.
4. **Decidir** — opções do Decision Map D3.
5. **Executar** — mensagem, mutação CRM/agenda, nota.
6. **Passar ou encerrar decisão** — devolver IA (brief), transferir, `Paciente_aguardando`, `Sistema` (lembrete), fechar Case.
7. **Feito do dia** — nenhuma decisão com dono humano acima do SLA.

## Filas (facets do mesmo Case)

| Fila | Critério | Quem decide |
|------|----------|-------------|
| Preciso decidir | Responsável humano (eu/pool) + pending_decision | Humano |
| IA conduzindo | Responsável=`IA` | IA (supervisão) |
| Sistema / lembretes | Responsável=`Sistema` due | Sistema executa; humano se falhar |
| Paciente aguardando | Responsável=`Paciente_aguardando` | Ninguém empurra sem regra |
| Aging | Qualquer com SLA estourado | Escalar conforme Filosofia |

## Critérios “feito do dia”

- [ ] Zero handoffs sem claim acima do SLA
- [ ] Zero `pending_decision` humanas órfãs
- [ ] Todo Case open tem Responsável Atual explícito
- [ ] Lembretes “me chama amanhã” estão em `Sistema`, não na cabeça

## Entregável

Este wireflow é o contrato de UX do Centro de Operações. Implementação reutiliza inbox WPP + cards de jornada, mas a **unidade é o Case**, não a conversa solta.
