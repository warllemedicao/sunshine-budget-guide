# Sunshine Budget Guide (Gil Financeiro)

Aplicativo de controle financeiro pessoal com foco em lancamentos, metas, dashboards e integracao com Supabase/Capacitor.

## Stack

- Vite
- TypeScript
- React
- shadcn/ui
- Tailwind CSS
- Supabase
- Capacitor (Android)

## Execucao local

Requisitos:

- Node.js 18+
- npm

Comandos principais:

```sh
npm i
npm run dev
```

Para build web:

```sh
npm run build
npm run preview
```

## Documentacao

- Esquema e estrutura de dados: `docs/SCHEMA.md`
- OAuth Google com Capacitor: `docs/OAUTH_CAPACITOR_GOOGLE_SETUP.md`
- Checklist de validacao OAuth: `docs/OAUTH_VALIDATION_CHECKLIST.md`
- Setup sincronizacao WhatsApp: `docs/WHATSAPP_SYNC_SETUP.md`
- Deploy Cloudflare Pages: `docs/CLOUDFLARE_PAGES_DEPLOY.md`

## Google OAuth + Supabase + Capacitor (APK)

Para configurar login Google corretamente em web/tunel e APK Capacitor, use:

- Guia tecnico completo: `docs/OAUTH_CAPACITOR_GOOGLE_SETUP.md`
- Checklist de validacao: `docs/OAUTH_VALIDATION_CHECKLIST.md`

## Sincronizacao WhatsApp

- Guia de implementacao e setup: `docs/WHATSAPP_SYNC_SETUP.md`
