# FlowMedi

SaaS para clínicas: agenda centrals, formulários clínicos e comunicação com o paciente.

## Estrutura do repositório

O projeto Next.js está **nesta pasta** (`flowmedi/`).  
Se você está na pasta pai (`Flowmedi`), entre na pasta do app antes de rodar comandos:

```bash
cd flowmedi
npm install
npm run dev
```

## Deploy no Vercel

Para não dar **404 NOT_FOUND**, confisgure o **Root Directory** do projeto no Vercel:

1. Vercel Dashboard → seu projeto → **Settings** → **General**
2. Em **Root Directory**, clique em **Edit**
3. Defina como: **`flowmedi`**
4. Save e faça um novo **Redeploy**

Assim o Vercel passa a usar a pasta onde estão `package.json`, `app/`, etc.

## Stack

- **Next.js 15** (App Router), **TypeScript**, **Tailwind CSS**
- **Supabase**: banco de dados e autenticação
- **shadcn/ui** (componentes em `components/ui`)
- Deploy: **Vercel**

## Como rodar localmente

1. **Instalar dependências** (dentro da pasta `flowmedi`):
   ```bash
   npm install
   ```

2. **Supabase**
   - Crie um projeto em [supabase.com](https://supabase.com).
   - No **SQL Editor**, execute o conteúdo de `supabase/schema.sql`.
   - Em **Project Settings → API**, copie a **URL** e a **anon key**.
   - **MVP:** em **Authentication → Providers → Email**, desative **Confirm email**. Assim o usuário entra logo após criar conta (a tela já pede senha 2x para confirmar).

3. **Variáveis de ambiente**
   - Copie `.env.example` para `.env.local`.
   - Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - No Vercel: **Settings → Environment Variables** e adicione as mesmas variáveis.

4. **Subir o app**
   ```bash
   npm run dev
   ```
   Acesse [http://localhost:3000](http://localhost:3000).

## Páginas

- **Públicas:** `/` (landing), `/precos`, `/entrar`, `/criar-conta`, `/esqueci-senha`
- **Dashboard:** `/dashboard` (requer login). Se o usuário não tiver perfil/clínica, é direcionado a `/dashboard/onboarding` para criar a clínica e virar admin.

## Documentação

- `docs/FLOWMEDI-VISAO-PRODUTO-E-ARQUITETURA.md` — visão de produto e arquitetura.
- `docs/INTEGRACAO-WHATSAPP-E-EMAIL.md` — como integrar WhatsApp e e-mail automático.
