# Bases legais — mensagens automáticas

**Versão:** 2026-07-02  
**Escopo:** comportamento implementado em `lib/message-processor.ts` e `lib/consent/consent-service.ts`

## Mensagens transacionais (não bloqueadas por consentimento de marketing)

Eventos de agenda, formulários vinculados à consulta e lembretes operacionais, incluindo:

- `appointment_*` (criação, confirmação, cancelamento, lembretes)
- `form_*` (link, lembrete, preenchimento)
- `public_form_completed`

**Base legal sugerida (avaliação jurídica da clínica):** art. 7º, V (execução de contrato/prestação de saúde) e/ou art. 7º, IX (legítimo interesse para lembretes necessários ao atendimento).

A clínica controladora deve documentar a base escolhida no seu ROPA.

## Mensagens sujeitas a consentimento

Quando `clinic_consent_settings.block_marketing_without_consent = true` (padrão), eventos como:

- `patient_registered`
- `patient_nps`
- `promotional`, `newsletter`
- demais eventos não classificados como transacionais em `lib/consent/event-categories.ts`

**Exigem** registro ativo em `consents` com finalidade `marketing` ou `communications`.

## Registro de consentimento

- Tabela `consents` com `purpose`, `text_accepted`, `ip_address`, `revoked_at`
- UI no perfil do paciente (`PatientConsentCard`)
- Revogação disponível no painel

## Responsabilidade

A clínica define se comunicações específicas são transacionais ou marketing. O FlowMed fornece ferramentas técnicas; a adequação da base legal é do controlador.
