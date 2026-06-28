# Debug do Webhook WhatsApp

## Endpoint de debug (ver último payload)

Requer autenticação com **CRON_SECRET** (mesmo segredo dos crons):

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" \
  "https://www.flowmedi.com.br/api/whatsapp/webhook/debug"
```

Ou `?secret=SEU_CRON_SECRET` na query string.

Sem token válido, retorna **401**. Se `CRON_SECRET` não estiver configurado no servidor, retorna **503**.

**Importante:** O webhook recebe mensagens **inbound** (quando alguém envia DO celular PARA o número do negócio). Quando você digita no FlowMedi e envia, isso é **outbound** e não aciona o webhook.

## Diagnóstico visual (recomendado)

No painel: **Configurações → Assistente Virtual → Diagnóstico**

- Cards de status (assistente ativo, OpenAI, mensagens pendentes, fila presa)
- Timeline de eventos persistidos no Supabase (`whatsapp_ai_event_log`)
- Botões **Processar fila agora** e **Simular mensagem** para testar sem o celular

Rode a migration `supabase/migration-whatsapp-ai-events.sql` no Supabase antes de usar a timeline.

API (admin da clínica):

- `GET /api/whatsapp/assistant/diagnostics`
- `POST /api/whatsapp/assistant/process-now`
- `POST /api/whatsapp/assistant/simulate` — body: `{ "phone": "62999999999", "text": "Oi", "processImmediately": true }`

O endpoint `/api/whatsapp/webhook/debug` também lista os últimos eventos de IA das últimas 24h.

## Áudio inbound (assistente virtual)

Fluxo: webhook salva áudio → job de transcrição assíncrono → cron/process-now faz poll → LLM responde em **texto**.

Variáveis na Vercel: `TRANSCRIBE_API_KEY`, `TRANSCRIBE_API_URL` (opcional).

Migration opcional: `supabase/migration-whatsapp-message-mime.sql` (coluna `media_mime_type`).

## Onde ver os logs no servidor (Vercel)

O webhook faz `console.log` do payload. Para ver:

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

1. **URL do webhook:** `https://www.flowmedi.com.br/api/integrations/whatsapp/webhook`
2. **Token de verificação:** o mesmo valor de `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` no `.env`
3. **Assinatura:** marcar o campo `messages` (mensagens recebidas)
