-- Modelos locais de mensagens Meta (rascunhos/submissão)
create table if not exists public.clinic_meta_message_models (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  event_code text null,
  meta_category text not null default 'UTILITY' check (meta_category in ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  template_key text not null check (template_key in ('flowmedi_consulta', 'flowmedi_formulario', 'flowmedi_aviso', 'flowmedi_mensagem_livre')),
  body_text text not null,
  meta_language text not null default 'pt_BR',
  meta_components jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'ready_to_submit', 'submitted')),
  meta_template_id text null,
  meta_status text null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_meta_message_models_clinic_idx
  on public.clinic_meta_message_models (clinic_id, created_at desc);

alter table public.clinic_meta_message_models enable row level security;

drop policy if exists "clinic_meta_message_models_select" on public.clinic_meta_message_models;
create policy "clinic_meta_message_models_select"
  on public.clinic_meta_message_models
  for select
  using (
    clinic_id in (
      select clinic_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "clinic_meta_message_models_modify_admin" on public.clinic_meta_message_models;
create policy "clinic_meta_message_models_modify_admin"
  on public.clinic_meta_message_models
  for all
  using (
    clinic_id in (
      select clinic_id from public.profiles where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    clinic_id in (
      select clinic_id from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

create or replace function public.touch_clinic_meta_message_models_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_clinic_meta_message_models_updated_at on public.clinic_meta_message_models;
create trigger trg_clinic_meta_message_models_updated_at
before update on public.clinic_meta_message_models
for each row execute function public.touch_clinic_meta_message_models_updated_at();
