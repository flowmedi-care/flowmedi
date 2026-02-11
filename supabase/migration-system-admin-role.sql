-- FlowMedi — Migration: Adicionar role system_admin
-- Execute no SQL Editor do Supabase
-- Permite criar usuários com papel de administrador do sistema (super admin)

-- ========== EXPANDIR CONSTRAINT DE ROLE ==========
-- Remover constraint antiga
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Adicionar nova constraint incluindo system_admin
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'medico', 'secretaria', 'system_admin'));

COMMENT ON COLUMN public.profiles.role IS 'Papel do usuário: admin (admin da clínica), medico, secretaria, ou system_admin (super admin do sistema)';

-- ========== NOTA IMPORTANTE ==========
-- Para tornar um usuário system_admin, execute manualmente:
-- UPDATE public.profiles SET role = 'system_admin' WHERE id = 'SEU_USER_ID_AQUI';
-- 
-- Apenas usuários com role = 'system_admin' poderão acessar o painel /admin/system
-- Use com cuidado e apenas para você mesmo inicialmente.
