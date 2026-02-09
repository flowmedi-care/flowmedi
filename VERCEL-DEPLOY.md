# Deploy no Vercel — checklist (evitar 404)

Se **`/`** retorna **404** ou o build termina em **14ms** (“Build Completed in /vercel/output [14ms]”), o Vercel **não está rodando o Next.js** — está usando o comando errado e não gera a aplicação.

## 0. "No framework detected" — definir manualmente

Se o Vercel mostra **No framework detected**, defina o framework à mão:

1. Vercel Dashboard → seu projeto → **Settings** → **General**
2. Na seção **Build & Development Settings**, clique em **Override**
3. **Framework Preset:** escolha **Next.js**
4. **Build Command:** deixe em branco (o `vercel.json` usa `npm run build`) ou preencha `npm run build`
5. **Output Directory:** deixe em branco
6. **Install Command:** deixe em branco (ou `npm install`)
7. Salve e faça um **Redeploy**

Assim o Vercel passa a tratar o projeto como Next.js mesmo quando a detecção automática falha.

## 1. Root Directory

No seu repo **flowmedi-care/flowmedi** o projeto Next.js está **na raiz** (tem `app/`, `package.json` na raiz). Então no Vercel o **Root Directory** deve ficar **vazio** (ou `.`).

1. Vercel Dashboard → projeto → **Settings** → **General**
2. Em **Root Directory**: se estiver preenchido (ex.: `flowmedi`), clique em **Edit** e **apague**, deixe em branco → **Save**.

## 2. Conferir o build

Depois de salvar o Root Directory:

1. Vá em **Deployments**
2. Clique no último deployment → **Building** ou **Ready**
3. Abra os **logs do build** e confira:
   - Deve aparecer algo como “Installing dependencies” e depois “Building…”
   - **Framework** deve ser detectado como **Next.js**
   - No final: **Build Completed** (ou “Compiled successfully”)

Se o build **falhar** (erro em vermelho), o deploy fica “vazio” e todas as rotas retornam 404. Corrija o erro do build (por exemplo variável de ambiente faltando, erro de TypeScript) e faça um novo deploy.

## 3. Redeploy depois de mudar o Root Directory

Só mudar o Root Directory **não** refaz o deploy sozinho.

1. **Deployments** → no último deploy, clique nos **três pontinhos (⋯)**
2. **Redeploy**
3. Marque **Use existing Build Cache** se quiser (opcional)
4. Confirme

Espere o build terminar e teste de novo **`/`**.

## 4. Build em 14ms = Vercel não rodou o Next.js

Se no log aparece **"Running \"vercel build\""** e **"Build Completed in /vercel/output [14ms]"**, o Vercel usou o comando genérico e **não** rodou `next build`. Um build real do Next.js leva dezenas de segundos.

**O que fazer:**

1. **No repositório:** o arquivo **`vercel.json`** na raiz do projeto já define `"buildCommand": "npm run build"`. Faça commit e push para o GitHub.
2. **No Vercel Dashboard:**  
   - **Settings** → **General**  
   - Em **Build & Development Settings**:  
     - **Framework Preset:** escolha **Next.js**  
     - **Build Command:** deixe em branco (o `vercel.json` manda) ou coloque `npm run build`  
     - **Output Directory:** deixe em branco  
   - Salve e faça **Redeploy**.

Depois do próximo deploy, o log deve mostrar algo como **"Running \"npm run build\""** ou **"next build"** e o build deve levar 1–2 minutos, não 14ms.

## 5. Resumo

| O que verificar | Onde | Valor esperado |
|-----------------|------|----------------|
| Root Directory | Settings → General | **Vazio** (repo com app/ na raiz) |
| Framework Preset | Settings → Build & Development | “Build Completed” / “Compiled successfully” |
| Build Command | vercel.json | `npm run build` |
| Logs | Deployments → logs | Build > 30s, não 14ms |

Depois disso, **`/`** deve abrir a landing e o **favicon** será o ícone “F” verde (definido em `app/icon.tsx`). O navegador pode pedir `/favicon.ico`; o Next.js pode servir o ícone em outro path — se ainda aparecer 404 só no favicon, não impacta a página principal.
