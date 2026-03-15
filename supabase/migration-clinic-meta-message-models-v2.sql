-- Backfill seguro para instalações que já criaram clinic_meta_message_models sem os campos novos
alter table if exists public.clinic_meta_message_models
  add column if not exists meta_language text not null default 'pt_BR';

alter table if exists public.clinic_meta_message_models
  add column if not exists meta_components jsonb not null default '[]'::jsonb;
