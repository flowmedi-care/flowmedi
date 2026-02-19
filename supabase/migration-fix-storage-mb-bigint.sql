-- FlowMedi — Migration: Alterar storage_mb de int para bigint
-- Execute apenas se receber erro "value is out of range for type integer"
-- Isso permite valores maiores de armazenamento (até 9 petabytes)

ALTER TABLE public.plans
  ALTER COLUMN storage_mb TYPE bigint;

COMMENT ON COLUMN public.plans.storage_mb IS 'Armazenamento em MB para exames (null = ilimitado). Tipo bigint permite valores muito grandes.';
