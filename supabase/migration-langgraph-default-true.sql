-- LangGraph is the sole runtime; default on for new clinics and deprecate shadow mode.
ALTER TABLE public.clinic_virtual_assistant_settings
  ALTER COLUMN use_langgraph_pipeline SET DEFAULT true;

UPDATE public.clinic_virtual_assistant_settings
SET use_langgraph_pipeline = true,
    langgraph_shadow_mode = false
WHERE use_langgraph_pipeline = false OR langgraph_shadow_mode = true;

COMMENT ON COLUMN public.clinic_virtual_assistant_settings.use_langgraph_pipeline IS
  'Quando true (padrão), process-inbound usa exclusivamente o grafo LangGraph.';

COMMENT ON COLUMN public.clinic_virtual_assistant_settings.langgraph_shadow_mode IS
  'Deprecado — mantido por compatibilidade; sempre false.';
