-- ============================================================
-- 1. CREATE merchants TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.merchants (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  normalized_name   TEXT        NOT NULL,
  domain            TEXT,
  logo_url          TEXT,
  logo_storage_path TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate merchants
CREATE UNIQUE INDEX IF NOT EXISTS merchants_normalized_name_key
  ON public.merchants (normalized_name);

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read merchants"
  ON public.merchants FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert merchants"
  ON public.merchants FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update merchants"
  ON public.merchants FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ============================================================
-- 3. updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.merchants_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER merchants_updated_at
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.merchants_set_updated_at();

-- ============================================================
-- 4. ADD merchant_id TO lancamentos
-- ============================================================
ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.merchants(id);

-- Index for efficient join/lookup by merchant_id
CREATE INDEX IF NOT EXISTS lancamentos_merchant_id_idx
  ON public.lancamentos (merchant_id);
