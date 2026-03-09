# Sincronizacao WhatsApp (Meta Cloud API + Supabase)

Este projeto agora aceita lancamentos via mensagem WhatsApp com custo inicial zero no plano gratuito da Meta Cloud API.

## O que foi implementado

- Tabela `public.whatsapp_user_links` para vincular telefone ao usuario.
- Tabela `public.whatsapp_inbound_logs` para auditoria das mensagens.
- Edge Function `whatsapp-webhook` para:
  - validar webhook da Meta (GET)
  - receber mensagens (POST)
  - interpretar texto simples
  - inserir em `lancamentos`
  - responder no WhatsApp com confirmacao
- Campo no Perfil para salvar o numero WhatsApp vinculado.

## Como funciona

1. Usuario salva o numero no app em `Perfil -> Sincronizacao WhatsApp`.
2. Usuario manda mensagem para o numero WhatsApp Business do bot.
3. Meta envia o evento para o webhook no Supabase.
4. Webhook identifica o usuario pelo telefone e cria o lancamento.

Exemplo de mensagem:

- `mercado 45,90 hoje alimentacao`
- `uber 22,30 ontem transporte`
- `recebi salario 3200`

## Setup no Supabase

### 1) Aplicar migration

Execute a migration:

- `supabase/migrations/20260309030001_whatsapp_sync.sql`

### 2) Deploy da function

```bash
supabase functions deploy whatsapp-webhook
```

### 3) Definir secrets

```bash
supabase secrets set WHATSAPP_VERIFY_TOKEN="seu_token_de_verificacao"
supabase secrets set WHATSAPP_ACCESS_TOKEN="seu_token_permanente_meta"
supabase secrets set WHATSAPP_PHONE_NUMBER_ID="seu_phone_number_id"
```

Observacao:
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` ja sao fornecidos no ambiente de edge functions.

## Setup na Meta (WhatsApp Cloud API)

### 1) Criar app no Meta for Developers

- Produto: WhatsApp.
- Use o numero de teste gratuito inicialmente (sandbox da Meta).

### 2) Configurar webhook

- Callback URL:
  - `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook`
- Verify Token:
  - mesmo valor de `WHATSAPP_VERIFY_TOKEN`
- Subscribe no campo:
  - `messages`

### 3) Permissoes e token

- Gere token de acesso do sistema (ou token de longa duracao).
- Configure no Supabase secret `WHATSAPP_ACCESS_TOKEN`.
- Configure `WHATSAPP_PHONE_NUMBER_ID` com o ID do numero do WhatsApp.

## Custo

- Meta Cloud API tem faixa gratuita inicial por conversas (sujeita a regras vigentes da Meta).
- Supabase Edge Functions no plano gratuito atende prototipo/MVP.
- Cloudflare Pages (frontend) pode permanecer no plano gratuito.

## Validacao rapida

1. Vincule telefone no app (Perfil).
2. Envie mensagem: `mercado 45,90 hoje alimentacao`.
3. Confirme resposta no WhatsApp.
4. Abra app e verifique novo lancamento em `Dashboard`.

## Observacoes importantes

- O parser atual e intencionalmente simples (texto livre com valor).
- Se nao encontrar valor, a function responde com exemplo de formato.
- Se o telefone nao estiver vinculado, a function orienta vincular pelo Perfil.
