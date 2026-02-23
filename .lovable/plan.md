

# App Financeiro Pessoal — Plano de Implementação

## Visão Geral
Aplicativo completo de controle financeiro pessoal com design moderno e minimalista, usando Supabase como backend para persistência de dados na nuvem.

---

## 1. Banco de Dados (Supabase)
- **Tabela `lancamentos`** — receitas e despesas (fixas/variáveis, à vista ou cartão, parcelas, categoria, comprovante, loja)
- **Tabela `cartoes`** — bancos/cartões com limite, fechamento, vencimento e final do cartão
- **Tabela `usuario`** — nome, email e dados do perfil
- **Tabela `objetivos_globais`** — investimentos e reserva financeira (valor atual, meta, data limite)
- **Tabela `objetivos_lista`** — itens de obras e lazer (nome, data prevista, valor previsto)
- **Autenticação** com email/senha via Supabase Auth
- **Storage** para upload de comprovantes

---

## 2. Telas e Funcionalidades

### 🏠 Dashboard (Tela Inicial)
- Seletor de mês/ano com navegação por setas
- Card de **saldo disponível** (receita - despesa)
- Barra de progresso de gastos com percentual
- Seção **Entradas Fixas** — lista de receitas fixas com ícone e valor
- Seção **Saídas Fixas** — lista de despesas fixas com ícone e valor
- Seção **Cartões/Extras** — cada cartão mostrando total, vencimento e status de pagamento
- Seção **Variáveis** — despesas avulsas à vista

### 🎯 Objetivos
- **Investimentos** — valor investido, meta final, data limite, cálculo de valor por mês
- **Reserva Financeira** — valor atual da reserva
- **Obras da Casa** — lista dinâmica com nome, data e valor previsto (adicionar/remover)
- **Lazer** — lista dinâmica com nome, data e valor previsto (adicionar/remover)

### 📊 Gráficos
- Gráfico de pizza/donut com despesas agrupadas por categoria (moradia, mercado, alimentação, saúde, etc.)
- Resumo visual do mês selecionado

### 👤 Perfil e Ajustes
- Edição de nome e email do usuário
- Gerenciamento de cartões/bancos (adicionar, editar, excluir)
- Cada cartão com: instituição, limite, final do cartão, dia de fechamento e vencimento
- Botão de backup do banco de dados

### ➕ Modal de Novo Lançamento
- Tipo: despesa ou receita
- Toggle de fixo/variável
- Seletor de categoria com ícones (moradia, padaria, mercado, posto, transporte, alimentação, educação, serviços, roupas, saúde, lazer, esporte, outros)
- Método: à vista ou cartão de crédito (com seleção de banco e parcelas)
- Upload de comprovante opcional
- Botão de excluir para edição

### 💳 Modal de Pagar Fatura
- Seleção do cartão e mês/ano
- Valor efetivo pago (incluindo juros/atraso)
- Upload de comprovante
- Opção de desfazer pagamento

---

## 3. Design e Navegação
- Visual **moderno e minimalista** com cores suaves e cards arredondados
- Barra de navegação inferior com 5 abas: Início, Objetivos, Gráfico, Perfil, e botão central "+"
- Modais para lançamentos e pagamentos
- Layout responsivo (mobile-first)
- Ícones com Lucide React

---

## 4. Funcionalidades Técnicas
- Autenticação com Supabase Auth (login/cadastro)
- CRUD completo para lançamentos, cartões, objetivos
- Upload de comprovantes via Supabase Storage
- Navegação entre meses com recálculo automático
- Lançamentos fixos replicados para 12 meses
- Parcelas de cartão distribuídas nos meses seguintes
- Gráficos com Recharts

