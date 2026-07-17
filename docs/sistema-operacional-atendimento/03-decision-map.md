# 3. Decision Map

Eventos são consequências. **Decisões** desenham o fluxo.

**Pergunta-guia:** Quem deveria tomar a próxima decisão?

O Centro de Operações alvo = **fila de decisões pendentes com responsável**, não só lista de chats.

---

## Formato

| ID | Momento / gatilho | Opções de decisão | Quem pode decidir hoje | Quem deveria decidir | Se ninguém decide |
|----|-------------------|-------------------|------------------------|----------------------|-------------------|

---

## D1 — Paciente mandou mensagem

| ID | Momento | Opções | Hoje | Deveria | Se ninguém |
|----|---------|--------|------|---------|------------|
| D1.1 | Inbound chegou | Registrar só / Acionar IA / Acionar humano / Ignorar (spam) | Flags `ai_*` implícitas | Router do Case (Responsável Atual) | Msg fica; CRM não bumpa; sem SLA |
| D1.2 | Turno de resposta | Responder / Esperar mais msgs (debounce) / Escalar / Agendar / Cadastrar / Perguntar mais / Transferir humano / Não responder | IA (tools) ou humano se handoff | Responsável Atual | Paciente sem resposta; aging invisível |
| D1.3 | Intenção “quero consulta” | Oferecer slots / Pedir dados / Passar humano / Qualificar antes | IA se tools booking | IA (default) ou humano se política clínica | Lead parado em lead_novo |
| D1.4 | Intenção “cancelar” | Cancelar direto / Confirmar motivo / Só humano / Remarcar | IA `cancel_appointment` se stage ok | Filosofia autoridade cancel | Cancel ambíguo / IA e humano divergem |
| D1.5 | Intenção “orçamento” | Informar preço FAQ / Criar quote / Humano comercial | Parcial (price/FAQ) | IA info + humano fechamento (default sugerido) | Orçamento some do Case |
| D1.6 | “Me chama amanhã” | Agendar lembrete Sistema / Anotar e esquecer / Humano assume | **Ninguém de forma confiável** | `Sistema` + SLA | **Ninguém lembra** |

---

## D2 — IA terminou um turno

| ID | Momento | Opções | Hoje | Deveria | Se ninguém |
|----|---------|--------|------|---------|------------|
| D2.1 | Após reply | Continuar (aguardar paciente) / Escalar / Fechar ticket / Agendar follow-up Sistema / Atualizar CRM | Implícito: aguardar; handoff se tool | Explicitar `pending_decision` + Responsável | Case “morto” sem dono |
| D2.2 | Após tool sucesso (ex.: appointment_created) | Confirmar ao paciente / Pedir form / Encerrar comercial / Devolver humano para review | IA segue script stage | Case next_decision pós-tool | Journey não reflete |
| D2.3 | Após tool falha repetida | Retry / Escalar / Mensagem fallback | Handoff por consecutive failures | Humano + brief com erro | Loop / silêncio |
| D2.4 | Bot loop detectado | Silenciar + handoff | bot-loop-guard | Humano | — |

---

## D3 — Secretária abriu o caso

| ID | Momento | Opções | Hoje | Deveria | Se ninguém |
|----|---------|--------|------|---------|------------|
| D3.1 | Abriu inbox | Responder / Ignorar / Encaminhar / Reativar IA / Link paciente | Manual na UI WPP | Claim → Responsável=`Humano:eu` | Outro atende em paralelo; IA pode falar |
| D3.2 | Precisa contexto | Ver CRM / Ver agenda / Ver jornada / Ver notas | Abrir 3–4 telas | Tudo no painel Case (Ops) | Decisão sem contexto |
| D3.3 | Ação comercial | Editar estágio / Nota / Marcar perdido / Converter paciente | Centro de Leads / Jornada | Ops + Event Bus avisa IA | IA fala contra o CRM |
| D3.4 | Ação clínica/agenda | Agendar / Remarcar / Status consulta | Agenda | Ops ou deep-link com retorno ao Case | Continuidade parte |
| D3.5 | Passagem | Transferir colega / Devolver IA (com brief) / Fechar Case | Assign / reactivate parcial | Protocolo + brief obrigatório à IA | Contexto perdido |
| D3.6 | Ligar / off-platform | Registrar resultado no Case | Nota solta / nada | Decisão registrada na timeline | História incompleta |

---

## D4 — Domínio agenda / clínico

| ID | Momento | Opções | Hoje | Deveria | Se ninguém |
|----|---------|--------|------|---------|------------|
| D4.1 | Consulta criada | Enviar confirmação / Pedir form / Nada | Events auto se configurado | Sistema executa política clínica | Paciente sem confirmação |
| D4.2 | Não confirmou | Lembrete / Ligar / Cancelar slot / Repescagem | Events + journey timeouts | Sistema → depois humano se esgotar | No-show |
| D4.3 | Médico cancelou | Avisar paciente / Remarcar / Humano assume | Event cancel | Sistema avisa + Responsável humano se precisa remarcar | Paciente descobre tarde |
| D4.4 | Falta | Repescagem / Contato / Perdido | Repescagem auto | Humano decide next | Sugestão sem dono |

---

## D5 — CRM / jornada

| ID | Momento | Opções | Hoje | Deveria | Se ninguém |
|----|---------|--------|------|---------|------------|
| D5.1 | Lead novo parado | Contatar / Qualificar / Perdido / Ativar IA | Lista/kanban; ação fraca | Ops fila “decisão comercial” | Lead esfria |
| D5.2 | Suggested action existe | Executar / Adiar / Reassign | Card jornada (parcial) | pending_decision no Case | “Próximo passo” ornamental |
| D5.3 | Dois next_action | Qual vence? | Ambos coexistindo | **Uma** pending_decision | Secretária confusa |

---

## D6 — Colisão de atores

| ID | Momento | Opções | Hoje | Deveria | Se ninguém |
|----|---------|--------|------|---------|------------|
| D6.1 | Humano e IA “ativos” | Só um fala | Assign pode deixar IA ativa | Humano sempre vence (Filosofia) | Mensagens duplas |
| D6.2 | Paciente pede humano | Handoff / Horário / Fila | transfer + hours | Conforme Filosofia | Pedido ignorado fora da regra |
| D6.3 | Timeout handoff sem humano | Reativar IA / Escalar admin | Reativa IA | Filosofia | IA retoma sem contexto humano |

---

## Espaço de decisão condensado (produto)

Toda decisão do sistema cabe em um destes tipos:

1. **Responder** (conteúdo)
2. **Mutar domínio** (paciente, agenda, orçamento, form)
3. **Mudar responsável** (IA ↔ humano ↔ sistema ↔ paciente)
4. **Adiar / lembrar** (SLA, “amanhã”)
5. **Encerrar / reabrir** Case
6. **Atualizar estado comercial** (lifecycle)
7. **Não agir** (explícito — registrar)

Se uma opção não tem ator, o Decision Map marca gap.

---

## Entregável

Decision Map completo acima. Implementação futura: cada opção vira transição permitida na máquina de estados do Case (ver Arquitetura Alvo).
