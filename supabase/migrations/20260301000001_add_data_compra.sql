-- Add data_compra column to lancamentos to store the original purchase date
-- chosen by the user, while `data` continues to be used for invoice month filtering.
ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS data_compra DATE;
