-- WhatsApp sync: user phone links + inbound log table

CREATE TABLE IF NOT EXISTS public.whatsapp_user_links (
  usuario_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164 TEXT UNIQUE NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_user_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario pode ver seu vinculo WhatsApp"
  ON public.whatsapp_user_links FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuario pode inserir seu vinculo WhatsApp"
  ON public.whatsapp_user_links FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuario pode atualizar seu vinculo WhatsApp"
  ON public.whatsapp_user_links FOR UPDATE
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuario pode remover seu vinculo WhatsApp"
  ON public.whatsapp_user_links FOR DELETE
  USING (auth.uid() = usuario_id);

CREATE INDEX IF NOT EXISTS whatsapp_user_links_phone_idx
  ON public.whatsapp_user_links (phone_e164);

CREATE TRIGGER update_whatsapp_user_links_updated_at
  BEFORE UPDATE ON public.whatsapp_user_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id TEXT UNIQUE,
  phone_e164 TEXT,
  text_body TEXT,
  parsed_valor NUMERIC(12,2),
  parsed_categoria TEXT,
  parsed_data DATE,
  lancamento_id UUID REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  processing_status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_inbound_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Somente leitura via service role (deny by default)"
  ON public.whatsapp_inbound_logs FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS whatsapp_inbound_logs_phone_idx
  ON public.whatsapp_inbound_logs (phone_e164, created_at DESC);
