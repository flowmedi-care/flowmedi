-- Deprecação gradual de appointment_types após unificação com procedimentos + serviços.
-- Colunas mantidas para dados históricos; novos agendamentos não devem preencher appointment_type_id.

COMMENT ON TABLE public.appointment_types IS
  'DEPRECATED: tipos de atendimento legados. Use procedures.duration_minutes e services para agenda/cobrança.';

COMMENT ON COLUMN public.procedures.default_appointment_type_id IS
  'DEPRECATED: use duration_minutes no procedimento. Mantido para migração de dados legados.';

COMMENT ON COLUMN public.appointments.appointment_type_id IS
  'DEPRECATED: use service_id e appointment_procedures. Mantido para consultas históricas.';

COMMENT ON COLUMN public.form_templates.appointment_type_id IS
  'DEPRECATED: prefira vínculo por procedimento (form_template_procedures).';
