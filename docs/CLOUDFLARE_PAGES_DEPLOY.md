# Deploy no Cloudflare Pages (Passo a Passo)

Este projeto ja esta preparado para deploy no Cloudflare Pages.

## 1) Comandos locais antes de publicar

No terminal do projeto:

```bash
cd /workspaces/sunshine-budget-guide
npm ci
npm run build:cloudflare
```

Se quiser validar localmente o build final:

```bash
npm run preview:cloudflare
```

Abra `http://localhost:8788` para conferir.

## 2) Subir para o GitHub

O Pages faz deploy a partir do repo, entao envie seu branch:

```bash
git push origin main
```

## 3) Criar projeto no Cloudflare Pages

1. Acesse `https://dash.cloudflare.com`.
2. Entre em `Workers & Pages`.
3. Clique em `Create` -> `Pages` -> `Connect to Git`.
4. Selecione o repositorio `warllemedicao/sunshine-budget-guide`.
5. Branch: `main`.

## 4) Configuracao de build no Cloudflare

Use estes valores:

- Framework preset: `Vite`
- Build command: `npm run build:cloudflare`
- Build output directory: `dist`
- Root directory: em branco

## 5) Variaveis de ambiente no Cloudflare (Production)

Adicione em `Settings -> Variables and Secrets`:

- `VITE_SUPABASE_URL` = `https://gsjldlbdhnxykehqencu.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = sua chave anon
- `VITE_AUTH_REDIRECT_URL_NATIVE` = `gilfinanceiro://auth/callback`
- `VITE_AUTH_REDIRECT_URL_WEB` = `https://SEU_DOMINIO.pages.dev`

Observacao:
- Defina `VITE_AUTH_REDIRECT_URL_WEB` com o dominio final do Pages.
- Se ainda nao souber o dominio, finalize o primeiro deploy e depois atualize a variavel e refaca deploy.

## 6) Ajuste obrigatorio no Supabase apos obter dominio

Em `Supabase -> Authentication -> URL Configuration`:

- Site URL: `https://SEU_DOMINIO.pages.dev`

Additional Redirect URLs:

- `https://SEU_DOMINIO.pages.dev`
- `https://SEU_DOMINIO.pages.dev/**`
- `http://localhost:5173/**`
- `gilfinanceiro://auth/callback`

## 7) Testes rapidos de validacao

1. Abrir `https://SEU_DOMINIO.pages.dev`.
2. Fazer login com Google.
3. Confirmar retorno para o mesmo dominio (nao localhost).
4. Ir em Perfil e verificar conta Google conectada.
5. Fazer upload de comprovante para Google Drive.

## 8) Observacao para SPA (rotas React Router)

Este repo inclui `public/_redirects` com:

```txt
/* /index.html 200
```

Isso evita erro 404 ao atualizar paginas internas (ex.: `/perfil`, `/dashboard`).
