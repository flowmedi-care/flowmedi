# RIPD — Relatório de Impacto (IA + dados de saúde)

**Versão:** 2026-07-02 | **Art. 38 LGPD**  
**Status:** aguardando assinatura formal do Encarregado após revisão jurídica

## 1. Descrição do tratamento

Assistente virtual WhatsApp (`lib/virtual-assistant/`) processa mensagens de pacientes para agendamento, preços e informações gerais. Áudio pode ser transcrito (ViaProve). Dados clínicos sensíveis **não** devem ser enviados intencionalmente ao provedor de IA; tool `lookup_patient_by_phone` retorna apenas `patient_id` e primeiro nome.

Formulários públicos e prontuário tratam dados sensíveis sob responsabilidade da clínica controladora.

## 2. Necessidade e proporcionalidade

- Minimização: `minimizePatientForAiToolResult`
- Aviso ao titular na 1ª resposta IA (`ai-privacy-notice.ts`)
- Opt-out: comandos DESATIVE / ATIVAR
- Handoff humano em reclamações e escalonamento
- Consentimento/aviso Art. 11 em formulários públicos
- MFA obrigatório para perfis com acesso clínico

## 3. Riscos identificados

| Risco | Gravidade | Mitigação |
|-------|-----------|-----------|
| Vazamento em prompt OpenAI | Alta | Minimização, política de ferramentas, sem fichas no prompt |
| Resposta incorreta clínica | Média | Handoff, proibições em `prompt-negatives.ts` |
| Transferência internacional OpenAI | Alta | DPA, transparência, `DPAS-SUBPROCESSADORES.md` |
| Titular não informado | Média | Aviso automático WhatsApp + portal titular |
| Acesso indevido painel | Alta | RLS, MFA, auditoria |

## 4. Medidas de segurança

- Webhook Meta com HMAC
- RLS por clínica + policies role-sensitive
- Logs em `whatsapp_ai_event_log` — revisar PII em `detail`
- Retenção automatizada (`/api/cron/data-retention`)
- Security headers (HSTS, X-Frame-Options)

## 5. Parecer do Encarregado

Após nomeação formal (`LGPD_DPO_NAME` / `LGPD_DPO_EMAIL`) e revisão jurídica:

> _Espaço reservado para parecer do Encarregado sobre aceitabilidade dos riscos residuais e plano de monitoramento._

## 6. Aprovação

| Papel | Nome | Data | Assinatura |
|-------|------|------|------------|
| Encarregado | _Configurar env_ | | |
| Direção técnica | _CTO_ | | |
| Jurídico externo | _A contratar_ | | |

## 7. Revisão

Reavaliar quando: novo modelo IA, novo subprocessador, novo tipo de dado sensível, ou incidente relevante.
