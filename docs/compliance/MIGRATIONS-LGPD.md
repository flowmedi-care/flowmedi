# Migrations LGPD — ordem de execução

Execute no SQL Editor do Supabase **nesta ordem**:

1. `supabase/migration-consent-lgpd.sql` — consent settings, DSAR, AI privacy column
2. `supabase/migration-patient-photos-private.sql` — bucket privado
3. `supabase/migration-audit-log-admin-read.sql` — audit log admin-only read
4. `supabase/migration-rls-clinical-sensitive.sql` — least-privilege notas/transcrições

## Variáveis de ambiente

```env
LGPD_DPO_EMAIL=privacidade@flowmed.app
LGPD_DPO_NAME=Nome do Encarregado
LGPD_COMPANY_LEGAL_NAME=Razão social
```

## Páginas públicas novas

- `/encarregado-dados`
- `/acordo-tratamento-dados`
- `/subprocessadores`
- `/politica-de-cookies`

## Painel

- `/dashboard/privacidade/solicitacoes` — DSAR
- `/dashboard/configuracoes/seguranca` — MFA
- Perfil paciente — card de consentimento
