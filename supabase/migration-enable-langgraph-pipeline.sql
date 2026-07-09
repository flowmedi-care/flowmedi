-- Deploy checklist: ative LangGraph para a clínica de teste após deploy.
-- Substitua o clinic_id pelo da sua clínica antes de executar.
--
-- SELECT use_langgraph_pipeline, langgraph_shadow_mode, enabled
-- FROM public.clinic_virtual_assistant_settings
-- WHERE clinic_id = '00000000-0000-0000-0000-000000000000';
--
-- UPDATE public.clinic_virtual_assistant_settings
-- SET use_langgraph_pipeline = true
-- WHERE clinic_id = '00000000-0000-0000-0000-000000000000';
--
-- Nos eventos whatsapp_ai_events, confirme langgraph_start / langgraph_complete
-- e reply_source != compose_llm para "Oi" e "Quero agendar".
COMMENT ON COLUMN public.clinic_virtual_assistant_settings.use_langgraph_pipeline IS
  'Quando true, o LangGraph responde ao paciente. Recomendado após validar continuidade de agendamento.';
