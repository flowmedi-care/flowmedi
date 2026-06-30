# Painel de Validação de APIs

Ferramenta interna para validar autenticação, autorização e exposição de dados das rotas `/api/*` antes de cada deploy.

**Desligue `ENABLE_API_AUDIT_PANEL` na Vercel assim que terminar a auditoria.**

---

## Requisitos

- `ENABLE_API_AUDIT_PANEL=true` nas Environment Variables da Vercel (ou `.env.local` em dev)

## Proteção

1. **Variável de ambiente** — painel só existe com `ENABLE_API_AUDIT_PANEL=true`
2. **Middleware** — em production, `/dev/*` e `/api/dev/*` retornam `404` **se a flag estiver off**
3. **Handlers** — cada rota em `app/api/dev/audit/*` chama `assertApiAuditEnabled()`

---

## Acesso

```
https://seu-dominio.com/dev/api-validation
```

(local: `http://localhost:3000/dev/api-validation`)

---

## Setup na Vercel (batch completo)

O runner **já lê `process.env` no servidor Vercel**. Não usa credenciais genéricas da app — apenas variáveis `API_AUDIT_*` dedicadas.

### 1. Criar usuários de teste no Supabase

Crie 4 contas (Auth) com `profiles` na clínica de staging:

| Papel | `profiles.role` |
|-------|-----------------|
| Admin da clínica | `admin` |
| Secretária | `secretaria` |
| Médico | `medico` |
| System admin | `system_admin` |

### 2. Environment Variables (Production ou Preview)

```
ENABLE_API_AUDIT_PANEL=true
API_AUDIT_ADMIN_EMAIL=...
API_AUDIT_ADMIN_PASSWORD=...
API_AUDIT_SECRETARIA_EMAIL=...
API_AUDIT_SECRETARIA_PASSWORD=...
API_AUDIT_MEDICO_EMAIL=...
API_AUDIT_MEDICO_PASSWORD=...
API_AUDIT_SYSTEM_ADMIN_EMAIL=...
API_AUDIT_SYSTEM_ADMIN_PASSWORD=...
```

`CRON_SECRET` já existente é reutilizado para probes de cron (fallback de `API_AUDIT_CRON_SECRET`).

### 3. Redeploy

Após adicionar vars, faça **redeploy** — Next.js só enxerga env no runtime do deployment.

### 4. Executar logado

Abra `/dev/api-validation` **logado** no mesmo browser antes de **Executar Auditoria**. O painel mostra status das vars e se há sessão ativa.

---

## Configuração

### Fixtures (parâmetros de teste)

Defaults via env (ver `.env.example`). Override na UI — salvo em `localStorage` (`api-audit-fixtures`).

| Variável | Uso |
|----------|-----|
| `API_AUDIT_CLINIC_SLUG` | Slug real da clínica de staging (evite `demo` se não existir) |
| `API_AUDIT_CONTACT_SLUG` | Mesmo slug para `/api/public/contact/[slug]` |
| `API_AUDIT_PLAN_ID` | UUID de plano existente em `plans` |
| `API_AUDIT_CONVERSATION_ID` | UUID de conversa WhatsApp da clínica de teste |
| `API_AUDIT_SUGGESTION_ID` | UUID em `public_suggestions` para rotas `[id]` |
| `API_AUDIT_APPOINTMENT_ID` | Transcrições |
| `API_AUDIT_FORM_INSTANCE_ID` | process-public-form-event |
| `API_AUDIT_CRON_SECRET` | Rotas cron (fallback: `CRON_SECRET`) |
| `API_AUDIT_META_VERIFY_TOKEN` | Webhook Meta GET verify |

Sem credenciais de papel, o batch **omite** cenários admin/secretaria/medico/system_admin (não conta como falha).

---

## Cenários de teste

| Cenário | Descrição |
|---------|-----------|
| `anonymous` | Fetch sem cookies nem CRON_SECRET |
| `cron_authenticated` | Apenas endpoints cron — Bearer `CRON_SECRET` |
| `current_session` | Cookies da sessão logada no navegador |
| `admin` / `secretaria` / `medico` / `system_admin` | Login Supabase via env (batch) |

---

## Inventário

Fonte única: [`lib/api-audit/registry.ts`](../lib/api-audit/registry.ts) — **86 handlers** derivados da [auditoria de segurança](./security-audit.md).

Validação de paridade:

```bash
node scripts/validate-api-registry.cjs
```

Ou via painel: badge verde **Registry sincronizado**.

---

## Estratégias de probe

| Estratégia | Comportamento |
|------------|---------------|
| `full` | GET com parâmetros resolvidos |
| `auth-only` | POST/DELETE com body `{}` — valida 401/403 sem side effects |
| `manual` | Webhooks Stripe/Meta POST, OAuth callbacks |
| `skip` | Não testado automaticamente |

---

## Relatório

Após **Executar Auditoria**, exporte Markdown / JSON / CSV.

Classificações: `aprovado` | `atencao` | `critico`

O resumo separa **falhas reais** de **skips** (config ausente vs teste manual).

---

## Fluxo pré-deploy

1. Vercel: `ENABLE_API_AUDIT_PANEL=true` + contas `API_AUDIT_*`
2. Redeploy
3. Login no app → `/dev/api-validation`
4. Confirme registry sincronizado e vars configuradas (painel mostra status)
5. **Executar Auditoria** → exporte JSON
6. Revise críticos e atenção
7. **Produção:** remova `ENABLE_API_AUDIT_PANEL` ou defina `ENABLE_API_AUDIT_PANEL=false` na Vercel e **redeploy** (o painel e `/api/dev/*` passam a retornar 404).

---

## Limitações

1. Um browser = uma sessão; papéis completos exigem contas env
2. POSTs destrutivos testados em modo auth-only
3. Webhooks Stripe/Meta POST requerem assinatura real (manual)
4. OAuth callbacks dependem de state/code (manual)

---

## Arquitetura

```
app/dev/api-validation/          → UI do painel
app/api/dev/audit/               → API interna (probe, run, session, validate-registry)
lib/api-audit/                   → registry, runner, analyzer, redact, export
components/api-audit/            → componentes React
lib/cron-auth.ts                 → verifyCronSecret (fail-closed)
```
