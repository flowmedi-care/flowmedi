-- Backfill seguro para instalações que já criaram clinic_meta_message_models sem os campos novos
alter table if exists public.clinic_meta_message_models
  add column if not exists meta_language text not null default 'pt_BR';

alter table if exists public.clinic_meta_message_models
  add column if not exists meta_components jsonb not null default '[]'::jsonb;

alter table if exists public.clinic_meta_message_models
  alter column event_code drop not null;

alter table if exists public.clinic_meta_message_models
  add column if not exists meta_category text not null default 'UTILITY';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinic_meta_message_models_meta_category_check'
  ) then
    alter table public.clinic_meta_message_models
      add constraint clinic_meta_message_models_meta_category_check
      check (meta_category in ('MARKETING', 'UTILITY', 'AUTHENTICATION'));
  end if;
end $$;
