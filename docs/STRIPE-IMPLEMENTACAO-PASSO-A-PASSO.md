# Stripe — Implementação passo a passo (checkout no seu site)

Este documento explica **o que é cada coisa no Stripe** e **em que ordem** fazer no Dashboard e no código. Objetivo: **checkout transparente** (tudo dentro do FlowMedi, sem redirecionar para página da Stripe).

---

## Conceitos do Stripe que você vai usar

| Conceito | O que é (em uma frase) |
|----------|------------------------|
| **Product** | O “produto” que você vende. Ex.: “FlowMedi Pro”. |
| **Price** | Quanto custa e de que forma (uma vez ou recorrente). Ex.: R$ 99/mês. Um Product pode ter vários Prices (mensal, anual). |
| **Customer** | Quem paga. No seu caso: **uma clínica** = um Customer. Você cria o Customer na primeira vez que o admin vai assinar e guarda o `stripe_customer_id` na clínica. |
| **Subscription** | Assinatura ativa: “esta clínica está no plano Pro até dia X”. A Stripe renova sozinha e cobra todo mês. |
| **Checkout Session** | Uma “sessão de pagamento”. Você cria no backend; o frontend usa para mostrar o formulário de cartão **dentro do seu site** (Embedded Checkout = iframe na sua página). |
| **Webhook** | A Stripe chama uma URL sua quando algo acontece (ex.: assinatura criada, cancelada, fatura paga). Você usa isso para atualizar o `plan_id` da clínica no Supabase. |

Fluxo em uma linha: **Admin clica “Assinar Pro” → seu backend cria Checkout Session (embedded) → na sua página abre o formulário Stripe (iframe) → usuário paga → Stripe dispara webhook → você atualiza a clínica para plano Pro.**

---

## Visão geral do que vamos fazer

1. **No Stripe Dashboard:** criar Product + Price (Pro), pegar chaves API e configurar webhook.
2. **No Supabase:** adicionar campos para Stripe (`stripe_customer_id` na clínica, `stripe_price_id` no plano).
3. **No código:** API para criar Checkout Session (embedded), página de plano que embute o checkout, e rota de webhook que atualiza a clínica.

---

## Fase 1 — Stripe Dashboard (você faz na conta que abriu)

### 1.1 Modo de teste

- No Dashboard da Stripe, deixe em **Modo de teste** (toggle “Test mode” ligado) até tudo funcionar.
- Chaves de teste começam com `pk_test_` e `sk_test_`.

### 1.2 Criar o produto e o preço do plano Pro

1. **Produtos** → **Adicionar produto**.
2. Nome: `FlowMedi Pro` (ou o nome do seu plano pago).
3. Descrição (opcional): ex. “Múltiplos médicos, WhatsApp, formulários ilimitados”.
4. Em **Preços**:
   - **Adicionar outro preço**.
   - Tipo: **Recorrente** (mensal).
   - Valor: ex. R$ 99,00 (ou o que quiser para teste).
   - Moeda: BRL.
5. Salvar. Anote o **ID do preço** (começa com `price_...`). Você vai usar no código e no Supabase.

### 1.3 Chaves da API

1. **Developers** → **API keys**.
2. Anote:
   - **Publishable key** (`pk_test_...`) → frontend (só para carregar o checkout embutido).
   - **Secret key** (`sk_test_...`) → **só no backend**, nunca no frontend.

### 1.4 Webhook (depois que a rota estiver no ar)

Quando você tiver a URL em produção (ou um túnel tipo ngrok em desenvolvimento):

1. **Developers** → **Webhooks** → **Add endpoint**.
2. URL do endpoint: `https://seu-dominio.com/api/stripe/webhook` (em dev: `https://xxx.ngrok.io/api/stripe/webhook`).
3. Eventos para ouvir (mínimo recomendado):
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed` (para atualizar status quando pagamento for recusado)
   - `invoice.paid` (opcional, para log)
4. Salvar e anotar o **Signing secret** (`whsec_...`) do webhook. Você usa no backend para validar que a requisição veio mesmo da Stripe.

---

## Fase 2 — Banco de dados (Supabase)

Você precisa:

1. **Na tabela `plans`:** um jeito de saber qual Price da Stripe corresponde a qual plano.
   - Opção simples: coluna `stripe_price_id` (texto). No plano “Pro” você preenche com o `price_...` que anotou.
2. **Na tabela `clinics`:** guardar o Customer da Stripe para não criar um novo a cada assinatura.
   - Coluna `stripe_customer_id` (texto, nullable). Preenchida na primeira vez que o admin inicia o checkout.

Será criada uma migration SQL para isso (ver fase de implementação).

---

## Fase 3 — Código (Next.js + Supabase)

### 3.1 Variáveis de ambiente

No `.env.local` (e depois nos secrets da Vercel):

- `STRIPE_SECRET_KEY=sk_test_...` (secret key do passo 1.3)
- `STRIPE_WEBHOOK_SECRET=whsec_...` (signing secret do webhook, passo 1.4)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` (publishable key)
- **Webhook:** para o endpoint atualizar a clínica sem usuário logado, use `SUPABASE_SERVICE_ROLE_KEY` no ambiente da API (ex.: Vercel). Sem ela, o webhook usará a anon key e pode falhar por RLS.

O `NEXT_PUBLIC_` só pode ser usado no frontend; as outras **nunca** no frontend.

### 3.2 Pacote

- Instalar: `stripe` (SDK oficial, usado no servidor).

### 3.3 Backend: criar Checkout Session (embedded)

- **Rota:** por exemplo `POST /api/stripe/create-checkout-session`.
- **Quem pode chamar:** apenas usuário autenticado com papel **admin** da clínica.
- **O que a rota faz:**
  1. Lê o usuário (Supabase Auth) e a clínica (ex.: pelo `profile.clinic_id`).
  2. Se a clínica ainda não tem `stripe_customer_id`, cria um Customer na Stripe (usando e-mail do admin) e grava o ID na clínica.
  3. Cria uma **Checkout Session** na Stripe com:
     - `mode: 'subscription'`
     - `ui_mode: 'embedded'` (para o checkout aparecer no seu site)
     - `line_items: [{ price: stripe_price_id_do_plano_pro }]`
     - `customer: stripe_customer_id` (da clínica)
     - `return_url`: URL da sua página de plano (ex.: `https://seusite.com/dashboard/plano?session_id={CHECKOUT_SESSION_ID}`)
     - `metadata` ou `client_reference_id`: `clinic_id` (para o webhook saber qual clínica atualizar)
  4. Retorna `{ clientSecret: session.client_secret }` para o frontend.

### 3.4 Frontend: página de plano com checkout embutido

- **Página:** `/dashboard/plano` (ou `/dashboard/plano/assinar`).
- **Quem vê:** só admin (médico/secretária não veem link ou conteúdo de pagamento).
- **Fluxo:**
  1. Mostrar plano atual (Starter ou Pro) e botão “Assinar Pro” (se ainda não for Pro).
  2. Ao clicar “Assinar Pro”: chamar `POST /api/stripe/create-checkout-session` e receber `clientSecret`.
  3. Usar o **Stripe.js** (script da Stripe) para montar o **Embedded Checkout**: você passa o `clientSecret` e o checkout aparece num container na mesma página (iframe). O usuário preenche cartão e confirma **sem sair do seu site**.
  4. Após sucesso, a Stripe redireciona para o `return_url` que você passou (com `session_id`). Na página de plano você mostra “Assinatura ativa” e pode esconder o formulário.

Documentação útil: [Stripe Embedded Checkout](https://stripe.com/docs/payments/checkout/embedded).

### 3.5 Backend: webhook

- **Rota:** `POST /api/stripe/webhook`.
- **Importante:** essa rota **não** deve usar o body parseado como JSON pelo Next.js, porque a Stripe envia raw body e a assinatura é verificada com ele. No Next.js você lê o body bruto (ex.: `request.text()` ou `request.body`) e usa `stripe.webhooks.constructEvent(body, signature, webhookSecret)`.
- **Eventos e o que fazer:**
  - `checkout.session.completed`: pegar `client_reference_id` ou `metadata.clinic_id` e `subscription_id`; atualizar a clínica: `plan_id` = plano Pro; opcionalmente gravar `stripe_subscription_id` na clínica ou em tabela de assinaturas.
  - `customer.subscription.updated`: se status = `active`, garantir que a clínica está com plano Pro; se `canceled` ou `past_due`, decidir regra (ex.: manter Pro até fim do período ou mudar para Starter).
  - `customer.subscription.deleted`: setar a clínica de volta para o plano Starter (free).

Assim o “estado real” do plano fica sempre alinhado com o que a Stripe tem.

### 3.6 Gates no resto do app

- Ao verificar limites (médicos, consultas/mês, WhatsApp), use sempre o `plan_id` da clínica (e os limites definidos na tabela `plans`). Quem definir o plano no Supabase é o webhook; a UI só lê.

---

## Fase 4 — Pagamento recusado / falha (quando limitar o que foi liberado)

Quando o cliente já assinou (Pro) e depois um pagamento falha (cartão recusado, inadimplência, cancelamento), você precisa **tratar o estado da assinatura** e **restringir recursos** até regularizar ou cancelar.

### 4.1 Status da assinatura na Stripe (resumo)

| Status | Significado |
|--------|-------------|
| `active` | Tudo certo; cobrança ok. **Único status em que a clínica deve ter acesso Pro.** |
| `past_due` | A Stripe tentou cobrar e falhou (ex.: cartão recusado). Ela vai tentar de novo (retry). Você decide: dar graça ou restringir na hora. |
| `unpaid` | Várias tentativas falharam; a Stripe desiste. Assinatura pode ser cancelada em seguida. |
| `canceled` | Assinatura cancelada (pelo cliente ou pela Stripe). Acesso Pro deve acabar (no fim do período pago ou na hora, conforme o que você configurar). |

Regra recomendada: **considerar “tem acesso Pro” somente quando a assinatura está `active`.** Para qualquer outro status, tratar como plano limitado (Starter) nos gates (médicos, WhatsApp, etc.) e, na UI, mostrar mensagem clara (“Pagamento pendente” / “Atualize o cartão” / “Assinatura cancelada”).

### 4.2 O que guardar no seu banco

Para não depender só do Stripe a cada carregamento da página e para mostrar a mensagem certa para o admin:

- **Opção A (mínima):** só `plan_id`. No webhook, quando a assinatura deixar de ser `active` (cancelada, deletada, unpaid), você seta `plan_id` = Starter. Para `past_due` você pode: ou setar Starter na hora (restrição imediata) ou manter Pro mas tratar como “sem acesso” nos gates até definir uma graça (ex.: 3 dias). Nesse caso você precisa de um campo extra para saber “é Pro mas está past_due” (senão não sabe o que mostrar na UI).
- **Opção B (recomendada):** guardar também o **status da assinatura** (ex.: na clínica `subscription_status`: `active` | `past_due` | `canceled` | `unpaid` | null). Assim:
  - **Gates:** liberar recursos Pro só se `plan_id` = Pro **e** `subscription_status` = `active` (e, se quiser, durante graça para `past_due`).
  - **UI admin:** mostrar “Assinatura ativa”, “Pagamento atrasado — atualize o cartão” ou “Assinatura cancelada” conforme o status.

Ou seja: além de `plan_id`, ter `subscription_status` (e opcionalmente `current_period_end`) na clínica ou em uma tabela `subscriptions` facilita tudo.

### 4.3 Webhooks para pagamento recusado / falha

Incluir estes eventos no endpoint (e no cadastro do webhook no Dashboard):

- **`invoice.payment_failed`**  
  Cobrança falhou. Atualizar `subscription_status` para `past_due` (ou o que a subscription tiver). Opcional: enviar e-mail ao admin pedindo para atualizar o cartão.

- **`customer.subscription.updated`**  
  Sempre que a assinatura mudar (status, fim do período, etc.). Ler `subscription.status`:
  - `active` → garantir `plan_id` = Pro e `subscription_status` = `active`.
  - `past_due` → manter ou setar `subscription_status` = `past_due`; nos gates, **não** dar acesso Pro (ou dar só durante graça, se implementar).
  - `unpaid` ou `canceled` → tratar como abaixo; pode manter Pro até `current_period_end` se for “cancel at period end”.

- **`customer.subscription.deleted`**  
  Assinatura acabou. Setar `plan_id` = Starter e `subscription_status` = `canceled` (ou null). A partir daí a clínica volta a ter só os limites do Starter.

Definir uma regra clara: por exemplo “enquanto `past_due`, restringir acesso Pro na hora (ou após X dias de graça)”. O importante é que **pagamento recusado = não liberar (ou deixar de liberar) os recursos do Pro** até o pagamento ser concluído ou a assinatura ser cancelada.

### 4.4 Resumo da regra de “limitar o que foi liberado”

- **Só liberar Pro** quando `subscription_status` = `active` (e `plan_id` = Pro).
- **Pagamento recusado / falha** (`past_due`, `unpaid`) → restringir recursos (gates iguais ao Starter); na página do admin, mostrar que o pagamento está pendente e pedir para atualizar o cartão (ou usar Customer Portal).
- **Assinatura cancelada / deletada** → `plan_id` = Starter, `subscription_status` = canceled/null; recursos limitados pelo Starter.

---

## Fase 5 — Página do admin: transações e cancelar assinatura

O admin precisa **ver todas as transações** (faturas pagas, pendentes, falhas) e ter **opção clara para cancelar a assinatura**. Tudo pode ficar na sua página, sem depender de telas da Stripe (exceto se quiser usar o Portal para “atualizar cartão”).

### 5.1 O que mostrar na página “Plano e pagamento” (admin)

1. **Plano atual**  
   Nome do plano (Starter ou Pro) e status da assinatura (ativo, pagamento atrasado, cancelado, etc.), usando o que você guardou no banco (`plan_id` + `subscription_status`).

2. **Lista de transações (faturas)**  
   - Uma tabela (ou lista) com: data, descrição (ex.: “FlowMedi Pro – 01/02 a 28/02”), valor, status (pago, pendente, falhou).  
   - Os dados vêm da Stripe (objeto **Invoice**). Seu backend chama a API da Stripe (lista de invoices do `stripe_customer_id` da clínica) e devolve para o frontend, ou você guarda um cache no Supabase e atualiza via webhook. O mais simples no início: **uma rota no seu backend** (ex.: `GET /api/stripe/invoices`) que, com o usuário autenticado (admin) e a clínica dele, chama `stripe.invoices.list({ customer: clinic.stripe_customer_id })` e retorna as faturas (data, valor, status, link para PDF se quiser). O admin vê tudo na sua página.

3. **Botão “Cancelar assinatura”**  
   - Só aparece se houver assinatura ativa (ou past_due).  
   - Ao clicar: confirmação (“Tem certeza? Você perde acesso ao Pro a partir da data X.”).  
   - Se confirmar: seu backend chama a API da Stripe para cancelar a assinatura. Recomendado: **cancelar no fim do período** (`cancel_at_period_end: true`), assim o cliente continua Pro até o último dia pago e não reclama de “cobraram e cortaram na hora”. No webhook `customer.subscription.updated` / `deleted` você atualiza `plan_id` e `subscription_status` quando a Stripe refletir o cancelamento.  
   - Na UI você pode mostrar “Assinatura cancelada. Válida até DD/MM/AAAA.” até chegar essa data.

4. **Atualizar cartão / método de pagamento (opcional)**  
   - **Opção 1:** Link para o **Stripe Customer Portal**. Seu backend gera uma sessão do Portal (`stripe.billingPortal.sessions.create`) e redireciona o admin para uma página da Stripe onde ele atualiza o cartão e vê faturas. Menos código, mas o usuário sai do seu site.  
   - **Opção 2:** Manter tudo no seu site: você já terá o Embedded Checkout ou um fluxo para “atualizar método de pagamento” (ex.: SetupIntent + Payment Element). Para o primeiro lançamento, o Portal costuma ser suficiente; depois você pode substituir por algo 100% seu.

### 5.2 Rotas de API necessárias (resumo)

| Rota | Uso |
|------|-----|
| `POST /api/stripe/create-checkout-session` | Criar sessão de checkout (embedded) para assinar Pro. |
| `POST /api/stripe/webhook` | Receber eventos (checkout, subscription, invoice) e atualizar `plan_id` + `subscription_status`. |
| `GET /api/stripe/invoices` | Listar faturas do cliente (Stripe) para a clínica do admin. Retorna dados para a tabela de transações. |
| `POST /api/stripe/cancel-subscription` | Admin cancela a assinatura (Stripe: cancel at period end). Só para admin da clínica. |
| `POST /api/stripe/create-portal-session` (opcional) | Redirecionar para o Stripe Customer Portal (atualizar cartão, ver faturas). |

Todas as rotas que tocam em dados da Stripe devem checar: usuário autenticado e **admin** da clínica.

### 5.3 Fluxo na página do admin (resumo)

- Admin entra em “Plano e pagamento”.
- Vê: plano atual, status (ativo / atrasado / cancelado), lista de transações (via `GET /api/stripe/invoices`), botão “Cancelar assinatura” (com confirmação) e, se quiser, “Atualizar cartão” (Portal ou seu fluxo).
- Se cancelar: backend chama Stripe → webhook atualiza o banco → na próxima abertura da página já aparece “Starter” e “Assinatura cancelada até DD/MM”.

Assim você cobre: **pagamento recusado = limitar o que foi liberado (Fase 4)** e **admin com transações + cancelar inscrição (Fase 5)**.

---

## Ordem sugerida de implementação

| # | Onde | O quê |
|---|------|--------|
| 1 | Stripe Dashboard | Product + Price (Pro), anotar `price_...` e chaves API |
| 2 | Supabase | Migration: `plans.stripe_price_id`, `clinics.stripe_customer_id`, `clinics.stripe_subscription_id`, `clinics.subscription_status` (e opcional tabela `subscriptions`) |
| 3 | .env.local | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (webhook depois) |
| 4 | Backend | Instalar `stripe`, criar `POST /api/stripe/create-checkout-session` |
| 5 | Frontend | Página `/dashboard/plano`: botão “Assinar Pro” + Embedded Checkout com o `clientSecret` |
| 6 | Backend | Rota `POST /api/stripe/webhook` (raw body, assinatura, eventos: checkout, subscription.updated/deleted, invoice.payment_failed); atualizar `plan_id` + `subscription_status` |
| 7 | Stripe Dashboard | Cadastrar URL do webhook e eventos; colar `STRIPE_WEBHOOK_SECRET` no .env |
| 8 | App | Gates por plano: considerar Pro só quando `plan_id` = Pro **e** `subscription_status` = `active` |
| 9 | Backend | `GET /api/stripe/invoices` (listar faturas da clínica); `POST /api/stripe/cancel-subscription` (cancelar no fim do período) |
| 10 | Frontend | Na página do admin “Plano e pagamento”: plano atual, status, tabela de transações (invoices), botão “Cancelar assinatura” com confirmação |
| 11 | Backend (opcional) | `POST /api/stripe/create-portal-session` para “Atualizar cartão” via Stripe Customer Portal |

---

## Resumo “checkout transparente”

- **Checkout transparente** = uso de **Embedded Checkout** (`ui_mode: 'embedded'`): o formulário de pagamento é exibido **dentro da sua página** (iframe), sem redirecionar para checkout.stripe.com.
- Você só redireciona no final para a sua própria `return_url` (ex.: `/dashboard/plano?session_id=...`).

Quando você quiser, podemos começar pela Fase 2 (migration) e Fase 3 (código), passo a passo, arquivo por arquivo.
