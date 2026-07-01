# WhatsApp Flow — Confirmação de consulta

Fluxo formal de confirmação (toque 2d): **Confirmar** / **Cancelar** / **Remarcar**.

## Pré-requisitos na Meta

1. Conta WhatsApp Business com Cloud API conectada ao Flowmedi.
2. Criar e **publicar** um WhatsApp Flow no [Meta Business Manager](https://business.facebook.com/).
3. Criar template **`flowmedi_confirmacao_flow`** (categoria UTILITY) com:
   - **BODY:** `Olá {{1}}! {{2}}`
   - **Botão FLOW** (índice 0) vinculado ao Flow publicado.

## Estrutura do Flow (JSON de referência)

O Flow deve enviar no `response_json` ao concluir:

```json
{
  "action": "confirmar",
  "appointment_id": "{{appointment_id}}",
  "patient_id": "{{patient_id}}",
  "clinic_id": "{{clinic_id}}"
}
```

Valores aceitos para `action`:

| action | Efeito no Flowmedi |
|--------|-------------------|
| `confirmar` | Status → `confirmada` |
| `cancelar` | Status → `cancelada` |
| `remarcar` | IA inicia remarcação (`reschedule_appointment`) |

Campos opcionais em `flow_action_data` (enviados na abertura do Flow):

- `appointment_id`, `patient_id`, `clinic_id`
- `data_consulta`, `hora_consulta`, `medico`, `procedimento`

O `flow_token` é um payload base64url com `{ c: clinicId, a: appointmentId, p: patientId }`.

## Configuração no Flowmedi

### Opção A — Variáveis de ambiente (global)

```env
META_WHATSAPP_CONFIRMATION_FLOW_ID=123456789012345
META_WHATSAPP_CONFIRMATION_FLOW_TEMPLATE=flowmedi_confirmacao_flow
```

### Opção B — Por clínica (banco)

Após rodar [`migration-whatsapp-confirmation-flow.sql`](../supabase/migration-whatsapp-confirmation-flow.sql):

```sql
UPDATE clinic_virtual_assistant_settings
SET
  confirmation_flow_id = 'SEU_FLOW_ID',
  confirmation_flow_template_name = 'flowmedi_confirmacao_flow'
WHERE clinic_id = 'UUID_DA_CLINICA';
```

## Comportamento no código

| Situação | Envio |
|----------|--------|
| Ticket aberto (< 24h) | Texto livre com instrução sim/não |
| Ticket fechado + Flow configurado | Template + botão Flow |
| Ticket fechado sem Flow | Template `flowmedi_consulta` via Central de Eventos |

Respostas do Flow são tratadas em:

- [`lib/virtual-assistant/confirmation-flow-handler.ts`](../lib/virtual-assistant/confirmation-flow-handler.ts)
- Webhook: [`app/api/integrations/whatsapp/webhook/route.ts`](../app/api/integrations/whatsapp/webhook/route.ts)

Fallback: paciente pode ainda responder **sim** / **não** por texto (`parseConfirmationReply`).

## Migration

Execute no Supabase SQL Editor:

`supabase/migration-whatsapp-confirmation-flow.sql`

## Teste manual

1. Configure `confirmation_flow_id` ou env.
2. Crie consulta `agendada` para daqui a 2 dias.
3. Rode o cron: `GET /api/cron/virtual-assistant-confirmations?clinic_id=...` com `Authorization: Bearer CRON_SECRET`.
4. Paciente recebe template com botão Flow.
5. Teste cada ação e verifique status na agenda.

Script de verificação local (parsers):

```bash
node scripts/verify-confirmation-flow.mjs
```
