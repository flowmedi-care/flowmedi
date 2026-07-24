-- Auth security events (pre-login / abuse protection). No plaintext emails.
CREATE TABLE IF NOT EXISTS public.auth_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  reason text NOT NULL,
  email_hash text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.auth_security_events IS
  'Eventos de autenticação (login, captcha, rate limit). email_hash = SHA-256(email normalizado).';

CREATE INDEX IF NOT EXISTS idx_auth_security_events_created_at
  ON public.auth_security_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_reason
  ON public.auth_security_events (reason);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_email_hash
  ON public.auth_security_events (email_hash)
  WHERE email_hash IS NOT NULL;

ALTER TABLE public.auth_security_events ENABLE ROW LEVEL SECURITY;

-- Sem policies para authenticated: somente service role (bypass RLS) escreve/lê.
