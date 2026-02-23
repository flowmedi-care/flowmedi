-- Sistema de Serviços e Preços por dimensões (Cidade, Convênio, Unidade, Turno, Campanha, etc.)
-- Médico e admin definem serviços, dimensões, valores das dimensões e regras de preço.
-- No agendamento a secretária escolhe serviço + dimensões (cadastrados) e o sistema resolve o valor.

-- Garantir função de RLS (se já existir, não quebra)
CREATE OR REPLACE FUNCTION public.get_my_clinic_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT clinic_id FROM public.profiles
  WHERE id = auth.uid() AND COALESCE(active, true) = true
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_clinic_id() TO authenticated;

-- ========== 1. SERVIÇOS (o que é feito: consulta geral, botox, colonoscopia, etc.) ==========
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  nome text NOT NULL,
  categoria text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON public.services(clinic_id);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_clinic"
  ON public.services FOR ALL
  USING (clinic_id = public.get_my_clinic_id())
  WITH CHECK (clinic_id = public.get_my_clinic_id());

COMMENT ON TABLE public.services IS 'Serviços da clínica (consulta geral, botox, colonoscopia, etc.). Usado para preços e relatórios.';

-- ========== 2. DIMENSÕES DE PREÇO (tipos de fator: Cidade, Convênio, Unidade, Turno, Campanha) ==========
CREATE TABLE IF NOT EXISTS public.price_dimensions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_dimensions_clinic_id ON public.price_dimensions(clinic_id);
ALTER TABLE public.price_dimensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_dimensions_clinic"
  ON public.price_dimensions FOR ALL
  USING (clinic_id = public.get_my_clinic_id())
  WITH CHECK (clinic_id = public.get_my_clinic_id());

COMMENT ON TABLE public.price_dimensions IS 'Tipos de fator para preço: Cidade, Convênio, Unidade, Turno, Campanha, etc.';

-- ========== 3. VALORES DAS DIMENSÕES (ex: Cidade → X, Y; Convênio → Unimed, SUS, Particular) ==========
CREATE TABLE IF NOT EXISTS public.dimension_values (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  dimension_id uuid NOT NULL REFERENCES public.price_dimensions(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dimension_values_clinic_id ON public.dimension_values(clinic_id);
CREATE INDEX IF NOT EXISTS idx_dimension_values_dimension_id ON public.dimension_values(dimension_id);
ALTER TABLE public.dimension_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dimension_values_clinic"
  ON public.dimension_values FOR ALL
  USING (clinic_id = public.get_my_clinic_id())
  WITH CHECK (clinic_id = public.get_my_clinic_id());

COMMENT ON TABLE public.dimension_values IS 'Valores possíveis por dimensão (ex: Unimed, SUS, Particular para Convênio).';

-- ========== 4. REGRAS DE PREÇO (serviço + opcionalmente profissional + valor) ==========
CREATE TABLE IF NOT EXISTS public.service_prices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  valor numeric(12,2) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_prices_clinic_id ON public.service_prices(clinic_id);
CREATE INDEX IF NOT EXISTS idx_service_prices_service_id ON public.service_prices(service_id);
CREATE INDEX IF NOT EXISTS idx_service_prices_professional_id ON public.service_prices(professional_id);
ALTER TABLE public.service_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_prices_clinic"
  ON public.service_prices FOR ALL
  USING (clinic_id = public.get_my_clinic_id())
  WITH CHECK (clinic_id = public.get_my_clinic_id());

COMMENT ON TABLE public.service_prices IS 'Regra de preço: serviço (e opcionalmente profissional) com um valor. Combinada com price_rule_dimension_values.';

-- ========== 5. PIVOT: quais dimension_values compõem cada regra de preço ==========
CREATE TABLE IF NOT EXISTS public.price_rule_dimension_values (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_price_id uuid NOT NULL REFERENCES public.service_prices(id) ON DELETE CASCADE,
  dimension_value_id uuid NOT NULL REFERENCES public.dimension_values(id) ON DELETE CASCADE,
  UNIQUE(service_price_id, dimension_value_id)
);

CREATE INDEX IF NOT EXISTS idx_prdv_service_price_id ON public.price_rule_dimension_values(service_price_id);
CREATE INDEX IF NOT EXISTS idx_prdv_dimension_value_id ON public.price_rule_dimension_values(dimension_value_id);
ALTER TABLE public.price_rule_dimension_values ENABLE ROW LEVEL SECURITY;

-- Acesso via service_prices (clinic_id)
CREATE POLICY "price_rule_dimension_values_via_service_price"
  ON public.price_rule_dimension_values FOR ALL
  USING (
    service_price_id IN (
      SELECT id FROM public.service_prices WHERE clinic_id = public.get_my_clinic_id()
    )
  )
  WITH CHECK (
    service_price_id IN (
      SELECT id FROM public.service_prices WHERE clinic_id = public.get_my_clinic_id()
    )
  );

COMMENT ON TABLE public.price_rule_dimension_values IS 'Liga uma regra de preço às dimension_values (ex: regra Botox+Dr João = Unimed + Cidade X).';

-- ========== 6. APPOINTMENTS: serviço e valor no agendamento ==========
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS valor numeric(12,2);

CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON public.appointments(service_id);
COMMENT ON COLUMN public.appointments.service_id IS 'Serviço cobrado (para preço e relatórios).';
COMMENT ON COLUMN public.appointments.valor IS 'Valor da consulta no momento do agendamento (resolvido pelas regras de preço).';

-- ========== 7. Valores de dimensão selecionados no agendamento (para relatórios) ==========
CREATE TABLE IF NOT EXISTS public.appointment_dimension_values (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  dimension_value_id uuid NOT NULL REFERENCES public.dimension_values(id) ON DELETE CASCADE,
  UNIQUE(appointment_id, dimension_value_id)
);

CREATE INDEX IF NOT EXISTS idx_appointment_dimension_values_appointment_id ON public.appointment_dimension_values(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_dimension_values_dimension_value_id ON public.appointment_dimension_values(dimension_value_id);
ALTER TABLE public.appointment_dimension_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_dimension_values_via_appointment"
  ON public.appointment_dimension_values FOR ALL
  USING (
    appointment_id IN (
      SELECT id FROM public.appointments WHERE clinic_id = public.get_my_clinic_id()
    )
  )
  WITH CHECK (
    appointment_id IN (
      SELECT id FROM public.appointments WHERE clinic_id = public.get_my_clinic_id()
    )
  );

COMMENT ON TABLE public.appointment_dimension_values IS 'Dimensões escolhidas no agendamento (ex: Convênio=Unimed, Cidade=X) para relatórios.';
