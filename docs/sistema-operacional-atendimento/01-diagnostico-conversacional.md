# 1. Diagnóstico Conversacional

**Pergunta-guia em cada etapa:** Quem deveria tomar a próxima decisão?

## Ciclo auditado

```text
Paciente → Webhook → Conversation → IA → Tools → CRM → Agenda → Humano → IA → Paciente
```

## Matriz de ownership (estado atual × alvo)

| Etapa | Dono da informação hoje | Quem altera | Quem consome | Quem deveria ser avisado | **Quem decide a seguir?** (hoje) | **Quem deveria decidir** (alvo) | Ruptura |
|-------|-------------------------|------------|--------------|--------------------------|----------------------------------|---------------------------------|---------|
| Mensagem inbound (Meta) | Meta → webhook | `process-webhook-inbound` | IA / menu bot / humano (se handoff) | Conversation, CRM last_contact, Responsável | Implícito: se `ai_enabled` → IA; senão humano ou ninguém | Resolver Responsável Atual; se `IA` → IA decide turno; se `Humano` → fila humana; se `Paciente_aguardando` → só registrar | Lead/`last_contact` só no create da conversa |
| Conversation / ticket | `whatsapp_conversations` | Webhook, send, assign, cron close | Inbox WPP, IA, routing | CRM Case, Ops Center | Status open/closed/completed sem “próxima decisão” | Case decide se ticket continua ou fecha | Ticket ≠ Case; sem próxima decisão |
| Estado IA (`ai_state`) | Conversa | Agent runtime / tools | Próximo turno IA | Humano no handoff; CRM journey | IA (local) | IA, mas Case deve espelhar journey/responsável | `journey_step_code` fica stale após edit CRM |
| Tool (agendar, cadastrar…) | Domínio (appointments/patients) | IA via `execute.ts` | Agenda, events, paciente | CRM lifecycle, Journey, WPP templates, Case | IA (se tool liberada pelo stage) | Filosofia: quais tools a IA pode decidir sozinha | Tool atualiza agenda/events; CRM lifecycle parcial/indireto |
| Lead / lifecycle | `non_registered_pipeline` | Upsert WPP (1º contato), drag UI, agenda sync | Centro de Leads, Jornada, funil | IA (prompt), Ops | Humano no kanban; quase nunca a IA | Decisão comercial no Case → Event Bus → lifecycle | Sem `pipeline_id` na conversa; vínculo por telefone |
| Appointment | `appointments` | IA tools / secretária / médico | Agenda UI, events, journey | Paciente (WPP), CRM, Case | Quem criou a mutação | Responsável Atual do Case (ou médico em cancel clínico) | Mutação não atualiza “próxima decisão” do Case |
| Handoff | Flags `ai_handoff_at`, `ai_enabled` | transfer_to_human, send humano, user commands | Inbox filtro Humano | Secretária pool, Case | Mistura: pedido paciente / falha / reply humano | Sempre muda Responsável Atual + brief | **Assign para secretária não seta pause IA** |
| Próxima ação | Dois mundos: `next_action` lead + `suggestedAction` journey | Derivada / pouco editada na UI | Jornada, Centro Jornada | Responsável + Ops | Frequentemente “ninguém executa” | **Próxima decisão** no Case com dono | Dois sistemas; “contact lead” sem botão |
| Prompt / contexto IA | Snapshot + `ai_state` | Cada turno | LLM | — | IA | Mesmo estado que humano vê no Case | Notas humanas / estágio CRM não entram de forma explícita |
| Lembrete “me chama amanhã” | — | — | — | — | **Ninguém** | `Sistema` como Responsável + SLA | Não existe ator Sistema |

## Pontos onde a decisão some (“ninguém”)

1. **Pós-mensagem em conversa já existente** — ninguém decide atualizar CRM/last_contact/próxima decisão.
2. **Assign humano sem pause** — UI sugere humano, IA ainda pode decidir responder.
3. **“Me chama amanhã”** — intenção capturada (ou não) sem Responsável `Sistema`.
4. **Suggested action “Entrar em contato”** — narrativa sem executor.
5. **Dois funcionários** — troca de tela sem claim; responsável fica ambíguo (`assigned_secretary_id` parcial).
6. **IA falha no send mas avança state** — sistema “acha” que decidiu e entregou; paciente não recebeu.

## Evidência (código)

- Inbound + lead bootstrap: `lib/whatsapp/process-webhook-inbound.ts`, `lib/leads/upsert-whatsapp-lead.ts`
- Gate IA: `lib/whatsapp-ai-state.ts` (`isAiHandling`)
- Assign sem pause: `app/api/whatsapp/assign-conversation/route.ts` (update só `assigned_secretary_*`)
- Pause no send humano: `app/api/whatsapp/send/route.ts`
- Tools: `lib/chatbot/tools/execute.ts`
- Next action: `lib/contact-journey/next-actions.ts`

## Entregável deste pilar

- Matriz acima como baseline.
- Toda ruptura = linha onde **Quem decide a seguir (hoje)** ≠ alvo, ou = ninguém.
- Alimenta Decision Map (pilar 3) e Continuidade (pilar 7).
