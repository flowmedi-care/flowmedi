-- Duração sugerida por procedimento (substitui appointment_types na agenda).
-- Backfill a partir do tipo de consulta padrão vinculado ao procedimento.

ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS duration_minutes int DEFAULT 30;

COMMENT ON COLUMN public.procedures.duration_minutes IS
  'Duração padrão em minutos para sugerir horário final na agenda. Editável pela secretária ao agendar.';

UPDATE public.procedures p
SET duration_minutes = COALESCE(at.duration_minutes, 30)
FROM public.appointment_types at
WHERE p.default_appointment_type_id = at.id
  AND (p.duration_minutes IS NULL OR p.duration_minutes = 30);

-- Procedimentos de retorno: slug no nome (case-insensitive) ou tipo padrão retorno
UPDATE public.procedures p
SET duration_minutes = COALESCE(at.duration_minutes, 30)
FROM public.appointment_types at
WHERE at.clinic_id = p.clinic_id
  AND at.slug = 'retorno'
  AND lower(trim(p.name)) = 'retorno'
  AND p.default_appointment_type_id IS NULL;

-- Garantir procedimento "Retorno" por clínica (para Agendar retorno na recepção)
INSERT INTO public.procedures (clinic_id, name, recommendations, display_order, duration_minutes, default_service_id)
SELECT
  c.id,
  'Retorno',
  NULL,
  COALESCE(
    (SELECT MAX(p2.display_order) + 1 FROM public.procedures p2 WHERE p2.clinic_id = c.id),
    0
  ),
  COALESCE(at.duration_minutes, 30),
  (
    SELECT s.id
    FROM public.services s
    WHERE s.clinic_id = c.id
      AND lower(trim(s.nome)) = 'retorno'
    LIMIT 1
  )
FROM public.clinics c
LEFT JOIN public.appointment_types at
  ON at.clinic_id = c.id AND at.slug = 'retorno'
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p
  WHERE p.clinic_id = c.id AND lower(trim(p.name)) = 'retorno'
);
