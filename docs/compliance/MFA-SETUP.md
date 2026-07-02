# MFA — Configuração Supabase Auth

## Dashboard Supabase

1. Authentication → Providers → confirmar e-mail obrigatório
2. Authentication → MFA → habilitar TOTP para o projeto
3. (Opcional) Política de senha mínima 8+ caracteres no Dashboard

## Aplicação FlowMed

- Página `/dashboard/configuracoes/seguranca` — enrollment TOTP via Supabase MFA API
- Banner `MfaReminderBanner` no dashboard quando MFA ausente

## Recomendação

Exigir MFA para perfis `admin` e `medico` após período de adaptação (comunicar clínicas com 30 dias de antecedência).

**Lacuna:** enforcement obrigatório no login ainda não implementado — apenas lembrete e página de setup.
