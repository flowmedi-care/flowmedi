-- Agenda v2: salas/consultórios nomeados.

CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, name)
);

CREATE INDEX IF NOT EXISTS idx_rooms_clinic_active ON public.rooms(clinic_id, active);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_clinic_access"
  ON public.rooms FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_room_interval
  ON public.appointments(clinic_id, room_id, scheduled_at, scheduled_end_at)
  WHERE status <> 'cancelada' AND room_id IS NOT NULL;

COMMENT ON TABLE public.rooms IS 'Salas/consultórios da clínica para conflito de agendamento por espaço físico.';
