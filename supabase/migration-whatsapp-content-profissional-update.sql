-- Migration: padronizar linguagem user-facing de "médico" para "profissional"
-- Escopo: conteúdo textual (sem alterar estrutura técnica como role/doctor_id/nome_medico)
-- Objetivo: aplicar em bases já existentes (produção/homologação) de forma idempotente

DO $$
BEGIN
  -- system_message_templates.body_html
  UPDATE public.system_message_templates
  SET body_html = regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(body_html, 'Médico\\(a\\):', 'Profissional:', 'gi'),
          '\\bcom\\s+<strong>\\{\\{nome_medico\\}\\}</strong>',
          'com o profissional <strong>{{nome_medico}}</strong>',
          'gi'
        ),
        '\\bcom\\s+\\{\\{nome_medico\\}\\}',
        'com o profissional {{nome_medico}}',
        'gi'
      ),
      '\\bconsulta\\s+com\\s+o\\s+dr\\b',
      'consulta com o profissional',
      'gi'
    )
  WHERE body_html IS NOT NULL
    AND (
      body_html ~* 'Médico\\(a\\):'
      OR body_html ~* '\\bcom\\s+\\{\\{nome_medico\\}\\}'
      OR body_html ~* '\\bcom\\s+<strong>\\{\\{nome_medico\\}\\}</strong>'
      OR body_html ~* '\\bconsulta\\s+com\\s+o\\s+dr\\b'
    );

  -- system_message_templates.body_text
  UPDATE public.system_message_templates
  SET body_text = regexp_replace(
      regexp_replace(
        regexp_replace(body_text, 'Médico\\(a\\):', 'Profissional:', 'gi'),
        '\\bcom\\s+\\{\\{nome_medico\\}\\}',
        'com o profissional {{nome_medico}}',
        'gi'
      ),
      '\\bconsulta\\s+com\\s+o\\s+dr\\b',
      'consulta com o profissional',
      'gi'
    )
  WHERE body_text IS NOT NULL
    AND (
      body_text ~* 'Médico\\(a\\):'
      OR body_text ~* '\\bcom\\s+\\{\\{nome_medico\\}\\}'
      OR body_text ~* '\\bconsulta\\s+com\\s+o\\s+dr\\b'
    );

  -- system_message_templates.whatsapp_meta_phrase
  UPDATE public.system_message_templates
  SET whatsapp_meta_phrase = regexp_replace(
      regexp_replace(whatsapp_meta_phrase, 'Médico\\(a\\):', 'Profissional:', 'gi'),
      '\\bconsulta\\s+com\\s+o\\s+dr\\b',
      'consulta com o profissional',
      'gi'
    )
  WHERE whatsapp_meta_phrase IS NOT NULL
    AND (
      whatsapp_meta_phrase ~* 'Médico\\(a\\):'
      OR whatsapp_meta_phrase ~* '\\bconsulta\\s+com\\s+o\\s+dr\\b'
    );

  -- message_templates.body_html
  UPDATE public.message_templates
  SET body_html = regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(body_html, 'Médico\\(a\\):', 'Profissional:', 'gi'),
          '\\bcom\\s+<strong>\\{\\{nome_medico\\}\\}</strong>',
          'com o profissional <strong>{{nome_medico}}</strong>',
          'gi'
        ),
        '\\bcom\\s+\\{\\{nome_medico\\}\\}',
        'com o profissional {{nome_medico}}',
        'gi'
      ),
      '\\bconsulta\\s+com\\s+o\\s+dr\\b',
      'consulta com o profissional',
      'gi'
    )
  WHERE body_html IS NOT NULL
    AND (
      body_html ~* 'Médico\\(a\\):'
      OR body_html ~* '\\bcom\\s+\\{\\{nome_medico\\}\\}'
      OR body_html ~* '\\bcom\\s+<strong>\\{\\{nome_medico\\}\\}</strong>'
      OR body_html ~* '\\bconsulta\\s+com\\s+o\\s+dr\\b'
    );

  -- message_templates.body_text
  UPDATE public.message_templates
  SET body_text = regexp_replace(
      regexp_replace(
        regexp_replace(body_text, 'Médico\\(a\\):', 'Profissional:', 'gi'),
        '\\bcom\\s+\\{\\{nome_medico\\}\\}',
        'com o profissional {{nome_medico}}',
        'gi'
      ),
      '\\bconsulta\\s+com\\s+o\\s+dr\\b',
      'consulta com o profissional',
      'gi'
    )
  WHERE body_text IS NOT NULL
    AND (
      body_text ~* 'Médico\\(a\\):'
      OR body_text ~* '\\bcom\\s+\\{\\{nome_medico\\}\\}'
      OR body_text ~* '\\bconsulta\\s+com\\s+o\\s+dr\\b'
    );

  -- message_templates.whatsapp_meta_phrase
  UPDATE public.message_templates
  SET whatsapp_meta_phrase = regexp_replace(
      regexp_replace(whatsapp_meta_phrase, 'Médico\\(a\\):', 'Profissional:', 'gi'),
      '\\bconsulta\\s+com\\s+o\\s+dr\\b',
      'consulta com o profissional',
      'gi'
    )
  WHERE whatsapp_meta_phrase IS NOT NULL
    AND (
      whatsapp_meta_phrase ~* 'Médico\\(a\\):'
      OR whatsapp_meta_phrase ~* '\\bconsulta\\s+com\\s+o\\s+dr\\b'
    );

  -- doctor_referral_codes.custom_message
  UPDATE public.doctor_referral_codes
  SET custom_message = regexp_replace(
      regexp_replace(custom_message, '\\bconsulta\\s+com\\s+o\\s+dr\\b', 'consulta com o profissional', 'gi'),
      '\\bdr\\.?\\s+\\[seu nome\\]',
      'profissional [seu nome]',
      'gi'
    )
  WHERE custom_message IS NOT NULL
    AND (
      custom_message ~* '\\bconsulta\\s+com\\s+o\\s+dr\\b'
      OR custom_message ~* '\\bdr\\.?\\s+\\[seu nome\\]'
    );
END $$;
