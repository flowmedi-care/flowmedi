# Checklist manual — MFA off + login harden

Após o deploy do código, complete no Supabase / Google:

## Supabase Auth

1. **Authentication → MFA** (ou Multi-Factor): desative TOTP / authenticator apps.
2. Para cada usuário que já tinha MFA: **Authentication → Users → [user] → Factors** → unenroll / remove TOTP.
3. Mantenha **Confirm email** ativo (cadastro continua exigindo confirmação de e-mail).

## Google reCAPTCHA v2

1. Crie um site em https://www.google.com/recaptcha/admin (tipo **v2 Checkbox**).
2. Domínios: `localhost`, hostname de produção (ex.: `flowmed.app`, `www.flowmed.app`).
3. Defina no ambiente (Vercel / `.env.local`):
   - `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
   - `RECAPTCHA_SECRET_KEY`

## Banco

Rode a migration [`supabase/migration-auth-security-events.sql`](../supabase/migration-auth-security-events.sql) no projeto (SQL Editor ou pipeline de migrations).

## Verificação rápida

- [ ] Login e-mail/senha sem passo MFA
- [ ] `/entrar` com sessão já salva → dashboard
- [ ] Após 1 falha de senha, API responde `requireCaptcha: true` e o widget aparece
- [ ] Rate limit retorna 429
- [ ] OAuth Google continua funcionando (fora da API)
- [ ] Esqueci senha limitado (3/hora)
