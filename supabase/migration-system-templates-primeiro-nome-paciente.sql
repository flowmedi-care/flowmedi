-- Atualiza templates do sistema para usar primeiro nome do paciente
-- em vez do nome completo.
--
-- Escopo: apenas public.system_message_templates.

UPDATE public.system_message_templates
SET
  subject = CASE
    WHEN subject IS NULL THEN NULL
    ELSE REPLACE(subject, '{{nome_paciente}}', '{{primeiro_nome_paciente}}')
  END,
  body_html = CASE
    WHEN body_html IS NULL THEN NULL
    ELSE REPLACE(body_html, '{{nome_paciente}}', '{{primeiro_nome_paciente}}')
  END,
  body_text = CASE
    WHEN body_text IS NULL THEN NULL
    ELSE REPLACE(body_text, '{{nome_paciente}}', '{{primeiro_nome_paciente}}')
  END,
  variables_used = (
    SELECT COALESCE(
      jsonb_agg(
        to_jsonb(
          CASE
            WHEN v.value = '{{nome_paciente}}' THEN '{{primeiro_nome_paciente}}'
            ELSE v.value
          END
        )
        ORDER BY v.ord
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements_text(COALESCE(system_message_templates.variables_used, '[]'::jsonb))
      WITH ORDINALITY AS v(value, ord)
  ),
  updated_at = now()
WHERE
  (subject IS NOT NULL AND subject LIKE '%{{nome_paciente}}%')
  OR (body_html IS NOT NULL AND body_html LIKE '%{{nome_paciente}}%')
  OR (body_text IS NOT NULL AND body_text LIKE '%{{nome_paciente}}%')
  OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(system_message_templates.variables_used, '[]'::jsonb)) AS vu(value)
    WHERE vu.value = '{{nome_paciente}}'
  );
