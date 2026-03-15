-- Adiciona template canônico para consulta com formulário.
-- Necessário para suportar envio fora da janela de 24h sem erro de parâmetros.

DO $$
DECLARE
  current_constraint_name text;
BEGIN
  -- clinic_whatsapp_meta_templates
  SELECT con.conname
  INTO current_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'clinic_whatsapp_meta_templates'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%template_key IN%';

  IF current_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.clinic_whatsapp_meta_templates DROP CONSTRAINT %I',
      current_constraint_name
    );
  END IF;

  ALTER TABLE public.clinic_whatsapp_meta_templates
  DROP CONSTRAINT IF EXISTS clinic_whatsapp_meta_templates_template_key_check;

  ALTER TABLE public.clinic_whatsapp_meta_templates
  ADD CONSTRAINT clinic_whatsapp_meta_templates_template_key_check
  CHECK (
    template_key IN (
      'flowmedi_consulta',
      'flowmedi_agenda_com_formulario',
      'flowmedi_formulario',
      'flowmedi_aviso',
      'flowmedi_mensagem_livre'
    )
  );

  -- clinic_meta_message_models
  SELECT con.conname
  INTO current_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'clinic_meta_message_models'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%template_key in%';

  IF current_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.clinic_meta_message_models DROP CONSTRAINT %I',
      current_constraint_name
    );
  END IF;

  ALTER TABLE public.clinic_meta_message_models
  DROP CONSTRAINT IF EXISTS clinic_meta_message_models_template_key_check;

  ALTER TABLE public.clinic_meta_message_models
  ADD CONSTRAINT clinic_meta_message_models_template_key_check
  CHECK (
    template_key IN (
      'flowmedi_consulta',
      'flowmedi_agenda_com_formulario',
      'flowmedi_formulario',
      'flowmedi_aviso',
      'flowmedi_mensagem_livre'
    )
  );
END $$;
