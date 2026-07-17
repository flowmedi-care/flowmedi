# 7. Continuidade — uma história única + Case

**Pergunta-guia ao longo do cenário:** Em cada seta, *quem deveria tomar a próxima decisão?* A resposta ainda aponta para um objeto só?

## Cenário de auditoria

```text
Paciente fala
→ IA conversa
→ Humano assume
→ Agenda (marca/remarca)
→ Paciente responde
→ Outro funcionário abre
→ IA volta
→ Paciente remarca
→ Médico cancela
→ Paciente responde novamente
```

## Existe uma história única?

| Momento | Onde a história vive hoje | Continua no mesmo objeto? |
|---------|---------------------------|---------------------------|
| Paciente fala | `whatsapp_messages` | Conversa por telefone |
| IA conversa | `ai_state` + messages | Mesma conversa |
| Humano assume | flags handoff + assign | Mesma conversa; CRM paralelo |
| Agenda | `appointments` + `message_events` | **Outro silo** |
| Outro funcionário | Mesma conversa se achar; sem claim forte | Risco de paralelo |
| IA volta | clear handoff / timeout | `ai_state` pode estar desatualizado vs CRM |
| Remarca / médico cancela | appointments + events | Journey recalcula; Case não existe |
| Paciente responde | messages | Sem timeline unificada decisão+agenda+CRM |

**Veredito:** hoje são **vários sistemas acoplados por telefone/email**, não uma história única. A continuidade quebra nas bordas conversa ↔ CRM ↔ agenda ↔ responsável.

## Checklist de continuidade

| Requisito | Hoje | Alvo |
|-----------|------|------|
| Uma timeline audível do caso | Parcial (msgs + events separados) | Timeline do Case (decisões + eventos + msgs) |
| Responsável atual sempre definido | Não (ambiguidade assign/IA) | Campo first-class |
| Uma próxima decisão | Duas noções (lead next_action vs journey) | `pending_decision` única |
| Estágio comercial | `lifecycle_stage` no lead | Espelhado no Case |
| Vínculo estável agenda/paciente | `patient_id` na conversa; lead por phone | `patient_id` + `pipeline_id` + `appointment_ids` |
| IA e humano leem o mesmo estado | Não | Case como fonte |
| Troca de ator sem perda | Brief inexistente | Brief obrigatório |
| Troca de funcionário sem reinício | Fraco | Claim + timeline |

## Entidade: Atendimento (Case)

### Definição

**Case** = unidade operacional do atendimento. Nasce quando a clínica passa a dever uma decisão contínua a um participante (lead/paciente), tipicamente no primeiro contato WhatsApp ou form — conforme Filosofia.

Não é sinônimo cego de `whatsapp_conversations`: uma conversa é canal; o Case é o **dossiê operacional**.

### Campos conceituais

| Campo | Descrição |
|-------|-----------|
| `id` | ID do Case |
| `clinic_id` | Clínica |
| `participant` | lead e/ou patient |
| `channel_refs` | ex.: `conversation_id` WhatsApp |
| `pipeline_id` | FK lead |
| `patient_id` | FK paciente |
| `appointment_ids` | vínculos agenda ativos |
| `owner` | Responsável Atual (`IA` \| `Humano:<id>` \| `Sistema` \| `Paciente_aguardando`) |
| `pending_decision` | { type, label, due_at, created_by } |
| `commercial_stage` | lifecycle espelhado |
| `clinical_context` | resumo seguro para operação |
| `operator_notes` / `briefs[]` | notas e passagens |
| `sla` | aging, due |
| `timeline[]` | decisões + eventos + refs msg |
| `status` | open \| waiting \| closed |
| `decision_history[]` | auditoria de quem decidiu o quê |

### Regras de continuidade

1. Toda mensagem, mutação CRM, mutação agenda e mudança de owner **escreve no Case**.
2. IA hidrata prompt a partir do Case (não só `ai_state` local).
3. Humano no Ops Center vê o mesmo Case.
4. Fechar Case ≠ apagar conversa; reabrir segue Filosofia.

## Rupturas prioritárias (continuidade)

1. Sem Case / sem `pipeline_id` na conversa  
2. Assign sem pause (dois decisores)  
3. CRM edit sem invalidar contexto IA  
4. “Me chama amanhã” sem ator Sistema  
5. Timeline fragmentada (msgs ≠ events ≠ history lead)

## Entregável

Case como unificador + checklist. Schema físico vem depois da Filosofia e da Arquitetura Alvo.
