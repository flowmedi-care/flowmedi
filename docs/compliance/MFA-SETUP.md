# MFA — Configuração Supabase Auth e fluxo FlowMed

## Dashboard Supabase

1. Authentication → Providers → confirmar e-mail obrigatório
2. Authentication → MFA → habilitar TOTP para o projeto
3. Política de senha mínima 8+ caracteres no Dashboard (complementa validação no signup)

## Política de produto (MfaPolicy)

Fonte de verdade: `lib/compliance/policies/mfa-policy.ts`

- Default: `mode: "optional"` — enrollment **não** é forçado
- Quem **já cadastrou** TOTP continua sendo desafiado no login (`challengeMfa`)
- Banner de incentivo quando não enrolled (`showReminderBanner`)
- Modos futuros sem alterar middleware: `required_for_admins` | `required_for_all` | `custom`

Consumers aplicam só `AuthenticationDecision` via `decideAuthentication` / `resolveAuthenticationDecision`:

- `redirectToWizard`
- `challengeMfa`
- `showReminderBanner`

## Fluxo no FlowMed

### Configuração (wizard voluntário)

- Rota: `/dashboard/onboarding/mfa`
- Acessível a qualquer perfil; não é mais bloqueio obrigatório no default
- Passos: por quê → instalar app → QR + código → conclusão
- Fatores TOTP incompletos (`unverified`) são removidos automaticamente antes de novo enrollment

### Login (cada sessão)

- Rota: `/entrar`
- Após e-mail + senha, se MFA verificado: passo 2 com código de 6 dígitos do app
- Não reescaneia QR — só o código rápido

### Gestão (opcional)

- `/dashboard/configuracoes/seguranca` / Privacidade — reconfigurar ou ver status
- Banner no dashboard se MFA ausente (recomendado, não obrigatório)

## Papéis (default optional)

| Papel | MFA |
|-------|-----|
| admin | Opcional (recomendado) |
| medico | Opcional (recomendado) |
| secretaria | Opcional (recomendado) |

## Arquivos principais

- `lib/compliance/policies/mfa-policy.ts` — MfaPolicy + AuthenticationDecision
- `lib/compliance/mfa-helpers.ts` — fatores verified vs unverified
- `lib/compliance/mfa-service.ts` — enroll, unenroll, verify
- `lib/compliance/mfa-middleware.ts` — aplica `redirectToWizard`
- `components/compliance/mfa-wizard.tsx` — wizard step-by-step
- `components/auth/sign-in-form.tsx` — código TOTP pós-senha

## Troubleshooting

**Erro "A factor with the friendly name already exists"**

Configuração anterior não foi concluída. No wizard ou em Segurança, use **"Remover e recomeçar"** — chama `mfa.unenroll` nos fatores pendentes.
