
-- ============================================
-- 1. PROFILES TABLE (linked to auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 2. CARTOES TABLE
-- ============================================
CREATE TABLE public.cartoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instituicao TEXT NOT NULL DEFAULT '',
  bandeira TEXT NOT NULL DEFAULT '',
  final_cartao TEXT NOT NULL DEFAULT '',
  limite DECIMAL(12,2) NOT NULL DEFAULT 0,
  dia_fechamento INTEGER NOT NULL DEFAULT 1,
  dia_vencimento INTEGER NOT NULL DEFAULT 10,
  cor TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cards" ON public.cartoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cards" ON public.cartoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cards" ON public.cartoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cards" ON public.cartoes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_cartoes_updated_at
  BEFORE UPDATE ON public.cartoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 3. LANCAMENTOS TABLE
-- ============================================
CREATE TABLE public.lancamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'despesa', -- 'receita' or 'despesa'
  descricao TEXT NOT NULL DEFAULT '',
  valor DECIMAL(12,2) NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria TEXT NOT NULL DEFAULT 'outros',
  fixo BOOLEAN NOT NULL DEFAULT false,
  metodo TEXT NOT NULL DEFAULT 'avista', -- 'avista' or 'cartao'
  cartao_id UUID REFERENCES public.cartoes(id) ON DELETE SET NULL,
  parcela_atual INTEGER,
  total_parcelas INTEGER,
  parcela_grupo_id UUID, -- groups installments together
  comprovante_url TEXT,
  loja TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entries" ON public.lancamentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own entries" ON public.lancamentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own entries" ON public.lancamentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own entries" ON public.lancamentos FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_lancamentos_updated_at
  BEFORE UPDATE ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 4. FATURAS TABLE (credit card bill payments)
-- ============================================
CREATE TABLE public.faturas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cartao_id UUID NOT NULL REFERENCES public.cartoes(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  valor_pago DECIMAL(12,2),
  pago BOOLEAN NOT NULL DEFAULT false,
  comprovante_url TEXT,
  data_pagamento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cartao_id, mes, ano)
);

ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bills" ON public.faturas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bills" ON public.faturas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bills" ON public.faturas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bills" ON public.faturas FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_faturas_updated_at
  BEFORE UPDATE ON public.faturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 5. OBJETIVOS GLOBAIS TABLE
-- ============================================
CREATE TABLE public.objetivos_globais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'investimento', -- 'investimento' or 'reserva'
  valor_atual DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_meta DECIMAL(12,2) NOT NULL DEFAULT 0,
  data_limite DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.objetivos_globais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals" ON public.objetivos_globais FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.objetivos_globais FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.objetivos_globais FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.objetivos_globais FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_objetivos_globais_updated_at
  BEFORE UPDATE ON public.objetivos_globais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 6. OBJETIVOS LISTA TABLE
-- ============================================
CREATE TABLE public.objetivos_lista (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'obra', -- 'obra' or 'lazer'
  nome TEXT NOT NULL DEFAULT '',
  data_prevista DATE,
  valor_previsto DECIMAL(12,2) NOT NULL DEFAULT 0,
  concluido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.objetivos_lista ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own list items" ON public.objetivos_lista FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own list items" ON public.objetivos_lista FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own list items" ON public.objetivos_lista FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own list items" ON public.objetivos_lista FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_objetivos_lista_updated_at
  BEFORE UPDATE ON public.objetivos_lista
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 7. STORAGE BUCKET FOR RECEIPTS
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('comprovantes', 'comprovantes', false);

CREATE POLICY "Users can upload own receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comprovantes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comprovantes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own receipts"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'comprovantes' AND auth.uid()::text = (storage.foldername(name))[1]);
