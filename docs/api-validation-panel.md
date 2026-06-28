# Painel de Validação de APIs

Ferramenta interna para validar autenticação, autorização e exposição de dados das rotas `/api/*` antes de cada deploy.

**Nunca habilite em produção.**

---

## Requisitos

- `NODE_ENV` diferente de `production` (development ou homologação)
- `ENABLE_API_AUDIT_PANEL=true` no `.env.local`

## Proteção (tripla camada)

1. **Variável de ambiente** — `isApiAuditEnabled()` exige `ENABLE_API_AUDIT_PANEL=true` e `NODE_ENV !== "production"`
2. **Middleware** — rotas `/dev/*` e `/api/dev/*` retornam `404` em produção
3. **Handlers** — cada rota em `app/api/dev/audit/*` chama `assertApiAuditEnabled()`

---

## Acesso

Com o servidor de desenvolvimento rodando:

```
http://localhost:3000/dev/api-validation
```

---

## Configuração

### Fixtures (parâmetros de teste)

Defaults em `.env.local` (ver `.env.example`). Override na UI — salvo em `localStorage` (`api-audit-fixtures`).

| Variável | Uso |
|----------|-----|
| `API_AUDIT_CLINIC_SLUG` | Substituir `[slug]` em booking/contact |
| `API_AUDIT_PLAN_ID` | Substituir `[id]` em admin plans |
| `API_AUDIT_CONVERSATION_ID` | Query WhatsApp messages |
| `API_AUDIT_APPOINTMENT_ID` | Transcrições |
| `API_AUDIT_FORM_INSTANCE_ID` | process-public-form-event |
| `API_AUDIT_CRON_SECRET` | Rotas cron (fallback: `CRON_SECRET`) |
| `API_AUDIT_META_VERIFY_TOKEN` | Webhook Meta GET verify |

### Contas multi-papel (batch completo)

Para o botão **Executar Auditoria** testar admin, secretária, médico e system_admin via login server-side:

```
API_AUDIT_ADMIN_EMAIL=
API_AUDIT_ADMIN_PASSWORD=
API_AUDIT_SECRETARIA_EMAIL=
API_AUDIT_SECRETARIA_PASSWORD=
API_AUDIT_MEDICO_EMAIL=
API_AUDIT_MEDICO_PASSWORD=
API_AUDIT_SYSTEM_ADMIN_EMAIL=
API_AUDIT_SYSTEM_ADMIN_PASSWORD=
```

Sem essas credenciais, os cenários por papel são marcados como *skip* no batch.

---

## Cenários de teste

| Cenário | Descrição |
|---------|-----------|
| `anonymous` | Fetch sem cookies |
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

Após **Executar Auditoria**, exporte:

- Markdown
- JSON
- CSV

Classificações: `aprovado` | `atencao` | `critico`

---

## Fluxo pré-deploy

1. Homolog: `ENABLE_API_AUDIT_PANEL=true`
2. Configure fixtures e contas de teste
3. Acesse `/dev/api-validation`
4. Confirme registry sincronizado (86/86)
5. **Executar Auditoria**
6. Revise linhas vermelhas (admin aberto, PII, stack trace)
7. Exporte Markdown para o checklist de deploy
8. **Produção:** confirme que `ENABLE_API_AUDIT_PANEL` **não** está definido

---

## Limitações

1. Um browser = uma sessão; papéis completos exigem contas env ou login manual
2. POSTs destrutivos testados em modo auth-only
3. Webhooks Stripe/Meta POST requerem assinatura real (manual)
4. OAuth callbacks dependem de state/code (manual)
5. Rate limits de booking/contact podem disparar em batch longo

---

## Arquitetura

```
app/dev/api-validation/          → UI do painel
app/api/dev/audit/               → API interna (probe, run, session, validate-registry)
lib/api-audit/                   → registry, runner, analyzer, redact, export
components/api-audit/            → componentes React
```
