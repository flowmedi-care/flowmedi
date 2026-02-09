# FlowMedi

SaaS para clínicas: agenda central, formulários clínicos e comunicação com o paciente.

## Stack

- **Next.js 15** (App Router), **TypeScript**, **Tailwind CSS**
- **Supabase**: banco de dados e autenticação
- **shadcn/ui** (componentes em `components/ui`)
- Deploy: **Vercel**

## Como rodar

1. **Instalar dependências**
   ```bash
   npm install
   ```

2. **Supabase**
   - Crie um projeto em [supabase.com](https://supabase.com).
   - No **SQL Editor**, execute o conteúdo de `supabase/schema.sql`.
   - Em **Project Settings → API**, copie a **URL** e a **anon key**.

3. **Variáveis de ambiente**
   - Copie `.env.example` para `.env.local`.
   - Preencha:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
     ```

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
