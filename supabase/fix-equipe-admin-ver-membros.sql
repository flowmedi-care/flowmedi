-- Admin da clínica precisa VER todos os membros da equipe (médicos, secretárias).
-- Sem esta política, cada usuário só vê o próprio perfil e a lista de membros fica vazia.
-- Execute no Supabase: SQL Editor → New query → Cole → Run.

-- (Opcional) Marcar como aceitos os convites cujo e-mail já está na equipe (evita ficar "pendente")
UPDATE public.invites i
SET accepted_at = now()
WHERE i.accepted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.clinic_id = i.clinic_id
      AND lower(trim(p.email)) = lower(trim(i.email))
  );

-- Políticas para admin ver todos os membros
DROP POLICY IF EXISTS "Perfil próprio" ON public.profiles;

-- Cada usuário vê o próprio perfil
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Admin da clínica vê todos os perfis da mesma clínica (para a aba Equipe)
CREATE POLICY "profiles_select_clinic_admin"
  ON public.profiles FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND COALESCE(active, true) = true
    )
  );

-- Update e Insert continuam só para o próprio perfil (já existem)
-- Se você tiver policy "Update próprio perfil", mantenha. Não alteramos aqui.
