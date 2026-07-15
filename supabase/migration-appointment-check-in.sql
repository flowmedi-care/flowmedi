-- Presence check-in as an event, not an appointment status.
-- arrived_at (reception-confirmed presence) is intentionally deferred until an ops/reception flow exists.

alter table public.appointments
  add column if not exists checked_in_at timestamptz null,
  add column if not exists check_in_source text null,
  add column if not exists checked_in_by_patient_id uuid null
    references public.patients(id);

comment on column public.appointments.checked_in_at is
  'When the patient (or actor) announced arrival / completed check-in. Independent of status.';
comment on column public.appointments.check_in_source is
  'TEXT: assistant | dashboard | reception | kiosk | api';
comment on column public.appointments.checked_in_by_patient_id is
  'Patient record of whoever performed check-in (session patient or guardian).';

create index if not exists appointments_checked_in_at_idx
  on public.appointments (clinic_id, checked_in_at)
  where checked_in_at is not null;
