# WhatsApp Flow — Confirmação de consulta

Fluxo formal de confirmação (toque 2d): **Confirmar** / **Cancelar** / **Remarcar**.

## Configuração no Flowmedi (recomendado)

1. Conecte o WhatsApp Meta em **Integrações**.
2. Vá em **Mensagens → Templates**.
3. Clique em **Solicitar templates do sistema**.

Isso automaticamente:

- Publica o Flow `flowmedi_confirmacao` no WABA da clínica
- Submete o template `flowmedi_confirmacao_flow` com botão **FLOW**
- Grava `confirmation_flow_id` em `clinic_virtual_assistant_settings`

Aguarde a aprovação da Meta (status em **Atualizar status** na mesma página).

## Pré-requisitos na Meta

1. Conta WhatsApp Business com Cloud API conectada ao Flowmedi.
2. Permissões para criar e publicar WhatsApp Flows no WABA.

## Template `flowmedi_confirmacao_flow`

Categoria **UTILITY**, com:

- **BODY:**

```
Olá {{1}}!

Precisamos confirmar sua presença na consulta agendada:

{{2}}

Toque no botão abaixo para confirmar, cancelar ou remarcar sua consulta.
```

- **Botão FLOW** (índice 0) vinculado ao Flow `flowmedi_confirmacao` publicado.

`{{1}}` = nome do paciente. `{{2}}` = mensagem completa (data/hora, médico — mesmo formato de `flowmedi_consulta`).

## Estrutura do Flow (JSON de referência)

O JSON bundled está em [`lib/whatsapp-confirmation-flow-definition.ts`](../lib/whatsapp-confirmation-flow-definition.ts).

O Flow deve enviar no `response_json` ao concluir:

```json
{
  "action": "confirmar"
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

## Fallback manual (apenas dev / troubleshooting)

Variáveis de ambiente (somente se não houver `confirmation_flow_id` no banco):

```env
META_WHATSAPP_CONFIRMATION_FLOW_ID=123456789012345
META_WHATSAPP_CONFIRMATION_FLOW_TEMPLATE=flowmedi_confirmacao_flow
```

Ou SQL direto:

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
| Ticket fechado + Flow configurado e publicado | Template + botão Flow |
| Ticket fechado sem Flow (ou Flow indisponível) | Template `flowmedi_consulta` (sim/não por texto) |

Respostas do Flow são tratadas em:

- [`lib/virtual-assistant/confirmation-flow-handler.ts`](../lib/virtual-assistant/confirmation-flow-handler.ts)
- Webhook: [`app/api/integrations/whatsapp/webhook/route.ts`](../app/api/integrations/whatsapp/webhook/route.ts)

Fallback: paciente pode ainda responder **sim** / **não** por texto (`parseConfirmationReply`).

Se a Meta bloquear Flows (ex.: empresa não verificada), o sistema **não interrompe** o envio: tenta o Flow uma vez e, se falhar, usa automaticamente o template `flowmedi_consulta` e limpa o `confirmation_flow_id` da clínica.

## Migrations

Execute no Supabase SQL Editor:

1. `supabase/migration-whatsapp-confirmation-flow.sql`
2. `supabase/migration-add-whatsapp-confirmacao-flow-template-key.sql`

## Teste manual

1. **Mensagens → Templates → Solicitar templates do sistema** (com WhatsApp Meta conectado).
2. Aguarde aprovação do template `flowmedi_confirmacao_flow`.
3. Crie consulta `agendada` para daqui a 2 dias.
4. Rode o cron: `GET /api/cron/virtual-assistant-confirmations?clinic_id=...` com `Authorization: Bearer CRON_SECRET`.
5. Paciente recebe template com botão Flow.
6. Teste cada ação e verifique status na agenda.

Script de verificação local (parsers):

```bash
node scripts/verify-confirmation-flow.mjs
```

## Troubleshooting de aprovação Meta

- Corpo com pouco texto fixo em relação às variáveis → use o body recomendado acima (não `Olá {{1}}! {{2}}`).
- Variável no início ou fim do modelo → termine sempre com texto fixo após `{{2}}`.
- Flow não publicado / erro `Missing dynamic data` → o Flow JSON não pode concatenar `${data.campo}` com texto fixo na mesma string. Use expressão aninhada com backticks, ex.: `` `${data.data_consulta} ' às ' ${data.hora_consulta}` ``. O projeto já usa isso em `lib/whatsapp-confirmation-flow-definition.ts`.
- Flow ficou em rascunho → clique novamente em **Solicitar templates do sistema**; o sistema reenvia o JSON corrigido e tenta publicar de novo.
- Flow não publicado por permissão → verifique permissões do WABA para criar/publicar Flows.
