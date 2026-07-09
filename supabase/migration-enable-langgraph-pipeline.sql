-- Ativa o pipeeline LangGraph para responder ao paciente (não só shadow).
-- Substitua o clinic_id pelo da sua clínica de teste antes de executar.
--
-- UPDATE public.clinic_virtual_assistant_settings
-- SET use_langgraph_pipeline = true
-- WHERE clinic_id = '00000000-0000-0000-0000-000000000000';
--
-- Opcional: manter shadow ligado por alguns dias para comparar logs:
-- UPDATE public.clinic_virtual_assistant_settings
-- SET langgraph_shadow_mode = true
-- WHERE clinic_id = '00000000-0000-0000-0000-000000000000';

COMMENT ON COLUMN public.clinic_virtual_assistant_settings.use_langgraph_pipeline IS
  'Quando true, o LangGraph responde ao paciente. Recomendado após validar continuidade de agendamento.';
