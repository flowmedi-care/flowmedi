-- FlowMedi — Schema inicial para Supabase
-- Execute no SQL Editor do seu projeto: https://supabase.com/dashboard → SQL Editor → New query

-- Extensão para UUID (já vem no Supabase, mas garante)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== PLANOS (futuro checkout) ==========
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  max_doctors int,
  max_appointments_per_month int,
  whatsapp_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ========== CLÍNICAS (tenant) ==========
CREATE TABLE IF NOT EXISTS public.clinics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text,
  plan_id uuid REFERENCES public.plans(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========== PERFIS (vínculo auth.users + clínica + papel) ==========
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text NOT NULL CHECK (role IN ('admin', 'medico', 'secretaria')),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========== TIPOS DE CONSULTA / PROCEDIMENTO ==========
CREATE TABLE IF NOT EXISTS public.appointment_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_minutes int DEFAULT 30,
  created_at timestamptz DEFAULT now()
);

-- ========== FORMULÁRIOS (templates) ==========
CREATE TABLE IF NOT EXISTS public.form_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  definition jsonb NOT NULL DEFAULT '[]',
  appointment_type_id uuid REFERENCES public.appointment_types(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========== PACIENTES ==========
CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  birth_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========== CONSULTAS (agenda) ==========
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_type_id uuid REFERENCES public.appointment_types(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'confirmada', 'realizada', 'falta', 'cancelada')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========== INSTÂNCIAS DE FORMULÁRIO (por consulta) ==========
CREATE TABLE IF NOT EXISTS public.form_instances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  form_template_id uuid NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'respondido', 'incompleto')),
  link_token text UNIQUE,
  link_expires_at timestamptz,
  responses jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========== CONSENTIMENTO LGPD ==========
CREATE TABLE IF NOT EXISTS public.consents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  text_accepted text,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- ========== HISTÓRICO DE MENSAGENS (WhatsApp / e-mail) ==========
CREATE TABLE IF NOT EXISTS public.message_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  type text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

-- ========== RLS (Row Level Security) ==========
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;

-- Planos: leitura pública para listar (ex.: página de preços)
CREATE POLICY "Planos são legíveis por todos" ON public.plans FOR SELECT USING (true);

-- Clínicas: usuários da própria clínica podem ler/atualizar; qualquer autenticado pode criar (onboarding)
CREATE POLICY "Clínica por clinic_id" ON public.clinics
  FOR SELECT USING (
    id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "Clínica update por clinic_id" ON public.clinics
  FOR UPDATE USING (
    id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "Clínica insert onboarding" ON public.clinics
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Perfis: usuário vê/atualiza o próprio; pode inserir próprio perfil (onboarding)
CREATE POLICY "Perfil próprio" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Update próprio perfil" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Insert próprio perfil" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- Demais tabelas: escopo por clinic_id (perfil do usuário)
CREATE POLICY "Appointment types por clínica" ON public.appointment_types
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Form templates por clínica" ON public.form_templates
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Patients por clínica" ON public.patients
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Appointments por clínica" ON public.appointments
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Form instances por clínica" ON public.form_instances
  FOR ALL USING (
    appointment_id IN (SELECT id FROM public.appointments WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  );

CREATE POLICY "Consents por clínica" ON public.consents
  FOR ALL USING (
    patient_id IN (SELECT id FROM public.patients WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  );

CREATE POLICY "Message log por clínica" ON public.message_log
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

-- ========== TRIGGER: criar perfil ao signup ==========
-- Nota: clinic_id e role precisam ser definidos após criar a clínica (fluxo de onboarding ou admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Perfil será criado/atualizado pela aplicação com clinic_id e role
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== ÍNDICES ==========
CREATE INDEX IF NOT EXISTS idx_profiles_clinic_id ON public.profiles(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_doctor_scheduled ON public.appointments(clinic_id, doctor_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_form_instances_link_token ON public.form_instances(link_token) WHERE link_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients(clinic_id);
