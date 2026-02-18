-- Atualiza create_clinic_and_profile para incluir telefone e email
-- Execute no SQL Editor do Supabase

CREATE OR REPLACE FUNCTION public.create_clinic_and_profile(
  p_clinic_name text,
  p_full_name text DEFAULT NULL,
  p_clinic_phone text DEFAULT NULL,
  p_clinic_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_clinic_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  INSERT INTO public.clinics (name, phone, email) 
  VALUES (p_clinic_name, p_clinic_phone, p_clinic_email) 
  RETURNING id INTO v_clinic_id;

  INSERT INTO public.profiles (id, email, full_name, role, clinic_id)
  SELECT v_user_id, u.email, p_full_name, 'admin', v_clinic_id
  FROM auth.users u WHERE u.id = v_user_id
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    role = 'admin',
    clinic_id = EXCLUDED.clinic_id,
    updated_at = now();

  RETURN v_clinic_id;
END;
$$;
