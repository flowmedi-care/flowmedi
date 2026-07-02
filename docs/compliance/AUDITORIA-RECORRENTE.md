# Auditoria recorrente LGPD

## Mensal — equipe técnica

- [ ] RLS policies ativas em produção (amostra: `patients`, `consultation_notes`, `audit_log`)
- [ ] Buckets storage privados
- [ ] `CRON_SECRET` e webhook HMAC configurados
- [ ] Endpoints debug desabilitados em produção (`ENABLE_API_AUDIT_PANEL` ausente)
- [ ] Logs sem PII desnecessária (amostra Cloud/Vercel)
- [ ] `npm audit` — CVEs críticos
- [ ] Taxa de adoção MFA admin/médico (query Supabase Auth ou amostra manual)
- [ ] Cron `data-retention` executando (logs VPS)

## Trimestral — DPO + jurídico

- [ ] ROPA atualizado (`ROPA.md` + revisão formal `ROPA-REVISAO-TRIMESTRAL.md`)
- [ ] RIPD revisado se mudou IA ou novo dado sensível
- [ ] Versão política (`getPrivacyPolicyVersion()`) coerente com produção
- [ ] DPAs subprocessadores (`DPAS-SUBPROCESSADORES.md`)
- [ ] Amostra contratos clínicas com DPA aceito (`accepted_dpa_at`)
- [ ] Teste restore backup (evidência)

## Anual — jurídico + direção

- [ ] Revisão termos + DPA
- [ ] Seguro cyber (`SEGURO-CYBER.md`)
- [ ] Registro de incidentes do ano
- [ ] Pentest ou bug bounty (se orçamento)

## Responsáveis

| Área | Responsável |
|------|-------------|
| Técnico | CTO / lead dev |
| Documental | Encarregado |
| Contratos | Jurídico externo |
| Incidentes | DPO + CTO |
