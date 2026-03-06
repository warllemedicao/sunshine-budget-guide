-- ============================================
-- 1. CREATE merchants TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.merchants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  domain TEXT,
  logo_url TEXT,
  logo_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read merchants"
  ON public.merchants FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert merchants"
  ON public.merchants FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update merchants"
  ON public.merchants FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ============================================
-- 2. ADD merchant_id FK TO lancamentos
-- ============================================
ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lancamentos_merchant_id_idx ON public.lancamentos(merchant_id);

-- ============================================
-- 3. CREATE PUBLIC merchant-logos BUCKET
-- (idempotent: does nothing if bucket already exists)
-- ============================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('merchant-logos', 'merchant-logos', true)
  ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/upsert logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload merchant logos'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated users can upload merchant logos"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'merchant-logos' AND auth.role() = 'authenticated')
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can update merchant logos'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated users can update merchant logos"
        ON storage.objects FOR UPDATE
        USING (bucket_id = 'merchant-logos' AND auth.role() = 'authenticated')
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can view merchant logos'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Anyone can view merchant logos"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'merchant-logos')
    $policy$;
  END IF;
END $$;
