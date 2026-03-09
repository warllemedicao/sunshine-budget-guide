# OAuth Google + Supabase + Capacitor (APK Sem Dominio Proprio)

Este guia descreve o fluxo correto para login Google funcionar no app web e no APK gerado via Capacitor, sem depender de dominio proprio publicado.

## 0) Arquitetura Correta (resumo)

1. O app chama `supabase.auth.signInWithOAuth({ provider: "google" })`.
2. O Google redireciona para o callback do Supabase.
3. Callback fixo e unico no Google Cloud:
   - `https://gsjldlbdhnxykehqencu.supabase.co/auth/v1/callback`
4. O Supabase redireciona de volta para:
   - Web: URL atual do ambiente (localhost/tunel)
   - APK: deep link `gilfinanceiro://auth/callback`

Regra importante:
- No Google Cloud, voce nao cadastra URL de tunel/codespace.
- No Google Cloud, voce cadastra somente o callback do Supabase.

## 1) Google Cloud (ordem exata)

### 1.1 Criar ou selecionar projeto
- Acesse Google Cloud Console.
- Selecione o projeto usado para OAuth do app.

### 1.2 Configurar OAuth consent screen
- Menu: APIs e servicos -> Tela de consentimento OAuth.
- Tipo: `External` (se usuarios fora da organizacao usarem).
- Preencha app name, support email e developer contact.
- Em Scopes, adicione:
  - `openid`
  - `.../auth/userinfo.email`
  - `.../auth/userinfo.profile`
  - `https://www.googleapis.com/auth/drive.file`
- Se estiver em modo Testing, adicione os test users.

### 1.3 Criar credencial OAuth 2.0 (Web application)
- Menu: APIs e servicos -> Credenciais -> Criar credenciais -> OAuth client ID.
- Tipo: `Web application`.
- Authorized redirect URIs: adicionar exatamente:
  - `https://gsjldlbdhnxykehqencu.supabase.co/auth/v1/callback`
- Salvar e copiar:
  - `Client ID`
  - `Client secret`

### 1.4 Habilitar APIs necessarias
- Menu: APIs e servicos -> Biblioteca.
- Habilitar:
  - Google Drive API

## 2) Supabase (ordem exata)

### 2.1 Configurar provider Google
- Auth -> Providers -> Google.
- Enable provider: ON.
- Client ID / Client Secret: valores da etapa 1.3.
- Salvar.

### 2.2 Configurar Redirect URLs permitidas
- Auth -> URL Configuration.
- Site URL (sugestao): uma URL web principal sua (pode ser localhost no dev, se preferir).
- Additional Redirect URLs: adicionar todas abaixo:
  - `gilfinanceiro://auth/callback`
  - `https://*.app.github.dev/**`
  - `https://*.github.dev/**`
  - `http://localhost:4173/**`
  - `http://localhost:8080/**` (se usar essa porta em algum ambiente)

Observacao:
- Os curingas em `github.dev` evitam quebrar quando o tunel mudar.

### 2.3 Conferir fluxo de sessao/provedor
- Auth -> Logs: validar eventos de login Google.
- Verificar se sessao retorna com provider Google.

## 3) Projeto Web (ja ajustado no codigo)

O projeto possui helper de redirect em `src/lib/authRedirect.ts` com estas regras:
- Runtime nativo -> usa `VITE_AUTH_REDIRECT_URL_NATIVE`.
- Em `*.github.dev` -> usa `window.location.origin` atual.
- Em web comum -> usa `VITE_AUTH_REDIRECT_URL_WEB` quando valido.

Resultado:
- URL de tunel antiga em `.env` nao deve mais quebrar o redirect em Codespaces.

## 4) Capacitor (APK) - passos obrigatorios

Se o APK for gerado via Capacitor, alem da web app, voce precisa garantir configuracao nativa:

### 4.1 Capacitor config
- Definir `appId` fixo (ex.: `com.seudominio.gilfinanceiro`).
- Definir `appName`.
- Sincronizar plataformas (`npx cap sync android`).

### 4.2 Android deep link / intent-filter
- No `AndroidManifest.xml`, incluir `intent-filter` para abrir `gilfinanceiro://auth/callback`.
- Exemplo de dados no `intent-filter`:
  - scheme: `gilfinanceiro`
  - host: `auth`
  - pathPrefix: `/callback`

### 4.3 Captura do callback no app nativo
- Implementar listener de URL aberta (Capacitor App plugin) para processar o deep link de retorno.
- Validar que, apos voltar do Google, a sessao Supabase e restaurada.

Sem 4.2 e 4.3:
- O login pode abrir Google, mas nao concluir no app.

## 5) Tokens Google Drive (estabilidade)

Hoje o projeto usa `provider_token` do Supabase no cliente para upload no Drive.

Isso funciona, mas atencao:
- Access token expira.
- Para sincronizacao robusta de longo prazo, ideal usar backend/edge function para refresh token seguro.

Recomendacao por fases:
1. Fase 1 (agora): manter fluxo atual para validar login e upload basico.
2. Fase 2 (robusta): mover operacoes Drive para backend com refresh token seguro.

## 6) Variaveis de ambiente recomendadas

Em `.env.local`:

```env
VITE_SUPABASE_URL=https://gsjldlbdhnxykehqencu.supabase.co
VITE_SUPABASE_ANON_KEY=SEU_ANON_KEY

# Web: opcional em Codespaces dinamico (helper usa origin atual)
# VITE_AUTH_REDIRECT_URL_WEB=https://sua-url-web-estavel

# APK Capacitor
VITE_AUTH_REDIRECT_URL_NATIVE=gilfinanceiro://auth/callback
```

## 7) Erros comuns e causa

1. `Não foi possível encontrar a página ...app.github.dev`:
- Causa: URL de tunel antiga no redirect.
- Correcao: usar host atual + wildcard no Supabase.

2. `redirect_uri_mismatch` no Google:
- Causa: callback diferente do cadastrado.
- Correcao: usar exatamente `https://gsjldlbdhnxykehqencu.supabase.co/auth/v1/callback`.

3. Login abre Google e nao volta para o app APK:
- Causa: deep link Android nao configurado.
- Correcao: intent-filter + listener appUrlOpen.

4. Upload Drive falha apos algum tempo:
- Causa: token expirado.
- Correcao: reautenticar ou implementar refresh via backend.

## 8) Ordem de execucao recomendada (sem pular)

1. Configurar Google Cloud (consent + client + redirect URI + Drive API).
2. Configurar Supabase (provider + redirect URLs).
3. Testar web em localhost.
4. Testar web em tunel/codespace.
5. Configurar deep link Capacitor Android.
6. Gerar APK e testar login Google no aparelho.
7. Testar upload no Drive apos login.
8. Validar re-login apos expirar sessao.

## 9) Build APK no ambiente local (requisito tecnico)

Para gerar APK, alem do codigo pronto, a maquina precisa de Android SDK.

### 9.1 Java recomendado
- Use JDK 21 para build Android neste projeto.
- Exemplo temporario no terminal:

```bash
export JAVA_HOME=/usr/local/sdkman/candidates/java/21.0.9-ms
export PATH="$JAVA_HOME/bin:$PATH"
java -version
```

### 9.2 Android SDK obrigatorio
- Se `./gradlew assembleDebug` falhar com `SDK location not found`, configure um destes:
  - `ANDROID_HOME`
  - `ANDROID_SDK_ROOT`
  - `android/local.properties` com `sdk.dir=/caminho/do/android-sdk`

Exemplo de `android/local.properties`:

```properties
sdk.dir=/opt/android-sdk
```

### 9.3 Comandos do projeto
- Sync Android:

```bash
npm run cap:sync
```

- Build APK debug (pipeline completo):

```bash
npm run apk:debug
```
