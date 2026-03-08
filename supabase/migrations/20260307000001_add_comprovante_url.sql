-- Add comprovante_url to lancamentos to persist receipt path for fixed expenses and other transactions
ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS comprovante_url TEXT;

-- Add comprovante_url to faturas to persist payment receipt path
ALTER TABLE public.faturas ADD COLUMN IF NOT EXISTS comprovante_url TEXT;
