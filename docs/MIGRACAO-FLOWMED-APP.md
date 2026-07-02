# Migração flowmed.app — checklist operacional

## Fase 1 — DNS Hostinger (flowmed.app)

Manter nameservers da Hostinger. **Não** trocar para `ns1.vercel-dns.com` se já usa registros A/CNAME.

| Nome | Tipo | Valor |
|------|------|-------|
| `@` | A | `76.76.21.21` |
| `www` | CNAME | `cname.vercel-dns.com` |
| `*` | CNAME | `cname.vercel-dns.com` |

**Importante:** o registro `@` deve ser `76.76.21.21`, não `216.198.79.1`.

**Redirect loop (`ERR_TOO_MANY_REDIRECTS`):** não configure redirect global de `flowmedi.com.br` → `flowmed.app` no painel Vercel **e** no middleware ao mesmo tempo. O redirect de UI é só no middleware. Se o loop persistir após deploy, confira se `NEXT_PUBLIC_APP_URL` na Vercel já é `https://flowmed.app`.

### Vercel → projeto → Settings → Domains

Adicionar (não usar redirect global no painel Vercel):

- `flowmed.app` → **Primary**
- `www.flowmed.app`
- `*.flowmed.app`

Manter conectados:

- `flowmedi.com.br`
- `www.flowmedi.com.br`
- `*.flowmedi.com.br` (se existir)

### Environment Variables (Production)

```
NEXT_PUBLIC_APP_URL=https://flowmed.app
```

Redeploy após alterar.

---

## Webhooks — não quebram no .com.br

Com ambos os domínios no **mesmo projeto** Vercel:

- `https://www.flowmedi.com.br/api/integrations/whatsapp/webhook` continua funcionando
- O middleware **não** redireciona rotas `/api/*` nem `/auth/callback`
- Migrar URLs nos painéis externos é **opcional**

---

## Fase 3 — Painéis externos

### Meta / WhatsApp

- [ ] Webhook: manter `https://www.flowmedi.com.br/api/integrations/whatsapp/webhook` ou adicionar `https://www.flowmed.app/api/integrations/whatsapp/webhook`
- [ ] OAuth callback: `https://flowmed.app/api/integrations/whatsapp/callback`
- [ ] OAuth simples: `https://flowmed.app/api/integrations/whatsapp-simple/callback`

### Stripe

- [ ] Webhook: `https://flowmed.app/api/stripe/webhook` (ou manter `.com.br`)
- [ ] Atualizar `STRIPE_WEBHOOK_SECRET` se criar endpoint novo

### Google Cloud Console (Gmail OAuth)

- [ ] Redirect URI: `https://flowmed.app/api/integrations/google/callback`
- [ ] Manter `https://flowmedi.com.br/api/integrations/google/callback` durante transição

### Supabase Auth

- [ ] Site URL: `https://flowmed.app`
- [ ] Redirect URLs: `https://flowmed.app/auth/callback`, `http://localhost:3000/auth/callback`
- [ ] Manter URLs `.com.br` na lista até migrar 100%

### GitHub Actions

- [ ] Secret `FLOWMEDI_BASE_URL` → `https://flowmed.app` (ou manter `.com.br`)

---

## E-mail noreply@flowmed.app

### Hostinger (flowmed.app)

1. Criar caixa ou encaminhamento se necessário
2. Adicionar registros DNS de envio conforme provedor SMTP

### Supabase Auth

1. Dashboard → Project Settings → Auth → SMTP / custom domain
2. Configurar remetente `FlowMed <noreply@flowmed.app>`

### Gmail OAuth (clínica)

Remetente continua sendo o Gmail conectado; apenas o nome de exibição muda para `FlowMed`.

---

## Validação pós-deploy

1. [ ] `https://flowmed.app` abre com marca FlowMed
2. [ ] `https://flowmedi.com.br` redireciona para `flowmed.app` (páginas)
3. [ ] `https://www.flowmedi.com.br/api/integrations/whatsapp/webhook` — GET de verificação Meta **sem** redirect
4. [ ] `{slug}.flowmed.app` abre site da clínica
5. [ ] Login Google retorna para `flowmed.app`
6. [ ] Checkout Stripe retorna para `flowmed.app`
