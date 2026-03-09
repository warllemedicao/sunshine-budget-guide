# Checklist de Validacao - Google OAuth + Supabase + Capacitor

Marque item por item. Nao pule etapas.

Status automatico aplicado pelo agente neste workspace em 2026-03-08:
- [x] Itens tecnicos de codigo e estrutura Capacitor que dependiam do repositorio.
- [ ] Itens que exigem painel externo (Google Cloud/Supabase), Android SDK local ou aparelho fisico.

## A) Google Cloud

- [ ] Projeto Google Cloud correto selecionado.
- [ ] OAuth consent screen configurada.
- [ ] Escopo `openid` ativo.
- [ ] Escopo `userinfo.email` ativo.
- [ ] Escopo `userinfo.profile` ativo.
- [ ] Escopo `https://www.googleapis.com/auth/drive.file` ativo.
- [ ] Test users adicionados (se app em Testing).
- [ ] OAuth Client criado no tipo `Web application`.
- [ ] Redirect URI cadastrada exatamente:
  - [ ] `https://gsjldlbdhnxykehqencu.supabase.co/auth/v1/callback`
- [ ] Google Drive API habilitada no projeto.

## B) Supabase

- [ ] Auth Provider Google habilitado.
- [ ] Client ID inserido no provider Google do Supabase.
- [ ] Client Secret inserido no provider Google do Supabase.
- [ ] Redirect URL `gilfinanceiro://auth/callback` adicionada.
- [ ] Redirect URL `https://*.app.github.dev/**` adicionada.
- [ ] Redirect URL `https://*.github.dev/**` adicionada.
- [ ] Redirect URL `http://localhost:4173/**` adicionada.
- [ ] Redirect URL `http://localhost:8080/**` adicionada (se usar).
- [ ] Login Google aparece em Auth Logs sem erro.

## C) Projeto (Web)

- [x] `src/lib/authRedirect.ts` atualizado com fallback para host dinamico github.dev.
- [ ] `.env.local` possui `VITE_SUPABASE_URL` valido.
- [ ] `.env.local` possui `VITE_SUPABASE_ANON_KEY` valido.
- [x] `VITE_AUTH_REDIRECT_URL_NATIVE=gilfinanceiro://auth/callback` definido.
- [ ] Login Google funciona em `localhost`.
- [ ] Login Google funciona em URL de tunel atual.

## D) Capacitor / Android (APK)

- [x] Projeto possui `capacitor.config` com `appId` fixo.
- [x] Plataforma Android adicionada e sincronizada.
- [x] `AndroidManifest.xml` contem `intent-filter` para `gilfinanceiro://auth/callback`.
- [x] Listener de URL aberta (`appUrlOpen`) implementado no app.
- [ ] Login Google no APK retorna ao app apos autenticar.
- [ ] Sessao do usuario fica ativa apos retorno.

## E) Google Drive no app

- [ ] Usuario logado com provider Google.
- [ ] `provider_token` disponivel na sessao.
- [ ] Upload de comprovante para Drive funciona.
- [ ] Link de visualizacao do arquivo abre no Drive.
- [ ] Revogar conexao Google funciona no perfil.

## F) Regressao e seguranca

- [ ] Logout e novo login funcionam.
- [ ] Sessao expirada pede reautenticacao.
- [ ] Nao ha tokens sensiveis em logs/screenshot.
- [ ] Tokens antigos foram revogados no Google (se vazaram).
- [x] Build web (`npm run build`) concluido sem erro.

Bloqueio atual do container para APK:
- [ ] Android SDK instalado e configurado (`ANDROID_HOME`/`sdk.dir`).

## Resultado final esperado

- [ ] Web + APK autenticam com Google sem `redirect_uri_mismatch`.
- [ ] APK nao depende de URL fixa de tunel para concluir login.
- [ ] Usuario envia comprovante para Google Drive com sucesso.
