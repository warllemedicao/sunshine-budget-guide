-- Add pago column to lancamentos table to track payment of fixed expenses
ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS pago BOOLEAN NOT NULL DEFAULT false;
