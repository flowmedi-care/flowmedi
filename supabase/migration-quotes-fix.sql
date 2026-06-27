-- Fix pós-migration quotes: políticas idempotentes + reload do schema PostgREST
-- Execute no SQL Editor se orçamentos retornarem erro de schema/relationship/permissão.

DROP POLICY IF EXISTS "quotes_clinic" ON public.quotes;
DROP POLICY IF EXISTS "quote_items_clinic" ON public.quote_items;

CREATE POLICY "quotes_clinic"
  ON public.quotes FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "quote_items_clinic"
  ON public.quote_items FOR ALL
  USING (
    quote_id IN (
      SELECT id FROM public.quotes
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    quote_id IN (
      SELECT id FROM public.quotes
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;

-- Recarrega cache do PostgREST (Supabase API) após criar tabelas novas
NOTIFY pgrst, 'reload schema';
