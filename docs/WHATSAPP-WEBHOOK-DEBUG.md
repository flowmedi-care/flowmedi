# Debug do Webhook WhatsApp

## Onde ver os logs do webhook

O webhook (`/api/whatsapp/webhook`) faz `console.log` do payload que a Meta envia. Para ver esses logs:

### 1. Vercel (produção)

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Abra o projeto FlowMedi
3. Vá em **Logs** (menu lateral) ou **Deployments** → clique no deployment → **Functions** / **Runtime Logs**
4. O log aparece como: `[WhatsApp Webhook] Payload recebido: {...}`

### 2. Desenvolvimento local (npm run dev)

- Os logs aparecem no **terminal** onde você rodou `npm run dev`

### 3. Erros

- Se houver erro ao inserir mensagem/conversa, aparece: `[WhatsApp Webhook] Erro ao criar conversa:` ou `[WhatsApp Webhook] Erro ao inserir mensagem:`
- Se nenhuma clínica for encontrada: `[WhatsApp Webhook] Nenhuma clínica encontrada para phone_number_id: ...`

## Configuração na Meta

1. **URL do webhook:** `https://www.flowmedi.com.br/api/whatsapp/webhook`
2. **Token de verificação:** o mesmo valor de `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` no `.env`
3. **Assinatura:** marcar o campo `messages` (mensagens recebidas)
