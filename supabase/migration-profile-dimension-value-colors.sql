-- Preferências de cor por valor de dimensão (perfil do médico): override da cor exibida na agenda
CREATE TABLE IF NOT EXISTS public.profile_dimension_value_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dimension_value_id uuid NOT NULL REFERENCES public.dimension_values(id) ON DELETE CASCADE,
  cor text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, dimension_value_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_dimension_value_colors_profile_id
  ON public.profile_dimension_value_colors(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_dimension_value_colors_dimension_value_id
  ON public.profile_dimension_value_colors(dimension_value_id);

ALTER TABLE public.profile_dimension_value_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_dimension_value_colors_own"
  ON public.profile_dimension_value_colors
  FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

COMMENT ON TABLE public.profile_dimension_value_colors IS 'Cores personalizadas por valor de dimensão para exibição na agenda (preferência do médico).';
