-- Migration: Templates padrão do sistema + header/footer de email
-- 1. Tabela system_message_templates (padrões por evento/canal; não têm clinic_id)
-- 2. Colunas email_header e email_footer em message_templates (e no sistema)
-- 3. Seed: um template padrão por (event_code, channel) para todos os message_events
-- Regra: templates do sistema não são editáveis; ao editar, cria-se uma cópia em message_templates da clínica.

-- ========== 1. COLUNAS HEADER/FOOTER EM MESSAGE_TEMPLATES ==========
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS email_header text,
  ADD COLUMN IF NOT EXISTS email_footer text;

COMMENT ON COLUMN public.message_templates.email_header IS 'Cabeçalho do email (editável; só para channel=email)';
COMMENT ON COLUMN public.message_templates.email_footer IS 'Rodapé do email (editável; só para channel=email)';

-- ========== 2. TABELA SYSTEM_MESSAGE_TEMPLATES ==========
CREATE TABLE IF NOT EXISTS public.system_message_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_code text NOT NULL REFERENCES public.message_events(code) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  name text NOT NULL,
  subject text,
  body_html text NOT NULL DEFAULT '',
  body_text text,
  email_header text,
  email_footer text,
  variables_used jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_code, channel)
);

COMMENT ON TABLE public.system_message_templates IS 'Templates padrão do sistema. Não têm clinic_id; ao editar na UI, cria-se cópia em message_templates.';
CREATE INDEX IF NOT EXISTS idx_system_message_templates_event_channel ON public.system_message_templates(event_code, channel);

ALTER TABLE public.system_message_templates ENABLE ROW LEVEL SECURITY;
-- Leitura para todos autenticados (para exibir padrão quando clínica não tem template próprio)
CREATE POLICY "system_message_templates_read_all"
  ON public.system_message_templates FOR SELECT USING (true);
-- Inserir/atualizar apenas via migrations ou service role (sem policy de INSERT/UPDATE para users)

-- ========== 3. SEED: UM TEMPLATE PADRÃO POR (event_code, channel) ==========
-- Usamos um corpo genérico por categoria para reduzir redundância; variáveis comuns em todos.
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, email_header, email_footer, variables_used)
SELECT
  me.code,
  ch.channel,
  me.name || ' - ' || CASE ch.channel WHEN 'email' THEN 'Email' ELSE 'WhatsApp' END,
  CASE WHEN ch.channel = 'email' THEN '{{nome_clinica}}: ' || me.name ELSE NULL END,
  CASE
    WHEN ch.channel = 'email' THEN
      '<p>Olá {{nome_paciente}},</p><p>Segue informação sobre sua consulta.</p><p><strong>Data/hora:</strong> {{data_hora_consulta}}</p><p><strong>Médico(a):</strong> {{nome_medico}}</p><p>{{nome_clinica}}</p>'
    ELSE
      'Olá {{nome_paciente}}! ' || me.name || '. Data/hora: {{data_hora_consulta}}. Médico(a): {{nome_medico}}. {{nome_clinica}}.'
  END,
  CASE WHEN ch.channel = 'whatsapp' THEN 'Olá {{nome_paciente}}! ' || me.name || '. Data/hora: {{data_hora_consulta}}. Médico(a): {{nome_medico}}. {{nome_clinica}}.' ELSE NULL END,
  CASE WHEN ch.channel = 'email' THEN '<div style="font-size:12px;color:#666;">{{nome_clinica}} | {{telefone_clinica}}</div>' ELSE NULL END,
  CASE WHEN ch.channel = 'email' THEN '<div style="margin-top:24px;font-size:11px;color:#999;">Este é um email automático. Em caso de dúvidas, entre em contato com a clínica.</div>' ELSE NULL END,
  '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}","{{telefone_clinica}}"]'::jsonb
FROM public.message_events me
CROSS JOIN (VALUES ('email'), ('whatsapp')) AS ch(channel)
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  email_header = EXCLUDED.email_header,
  email_footer = EXCLUDED.email_footer,
  variables_used = EXCLUDED.variables_used,
  updated_at = now();

-- ========== 4. PENDING_MESSAGES: template_id opcional (quando usa template do sistema) ==========
ALTER TABLE public.pending_messages
  DROP CONSTRAINT IF EXISTS pending_messages_template_id_fkey;
ALTER TABLE public.pending_messages
  ALTER COLUMN template_id DROP NOT NULL;
ALTER TABLE public.pending_messages
  ADD CONSTRAINT pending_messages_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.message_templates(id) ON DELETE SET NULL;

-- Guardar assunto processado para envio quando template_id for null (template do sistema)
ALTER TABLE public.pending_messages
  ADD COLUMN IF NOT EXISTS processed_subject text;
COMMENT ON COLUMN public.pending_messages.processed_subject IS 'Assunto já processado (usado quando template_id é null, ex. template do sistema)';
