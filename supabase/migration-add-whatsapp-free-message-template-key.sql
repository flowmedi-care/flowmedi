-- Adiciona o template canônico de mensagem livre para uso fora da janela de 24h.

DO $$
DECLARE
  current_constraint_name text;
BEGIN
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
END $$;

ALTER TABLE public.clinic_whatsapp_meta_templates
ADD CONSTRAINT clinic_whatsapp_meta_templates_template_key_check
CHECK (
  template_key IN (
    'flowmedi_consulta',
    'flowmedi_formulario',
    'flowmedi_aviso',
    'flowmedi_mensagem_livre'
  )
);
