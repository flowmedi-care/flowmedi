# RIPD — Relatório de Impacto (IA + dados de saúde)

**Versão:** 2026-07-02 | **Art. 38 LGPD**

## 1. Descrição do tratamento

Assistente virtual WhatsApp (`lib/virtual-assistant/`) processa mensagens de pacientes para agendamento, preços e informações gerais. Áudio pode ser transcrito (ViaProve). Dados clínicos sensíveis **não** devem ser enviados intencionalmente ao provedor de IA; tool `lookup_patient_by_phone` retorna apenas `patient_id` e primeiro nome.

## 2. Necessidade e proporcionalidade

- Minimização: `minimizePatientForAiToolResult`
- Aviso ao titular na 1ª resposta IA (`ai-privacy-notice.ts`)
- Opt-out: comandos DESATIVE / ATIVAR
- Handoff humano em reclamações e escalonamento

## 3. Riscos identificados

| Risco | Gravidade | Mitigação |
|-------|-----------|-----------|
| Vazamento em prompt OpenAI | Alta | Minimização, política de ferramentas, sem fichas no prompt |
| Resposta incorreta clínica | Média | Handoff, proibições em `prompt-negatives.ts` |
| Transferência internacional OpenAI | Alta | DPA, transparência na política, subprocessadores |
| Titular não informado | Média | Aviso automático WhatsApp |

## 4. Medidas de segurança

- Webhook Meta com HMAC
- RLS por clínica
- Logs em `whatsapp_ai_event_log` (revisar PII em `detail`)

## 5. Parecer do Encarregado

**Lacuna:** preencher após revisão jurídica e nomeação formal do DPO (`LGPD_DPO_EMAIL`).

## 6. Aprovação

| Papel | Nome | Data |
|-------|------|------|
| Encarregado | _A preencher_ | |
| Direção | _A preencher_ | |
