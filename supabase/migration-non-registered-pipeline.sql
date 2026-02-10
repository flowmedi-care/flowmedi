-- Migration: Pipeline de não cadastrados e histórico de ações
-- Execute no SQL Editor do Supabase

-- ========== TABELA DE PIPELINE DE NÃO CADASTRADOS ==========
CREATE TABLE IF NOT EXISTS public.non_registered_pipeline (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  phone text,
  birth_date date,
  custom_fields jsonb DEFAULT '{}',
  stage text NOT NULL DEFAULT 'novo_contato' CHECK (stage IN ('novo_contato', 'aguardando_retorno', 'agendado', 'registrado', 'arquivado')),
  last_contact_at timestamptz,
  next_action text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, email)
);

CREATE INDEX IF NOT EXISTS idx_non_registered_pipeline_clinic ON public.non_registered_pipeline(clinic_id);
CREATE INDEX IF NOT EXISTS idx_non_registered_pipeline_stage ON public.non_registered_pipeline(stage);
CREATE INDEX IF NOT EXISTS idx_non_registered_pipeline_email ON public.non_registered_pipeline(email);

-- ========== TABELA DE HISTÓRICO DE AÇÕES ==========
CREATE TABLE IF NOT EXISTS public.non_registered_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id uuid NOT NULL REFERENCES public.non_registered_pipeline(id) ON DELETE CASCADE,
  action_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('stage_change', 'note_added', 'contact_made', 'registered', 'archived')),
  old_stage text,
  new_stage text,
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_non_registered_history_pipeline ON public.non_registered_history(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_non_registered_history_action_by ON public.non_registered_history(action_by);
CREATE INDEX IF NOT EXISTS idx_non_registered_history_created_at ON public.non_registered_history(created_at DESC);

-- ========== TABELA DE PREFERÊNCIAS DO DASHBOARD ==========
CREATE TABLE IF NOT EXISTS public.dashboard_preferences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  show_compliance boolean NOT NULL DEFAULT true,
  show_metrics boolean NOT NULL DEFAULT true,
  show_pipeline boolean NOT NULL DEFAULT true,
  show_upcoming_appointments boolean NOT NULL DEFAULT true,
  show_recent_activity boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_preferences_profile ON public.dashboard_preferences(profile_id);

-- ========== HABILITAR RLS ==========
ALTER TABLE public.non_registered_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.non_registered_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- ========== POLÍTICAS RLS PARA PIPELINE ==========
-- Secretárias e admins podem ver pipeline da própria clínica
CREATE POLICY "pipeline_select_clinic"
  ON public.non_registered_pipeline FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND active = true
    )
  );

-- Secretárias e admins podem inserir na pipeline da própria clínica
CREATE POLICY "pipeline_insert_clinic"
  ON public.non_registered_pipeline FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND active = true
    )
  );

-- Secretárias e admins podem atualizar pipeline da própria clínica
CREATE POLICY "pipeline_update_clinic"
  ON public.non_registered_pipeline FOR UPDATE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND active = true
    )
  );

-- ========== POLÍTICAS RLS PARA HISTÓRICO ==========
-- Secretárias e admins podem ver histórico da própria clínica
CREATE POLICY "history_select_clinic"
  ON public.non_registered_history FOR SELECT
  USING (
    pipeline_id IN (
      SELECT id FROM public.non_registered_pipeline
      WHERE clinic_id IN (
        SELECT clinic_id FROM public.profiles 
        WHERE id = auth.uid() AND active = true
      )
    )
  );

-- Secretárias e admins podem inserir histórico
CREATE POLICY "history_insert_clinic"
  ON public.non_registered_history FOR INSERT
  WITH CHECK (
    pipeline_id IN (
      SELECT id FROM public.non_registered_pipeline
      WHERE clinic_id IN (
        SELECT clinic_id FROM public.profiles 
        WHERE id = auth.uid() AND active = true
      )
    )
    AND action_by = auth.uid()
  );

-- ========== POLÍTICAS RLS PARA PREFERÊNCIAS ==========
-- Cada usuário pode ver e gerenciar suas próprias preferências
CREATE POLICY "preferences_select_own"
  ON public.dashboard_preferences FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "preferences_insert_own"
  ON public.dashboard_preferences FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "preferences_update_own"
  ON public.dashboard_preferences FOR UPDATE
  USING (profile_id = auth.uid());

-- ========== TRIGGER PARA ATUALIZAR updated_at ==========
CREATE OR REPLACE FUNCTION update_non_registered_pipeline_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_non_registered_pipeline_updated_at
  BEFORE UPDATE ON public.non_registered_pipeline
  FOR EACH ROW
  EXECUTE FUNCTION update_non_registered_pipeline_updated_at();

-- ========== COMENTÁRIOS ==========
COMMENT ON TABLE public.non_registered_pipeline IS 'Pipeline de gestão de pessoas não cadastradas que preencheram formulários públicos';
COMMENT ON COLUMN public.non_registered_pipeline.stage IS 'Etapa atual: novo_contato, aguardando_retorno, agendado, registrado, arquivado';
COMMENT ON TABLE public.non_registered_history IS 'Histórico de ações realizadas no pipeline de não cadastrados';
COMMENT ON TABLE public.dashboard_preferences IS 'Preferências de visualização do dashboard por usuário';
