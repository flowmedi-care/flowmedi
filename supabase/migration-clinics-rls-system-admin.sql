-- RLS para tabela clinics: permitir system_admin gerenciar planos e subscription_status de qualquer clínica
-- Execute no SQL Editor do Supabase

-- Política: system_admin pode atualizar qualquer clínica (para dar free pass Pro)
CREATE POLICY "clinics_update_system_admin"
  ON public.clinics FOR UPDATE
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

-- Política: system_admin pode ler qualquer clínica
CREATE POLICY "clinics_select_system_admin"
  ON public.clinics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'system_admin' 
      AND active = true
    )
    OR
    id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );
