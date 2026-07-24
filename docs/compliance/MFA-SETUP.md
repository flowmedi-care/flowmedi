# MFA — DESCONTINUADO

> **Status:** MFA TOTP foi **removido do produto** (jul/2026).  
> Login usa confirmação de e-mail + `/api/auth/sign-in` (rate limit, reCAPTCHA progressivo, logs).  
> Ver: [`docs/AUTH-LOGIN-HARDENING.md`](../AUTH-LOGIN-HARDENING.md).

## Ações no Supabase

1. Authentication → MFA → **desativar** TOTP
2. Unenroll factors TOTP de usuários existentes
3. Manter **Confirm email** ativo

O restante deste documento descreve o fluxo antigo e não deve ser seguido.
