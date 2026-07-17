# 2. Event Map

**Regra:** eventos são **consequências**. Sempre amarrar à decisão que os originou.

```text
decisão → evento(s) → efeitos → quem é avisado → quem decide o próximo
```

**Pergunta-guia após cada linha:** Quem deveria tomar a próxima decisão?

---

## Formato

| ID | Evento | Decisão que o gerou | Origem hoje | Efeitos hoje | Efeitos alvo | Quem decide depois (hoje) | Quem deveria decidir | Gap |
|----|--------|---------------------|-------------|--------------|--------------|---------------------------|----------------------|-----|

---

## A. Ciclo WhatsApp / conversa

| ID | Evento | Decisão que o gerou | Origem hoje | Efeitos hoje | Efeitos alvo | Quem decide depois (hoje) | Quem deveria decidir | Gap |
|----|--------|---------------------|-------------|--------------|--------------|---------------------------|----------------------|-----|
| E01 | `message_received` | Paciente enviou (ou sistema recebeu) | Webhook Meta → `process-webhook-inbound` | Insert `whatsapp_messages`; reopen ticket; debounce IA ou menu | + bump Case timeline; `last_contact`; reavaliar Responsável | Implícito via flags IA | Responsável Atual do Case | Sem Case; sem idempotência `wamid` |
| E02 | `conversation_created` | Primeiro contato daquele telefone | Insert `whatsapp_conversations` | Routing secretária; `upsertWhatsappPipelineLead` | Nasce Case + lead linkado `pipeline_id` | Routing / IA se ativa | Política Filosofia (default IA ou humano) | Lead só aqui; depois some do fluxo |
| E03 | `conversation_reopened` | Nova msg em ticket closed | Update status open | IA pode voltar se flags ok | Case reabre ou novo Case? (Filosofia) | Flags IA | Filosofia: mesmo Case vs novo | Sem regra Case lifecycle |
| E04 | `message_outbound_human` | Secretária decidiu responder | `/api/whatsapp/send` | Pause IA; first-responder assign | Responsável=`Humano:<id>`; timeline; SLA humano | Humano (continua) | Mesmo humano até devolver/transferir | OK parcial |
| E05 | `message_outbound_ai` | IA decidiu responder | `send-reply` / agent | Persist msg assistant; `ai_state` | Timeline Case; se send fail → não avançar decisão | IA (próximo inbound) | IA se ainda Responsável | Send fail pode avançar state |
| E06 | `message_delivery_status` | Meta reporta sent/delivered/read/failed | **Ignorado** (`value.statuses`) | Nenhum | Atualizar fidelidade msg; alertar falha | Ninguém | Sistema (retry/alerta) ou Responsável | **Gap total** |
| E07 | `ai_handoff` | Decisão: escalar para humano | `transfer_to_human`, complaint, bot-loop, tool failures | `ai_handoff_at`, `ai_enabled=false`, routing | Responsável=`Humano` ou pool; `needs_action`; brief | Pool / secretária | Humano que claimar | Sem claim/SLA unificado |
| E08 | `ai_paused_by_human_reply` | Decisão: humano falou | send route | Pause IA | Idem E07 se ainda não handoff | Humano | Humano | OK |
| E09 | `ai_reactivated` | Decisão: devolver à IA / timeout / ATIVAR | assign VA, handoff-reactivation, user command | Clear handoff; `ai_enabled=true`; debounce | Responsável=`IA`; brief consumido no prompt | IA | IA (com contexto Case) | Sem brief obrigatório |
| E10 | `ai_opt_out` | Paciente pediu parar automação | user-commands | `ai_user_opt_out` | Responsável nunca IA até ATIVAR | Humano / ninguém | Humano | OK parcial |
| E11 | `conversation_assigned` | Encaminhar para secretária | assign-conversation | Só `assigned_secretary_id` | **Deve** setar handoff + pause + Responsável | UI diz humano; IA pode seguir | Humano assignee | **Bug: não pausa IA** |
| E12 | `conversation_closed_expired` | Sistema: janela/ticket expirou | cron close-whatsapp-expired | status closed | Case: Paciente_aguardando ou fechado conforme Filosofia | Ninguém | Sistema → reabrir em inbound | Fraco link CRM |
| E13 | `lead_upserted_from_whatsapp` | Decisão implícita: criar lead | upsert no create | `non_registered_pipeline` lead_novo | Case.pipeline_id; history com actor Sistema | Ninguém (lead fica parado) | IA ou humano conforme jornada | History `action_by` pode falhar |
| E14 | `last_contact_bumped` | Decisão: houve contato | Só no path create/update parcial | Incompleto em reopens | Sempre em E01 | — | Sistema | **Não roda em todo inbound** |

---

## B. Tools da IA → domínio → cascata

| ID | Evento | Decisão que o gerou | Origem hoje | Efeitos hoje | Efeitos alvo | Quem decide depois | Gap |
|----|--------|---------------------|-------------|--------------|--------------|-------------------|-----|
| E20 | `patient_registered` | Decisão: cadastrar paciente | tool `register_patient` / services | patient row + message_event | Case.patient_id; lifecycle→qualificado/cliente; journey | IA continua ou pergunta agenda | Lifecycle inconsistente |
| E21 | `patient_intake_updated` | Decisão: completar dados | `update_patient_intake` | custom_fields | Case contexto clínico | IA | OK parcial |
| E22 | `appointment_created` | Decisão: marcar consulta | tool `create_appointment` | appointment + event → templates WPP | Case vínculo agenda; lifecycle oportunidade; next_decision=confirmar | Paciente (confirmar) / Sistema (lembretes) | CRM journey derivado, não empurrado |
| E23 | `appointment_confirmed` | Decisão: confirmar | tool / flow / humano | status + event | next_decision pré-consulta | Paciente / Sistema (forms) | — |
| E24 | `appointment_canceled` | Decisão: cancelar | tool / agenda UI | status + event + possível repescagem | Case next_decision=remarcar ou perdido | Responsável / paciente | Quem autoriza cancel (Filosofia) |
| E25 | `appointment_rescheduled` | Decisão: remarcar | tool | status/times + event | Atualizar Case | Paciente | — |
| E26 | `appointment_completed` | Decisão clínica: realizada | agenda / NPS service | event; NPS path | Pós-consulta next_decision | Humano clínico / IA NPS | — |
| E27 | `appointment_no_show` | Decisão: marcar falta | agenda UI | repescagem sugerida | Case next_decision=remarcar | Humano | — |
| E28 | `check_in_performed` | Decisão: check-in | tool | encounter/check-in | Journey consulta | Humano recepção | — |
| E29 | `quote_sent` | Decisão: enviar orçamento | quotes service | event | Comercial next_decision | Paciente / humano vendas | Tools orçamento nem sempre no execute principal |
| E30 | `form_linked` / `form_reminder` | Decisão: vincular/lembrar form | forms service / events | templates | next_decision=preencher form | Paciente | — |
| E31 | `public_form_completed` | Paciente preencheu form público | form submit → events | sync pipeline no **read** de leads | Sync imediato no submit → Case | Humano (qualificar) / IA | Sync tardio |
| E32 | `transfer_to_human` | Decisão: escalar | tool | = E07 | Brief + motivo em Case | Humano | — |

---

## C. Humano / CRM → deveria alimentar IA

| ID | Evento | Decisão que o gerou | Origem hoje | Efeitos hoje | Efeitos alvo | Quem decide depois | Gap |
|----|--------|---------------------|-------------|--------------|--------------|-------------------|-----|
| E40 | `pipeline_stage_changed` | Humano arrastou lifecycle | pipeline actions / leads hub | Update `lifecycle_stage` | Event Bus → invalidar `ai_state.journey_*`; prompt Case | Depende do estágio | **IA não é avisada** |
| E41 | `pipeline_note_added` | Humano anotou | leads actions | notes / history | Case.operator_notes → prompt | Humano ou IA se devolvida | Notas não no prompt |
| E42 | `lead_marked_lost` | Decisão: perdido | UI | lifecycle perdido | Case fechado comercialmente; IA não insiste | Ninguém / Sistema | — |
| E43 | `lead_converted_patient` | Decisão: cadastrar | UI / IA | patient + pipeline | Case.patient_id | Quem conduz Case | — |
| E44 | `journey_suggested_action_changed` | Derivado (não evento persistido) | `resolveSuggestedAction` | UI jornada | Persist como `pending_decision` no Case | Frequentemente ninguém | Não é evento de verdade |
| E45 | `repescagem_suggested` | Falta/cancel | agenda sync | `lead_repescagem` | Case next_decision | Humano | Sem link WPP direto |

---

## D. Sistema / SLA / memória

| ID | Evento | Decisão que o gerou | Origem hoje | Efeitos hoje | Efeitos alvo | Quem decide depois | Gap |
|----|--------|---------------------|-------------|--------------|--------------|-------------------|-----|
| E50 | `followup_due` | Política timeout journey | `timeout-executor` / journey agent | Msg template ou handoff / perdido | Responsável=`Sistema` até executar; depois reassign | Parcial (cron) | “Me chama amanhã” não modelado |
| E51 | `handoff_sla_elapsed` | Ninguém humano respondeu | `tryReactivateAiAfterHandoff` | Reativa IA | Conforme Filosofia (reativar vs escalar admin) | IA | Sem claim humano explícito |
| E52 | `reminder_call_tomorrow` | Paciente pediu retorno | **Não existe** | — | Schedule Sistema; Responsável=`Sistema` | Ninguém | **Gap total** |
| E53 | `post24h_limit_blocked` | Ops limit | whatsapp-ops-controls | Block send | Alerta Responsável | Humano | — |

---

## Cadeias obrigatórias (visão fim-a-fim)

### Cadeia 1 — Paciente mandou mensagem

```text
(decisão implícita: receber)
→ E01 message_received
→ E14 last_contact (alvo)
→ conversation_updated
→ se Responsável=IA → turno IA (decisões do Decision Map)
→ se Responsável=Humano → fila Ops
→ next_decision + SLA
→ dashboard Ops
```

**Hoje:** E01 parcial; E14 fraco; sem Case/SLA unificado.

### Cadeia 2 — IA marcou consulta

```text
(decisão: agendar)
→ E22 appointment_created
→ message_event → WhatsApp template
→ CRM lifecycle / journey (alvo via Event Bus)
→ timeline Case
→ next_decision = aguardar confirmação / forms
→ Responsável frequentemente Paciente_aguardando ou Sistema (lembretes)
```

**Hoje:** agenda + event WPP OK; CRM/journey/Case fracos.

### Cadeia 3 — Humano alterou estágio

```text
(decisão: mudar lifecycle)
→ E40 pipeline_stage_changed
→ IA precisa saber
→ prompt/Case atualizado
→ próxima resposta muda
```

**Hoje:** para em E40 no banco do lead. IA não consome.

---

## Inventário de `event_code` de mensagens (Agenda → WPP)

Já cobertos pelo message-processor / templates (direção CRM/Agenda → paciente). Ver também `docs/WHATSAPP-AUDITORIA-COBERTURA-E-FIDELIDADE.md`.

Incluem: `appointment_created`, `appointment_rescheduled`, `appointment_confirmed`, `appointment_not_confirmed`, reminders, `appointment_canceled`, `appointment_no_show`, `appointment_completed`, `form_*`, `patient_registered`, `public_form_completed`, `quote_sent`, etc.

**Gap estrutural:** esses eventos atualizam o paciente via mensagem, mas **não** atualizam um Case operacional único consumido pela IA e pelo Centro de Operações.

---

## Entregável

Este Event Map é o contrato entre sistemas. Toda feature nova declara: qual decisão, quais eventos, quem decide depois.
