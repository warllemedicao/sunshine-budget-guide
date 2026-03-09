-- Group recurring fixed transactions and ensure receipt columns exist

ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS recorrencia_id UUID;

CREATE INDEX IF NOT EXISTS lancamentos_recorrencia_id_idx
  ON public.lancamentos (usuario_id, recorrencia_id);

ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS comprovante_url TEXT;

ALTER TABLE public.faturas
  ADD COLUMN IF NOT EXISTS comprovante_url TEXT;
