# Migrations LGPD — ordem de execução

Execute no SQL Editor do Supabase **nesta ordem**:

1. `supabase/migration-consent-lgpd.sql` — consent settings, DSAR, AI privacy column
2. `supabase/migration-patient-photos-private.sql` — bucket privado
3. `supabase/migration-audit-log-admin-read.sql` — audit log admin-only read
4. `supabase/migration-rls-clinical-sensitive.sql` — least-privilege notas/transcrições
5. `supabase/migration-lgpd-phase2-5.sql` — DPA assinável, DSAR SLA, anonimização, retenção

Checklist operacional completo: `FASE0-CHECKLIST.md`

## Variáveis de ambiente

```env
LGPD_DPO_EMAIL=privacidade@flowmed.app
LGPD_DPO_NAME=Nome do Encarregado
LGPD_COMPANY_LEGAL_NAME=Razão social
```

## Páginas públicas

- `/encarregado-dados`
- `/acordo-tratamento-dados`
- `/subprocessadores`
- `/politica-de-cookies`
- `/privacidade-titular` — portal Art. 18 para pacientes

## Painel

- `/dashboard/privacidade` — hub LGPD (DPA, links)
- `/dashboard/privacidade/solicitacoes` — DSAR com SLA
- `/dashboard/configuracoes/seguranca` — MFA obrigatório admin/médico
- `/dashboard/auditoria` — todos os planos
- Perfil paciente — card de consentimento

## Cron jobs LGPD

```bash
# Retenção logs (semanal)
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://flowmed.app/api/cron/data-retention"
```

## MFA obrigatório

Administradores e médicos são redirecionados para `/dashboard/configuracoes/seguranca` até configurar TOTP.

## Senha forte

Cadastro exige mínimo 8 caracteres com letras e números. Configure política adicional no Supabase Dashboard (Auth → Password).
