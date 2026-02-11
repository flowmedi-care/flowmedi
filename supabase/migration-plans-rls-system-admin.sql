-- RLS para tabela plans: permitir system_admin gerenciar planos
-- Execute no SQL Editor do Supabase

-- Habilitar RLS na tabela plans (se ainda não estiver)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Remover política antiga se existir (pode ter sido criada no schema.sql)
DROP POLICY IF EXISTS "Planos são legíveis por todos" ON public.plans;

-- Política: Todos podem ler planos (para página de preços)
CREATE POLICY "plans_select_all"
  ON public.plans FOR SELECT
  USING (true);

-- Política: system_admin pode fazer tudo (INSERT, UPDATE, DELETE)
CREATE POLICY "plans_all_system_admin"
  ON public.plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'system_admin' 
      AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'system_admin' 
      AND active = true
    )
  );
