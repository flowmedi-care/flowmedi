# MFA — Configuração Supabase Auth e fluxo FlowMed

## Dashboard Supabase

1. Authentication → Providers → confirmar e-mail obrigatório
2. Authentication → MFA → habilitar TOTP para o projeto
3. Política de senha mínima 8+ caracteres no Dashboard (complementa validação no signup)

## Fluxo no FlowMed

### Configuração única (wizard)

- Rota: `/dashboard/onboarding/mfa`
- **Quando:** admin após criar clínica; médico/admin sem MFA ao acessar o dashboard (middleware)
- Passos: por quê → instalar app → QR + código → conclusão
- Fatores TOTP incompletos (`unverified`) são removidos automaticamente antes de novo enrollment

### Login (cada sessão)

- Rota: `/entrar`
- Após e-mail + senha, se MFA verificado: passo 2 com código de 6 dígitos do app
- Não reescaneia QR — só o código rápido

### Gestão (opcional)

- `/dashboard/configuracoes/seguranca` — reconfigurar ou ver status
- Banner no dashboard se MFA ausente (link para wizard se obrigatório)

## Papéis

| Papel | MFA obrigatório |
|-------|-----------------|
| admin | Sim |
| medico | Sim |
| secretaria | Não (opcional) |

## Arquivos principais

- `lib/compliance/mfa-helpers.ts` — fatores verified vs unverified
- `lib/compliance/mfa-service.ts` — enroll, unenroll, verify
- `lib/compliance/mfa-middleware.ts` — bloqueio só sem enrollment
- `components/compliance/mfa-wizard.tsx` — wizard step-by-step
- `components/auth/sign-in-form.tsx` — código TOTP pós-senha

## Troubleshooting

**Erro "A factor with the friendly name already exists"**

Configuração anterior não foi concluída. No wizard ou em Segurança, use **"Remover e recomeçar"** — chama `mfa.unenroll` nos fatores pendentes.
