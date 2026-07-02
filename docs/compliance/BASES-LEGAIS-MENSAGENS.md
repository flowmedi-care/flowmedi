# Bases legais por módulo

**Versão:** 2026-07-02  
**Aviso:** bases sugeridas — **validação jurídica obrigatória** pela clínica controladora.

## Mensagens automáticas

Ver `lib/message-processor.ts`, `lib/consent/consent-service.ts`, `lib/consent/event-categories.ts`.

### Transacionais (não bloqueadas por consentimento marketing)

- `appointment_*`, `form_*`, `public_form_completed`
- **Base sugerida:** art. 7º, V e/ou art. 7º, IX

### Marketing

- `patient_registered`, `patient_nps`, `promotional`, `newsletter`
- **Base:** art. 7º, I — consentimento em `consents` (opt-in)

---

## Formulários públicos (`/f/public/...`)

| Dado | Finalidade | Base sugerida |
|------|------------|---------------|
| Identificação + respostas clínicas | Anamnese / captação | Art. 11, II, f |
| Aviso checkbox | Transparência | Art. 9º |

Texto UI: aviso Art. 11 no preenchimento (`formulario-publico-preenchimento.tsx`).

---

## Prontuário e atendimento

| Módulo | Dados | Base sugerida |
|--------|-------|---------------|
| Fichas clínicas | Saúde sensível | Art. 11, II, f |
| Notas de consulta | Saúde sensível | Art. 11, II, f |
| Transcrição (ViaProve) | Áudio/texto | Art. 11, II, f |

---

## Exames (`patient_exams`, bucket `exams`)

| Dado | Finalidade | Base sugerida |
|------|------------|---------------|
| Arquivos de exame | Diagnóstico / histórico | Art. 11, II, f |

Armazenamento privado por clínica (RLS + bucket policy).

---

## CRM / captação (`lead-hub`, formulários públicos)

| Dado | Finalidade | Base sugerida |
|------|------------|---------------|
| Lead (nome, contato) | Pré-agendamento | Legítimo interesse art. 7º, IX ou consentimento |
| Marketing pós-cadastro | Promoções | Art. 7º, I — consentimento |

---

## IA WhatsApp

| Tratamento | Base sugerida |
|------------|---------------|
| Interpretação de mensagens | Execução de contrato + informação prévia |
| Opt-out DESATIVE | Art. 18 / transparência |

Ver `lib/virtual-assistant/ai-privacy-notice.ts` e RIPD.

---

## Staff (médico, secretária, admin)

| Dado | Papel FlowMed | Base sugerida |
|------|---------------|---------------|
| Conta, e-mail, role | Co-controlador provável | Contrato + política staff |

---

## Responsabilidade

A clínica documenta a base escolhida no ROPA. O FlowMed implementa controles técnicos (consentimento, bloqueios, DSAR, auditoria).
