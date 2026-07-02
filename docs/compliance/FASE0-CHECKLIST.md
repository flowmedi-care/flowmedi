# Fase 0 — Checklist operacional LGPD

**Responsável:** Direção + CTO + Encarregado  
**Prazo sugerido:** 1–2 semanas

## 1. Encarregado de Dados (art. 41)

- [ ] Nomear Encarregado formalmente (contrato ou termo interno)
- [ ] Configurar `LGPD_DPO_EMAIL` e `LGPD_DPO_NAME` na Vercel/produção
- [ ] Configurar `LGPD_COMPANY_LEGAL_NAME` com razão social
- [ ] Validar página `/encarregado-dados` em produção
- [ ] Registrar canal junto à ANPD se aplicável (orientação jurídica)

## 2. Migrations Supabase

Execute no SQL Editor **nesta ordem** (ver `MIGRATIONS-LGPD.md`):

- [ ] `migration-consent-lgpd.sql`
- [ ] `migration-patient-photos-private.sql`
- [ ] `migration-audit-log-admin-read.sql`
- [ ] `migration-rls-clinical-sensitive.sql`
- [ ] `migration-lgpd-phase2-5.sql`

## 3. Backups (art. 46)

Seguir `backup-checklist-supabase.md`:

- [ ] Confirmar PITR/backups diários ativos no projeto Supabase
- [ ] Documentar região do projeto (preferência Brasil quando disponível)
- [ ] Testar restore em ambiente de staging (evidência datada)
- [ ] Definir RPO/RTO internos

## 4. Revisão jurídica

Seguir `REVISAO-JURIDICA-DPA.md`:

- [ ] Advogado revisa DPA web + termos
- [ ] Validar bases Art. 11 (saúde) para formulários e prontuário
- [ ] Validar textos de consentimento marketing

## 5. Segurança imediata

- [ ] `npm audit` — corrigir CVEs críticos do Next.js
- [ ] `CRON_SECRET` configurado em produção
- [ ] Buckets privados: `patient-photos`, `exams`, `whatsapp-media`
- [ ] Não publicar claims comerciais de “100% conforme LGPD”

## Evidências a arquivar

| Item | Local sugerido |
|------|----------------|
| Print backups Supabase | Drive compliance / ticket |
| Termo nomeação DPO | Jurídico |
| Log execução migrations | SQL Editor history |
| Parecer jurídico DPA | Jurídico |
