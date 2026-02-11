# Sistema de Mensagens Automáticas — Documentação Completa

Este documento explica a arquitetura e funcionamento do sistema de mensagens (email e WhatsApp) do FlowMedi.

---

## 📋 Visão Geral

O sistema permite que clínicas configurem mensagens automáticas ou manuais para pacientes, com preferências separadas para **Email** e **WhatsApp**. Cada clínica pode:

- ✅ Ativar/desativar eventos por canal (email ou WhatsApp)
- ✅ Escolher modo de envio: automático ou manual (requer aprovação)
- ✅ Criar/editar templates personalizados
- ✅ Adicionar recomendações/preparações específicas por consulta

---

## 🗂️ Estrutura de Dados

### 1. `message_events` — Eventos Fixos

Tabela com eventos pré-definidos pelo sistema. **Não podem ser editados pelos usuários**.

**Eventos disponíveis:**

| Código | Nome | Categoria | Padrão Email | Padrão WhatsApp |
|--------|------|-----------|--------------|-----------------|
| `appointment_created` | Consulta Agendada | agendamento | ✅ | ❌ |
| `appointment_rescheduled` | Consulta Remarcada | agendamento | ✅ | ✅ |
| `appointment_canceled` | Consulta Cancelada | agendamento | ✅ | ✅ |
| `appointment_confirmed` | Consulta Confirmada | agendamento | ❌ | ❌ |
| `appointment_reminder_48h` | Lembrete 48h Antes | lembrete | ✅ | ✅ |
| `appointment_reminder_24h` | Lembrete 24h Antes | lembrete | ✅ | ✅ |
| `appointment_reminder_2h` | Lembrete 2h Antes | lembrete | ❌ | ✅ |
| `form_link_sent` | Link do Formulário Enviado | formulario | ✅ | ✅ |
| `form_reminder` | Lembrete para Preencher Formulário | formulario | ✅ | ✅ |
| `form_completed` | Formulário Preenchido | formulario | ❌ | ❌ |
| `form_incomplete` | Formulário Incompleto | formulario | ✅ | ❌ |
| `appointment_completed` | Consulta Realizada | pos_consulta | ❌ | ❌ |
| `appointment_no_show` | Falta Registrada | pos_consulta | ✅ | ❌ |
| `return_appointment_reminder` | Lembrete de Retorno | pos_consulta | ✅ | ❌ |

### 2. `message_templates` — Templates Editáveis

Templates criados/editados pelos usuários. Cada template está vinculado a um evento e um canal.

**Campos importantes:**
- `event_code`: qual evento este template atende
- `channel`: `email` ou `whatsapp`
- `subject`: assunto (apenas para email)
- `body_html`: corpo da mensagem (HTML para email, texto formatado para WhatsApp)
- `variables_used`: lista de variáveis usadas no template

### 3. `clinic_message_settings` — Configurações por Clínica

Configurações separadas para **email** e **whatsapp** por evento.

**Campos importantes:**
- `channel`: `email` ou `whatsapp`
- `enabled`: evento ativado/desativado
- `send_mode`: `automatic` (envia direto) ou `manual` (requer aprovação)
- `template_id`: template a usar (se null, usa template padrão)

**Exemplo:**
- Clínica pode ter `appointment_created` **ativado** para email (automático)
- E `appointment_created` **desativado** para WhatsApp
- Ou ter WhatsApp ativado mas em modo **manual** (requer aprovação)

### 4. `pending_messages` — Fila de Aprovação

Quando `send_mode = 'manual'`, mensagens ficam aqui aguardando aprovação da secretária.

**Status:**
- `pending`: aguardando aprovação
- `approved`: aprovado, pronto para enviar
- `rejected`: rejeitado
- `sent`: enviado com sucesso
- `failed`: falha no envio

### 5. `appointments` — Campos Adicionados

Novos campos para recomendações/preparações:

- `recommendations`: texto livre com recomendações
- `requires_fasting`: boolean (precisa jejum?)
- `requires_medication_stop`: boolean (precisa parar medicação?)
- `special_instructions`: instruções especiais
- `preparation_notes`: notas de preparo

---

## 🔤 Variáveis Disponíveis nos Templates

### Variáveis de Paciente
- `{{nome_paciente}}` → Nome completo do paciente
- `{{email_paciente}}` → Email do paciente
- `{{telefone_paciente}}` → Telefone do paciente
- `{{data_nascimento}}` → Data de nascimento formatada

### Variáveis de Consulta
- `{{data_consulta}}` → Data formatada (ex: "15/02/2026")
- `{{hora_consulta}}` → Hora formatada (ex: "14:30")
- `{{data_hora_consulta}}` → Data e hora juntas
- `{{nome_medico}}` → Nome do médico
- `{{tipo_consulta}}` → Tipo/procedimento da consulta
- `{{status_consulta}}` → Status atual (agendada, confirmada, etc.)
- `{{local_consulta}}` → Endereço/local (se houver)

### Variáveis de Recomendações/Preparação
- `{{recomendacoes}}` → Campo `recommendations` da consulta
- `{{precisa_jejum}}` → "Sim" ou "Não" (baseado em `requires_fasting`)
- `{{instrucoes_especiais}}` → Campo `special_instructions`
- `{{notas_preparo}}` → Campo `preparation_notes`
- `{{preparo_completo}}` → Texto formatado com todas as instruções

### Variáveis de Formulário
- `{{link_formulario}}` → Link único do formulário
- `{{nome_formulario}}` → Nome do template do formulário
- `{{prazo_formulario}}` → Prazo para preencher (se houver)

### Variáveis de Clínica
- `{{nome_clinica}}` → Nome da clínica
- `{{telefone_clinica}}` → Telefone da clínica
- `{{endereco_clinica}}` → Endereço da clínica

---

## 🔄 Fluxo de Funcionamento

### Quando uma Consulta é Criada

1. Sistema verifica: existe evento `appointment_created` ativado para esta clínica?
2. Verifica **separadamente** para email e WhatsApp:
   - Se `enabled = true` para email → processa template email
   - Se `enabled = true` para WhatsApp → processa template WhatsApp
3. Para cada canal ativado:
   - Se `send_mode = 'automatic'`: processa template e envia imediatamente
   - Se `send_mode = 'manual'`: cria registro em `pending_messages` com status `pending`
4. Secretária vê notificação: "Nova mensagem pendente de aprovação"
5. Secretária aprova/rejeita → se aprovado, envia

### Quando uma Consulta é Remarcada

1. Sistema detecta mudança em `scheduled_at`
2. Verifica evento `appointment_rescheduled`
3. Processa conforme configuração (automático/manual) para cada canal

### Lembretes Agendados (24h/48h antes)

1. Job/cron roda periodicamente (ex: a cada hora)
2. Busca consultas que estão 24h/48h no futuro
3. Para cada uma:
   - Verifica se evento está ativado (separado por canal)
   - Verifica se já foi enviado (evitar duplicatas)
   - Processa conforme configuração

---

## 📝 Exemplo de Template

### Email — Consulta Agendada

**Assunto:** Sua consulta está agendada — {{nome_clinica}}

**Corpo HTML:**
```html
<p>Olá <strong>{{nome_paciente}}</strong>,</p>

<p>Sua consulta está agendada para:</p>
<ul>
  <li><strong>Data:</strong> {{data_consulta}}</li>
  <li><strong>Hora:</strong> {{hora_consulta}}</li>
  <li><strong>Médico:</strong> {{nome_medico}}</li>
  <li><strong>Tipo:</strong> {{tipo_consulta}}</li>
</ul>

{{#if precisa_jejum}}
<p><strong>⚠️ IMPORTANTE:</strong> Esta consulta requer jejum de 8 horas.</p>
{{/if}}

{{#if recomendacoes}}
<p><strong>Recomendações:</strong></p>
<p>{{recomendacoes}}</p>
{{/if}}

<p>Em caso de dúvidas, entre em contato: {{telefone_clinica}}</p>

<p>Atenciosamente,<br>{{nome_clinica}}</p>
```

### WhatsApp — Lembrete 24h

**Corpo:**
```
Olá {{nome_paciente}}! 👋

Lembramos que você tem uma consulta amanhã:

📅 Data: {{data_consulta}}
🕐 Hora: {{hora_consulta}}
👨‍⚕️ Médico: {{nome_medico}}

{{#if precisa_jejum}}
⚠️ IMPORTANTE: Comparecer em jejum de 8 horas.
{{/if}}

{{#if recomendacoes}}
📋 Recomendações:
{{recomendacoes}}
{{/if}}

Confirme sua presença respondendo esta mensagem ou ligue: {{telefone_clinica}}
```

---

## ⚙️ Configuração na Interface

### Tela: Configurações → Mensagens Automáticas

```
┌─────────────────────────────────────────────────────────┐
│ 📧 EMAIL                                                  │
├─────────────────────────────────────────────────────────┤
│ ✅ Consulta Agendada                          [ON/OFF]   │
│    Envio: [○ Automático] [● Manual]                    │
│    Template: [Selecionar...]                            │
│                                                          │
│ ✅ Consulta Remarcada                         [ON/OFF]   │
│    Envio: [● Automático] [○ Manual]                    │
│    Template: [Selecionar...]                            │
│                                                          │
│ ❌ Consulta Confirmada                         [ON/OFF]  │
│    ...                                                   │
├─────────────────────────────────────────────────────────┤
│ 📱 WHATSAPP                                              │
├─────────────────────────────────────────────────────────┤
│ ✅ Consulta Remarcada                         [ON/OFF]   │
│    Envio: [● Automático] [○ Manual]                    │
│    Template: [Selecionar...]                            │
│                                                          │
│ ✅ Lembrete 24h Antes                        [ON/OFF]  │
│    Envio: [● Automático] [○ Manual]                    │
│    Template: [Selecionar...]                            │
│                                                          │
│ ❌ Consulta Agendada                          [ON/OFF]   │
│    ...                                                   │
└─────────────────────────────────────────────────────────┘
```

### Tela: Criar/Editar Consulta

```
┌─────────────────────────────────────────────────────────┐
│ Paciente: [Selecionar...]                                │
│ Médico: [Selecionar...]                                  │
│ Data/Hora: [15/02/2026] [14:30]                         │
│ Tipo: [Consulta Geral]                                   │
│                                                          │
│ ⚙️ Preparação e Recomendações                            │
│ ☑ Precisa de jejum?                                     │
│ ☐ Precisa parar medicação?                              │
│                                                          │
│ Recomendações:                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Comparecer em jejum de 8 horas. Trazer exames...   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Instruções especiais:                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                      │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Tela: Mensagens Pendentes (Dashboard Secretária)

```
┌─────────────────────────────────────────────────────────┐
│ 🔔 Mensagens Pendentes de Aprovação (3)                 │
├─────────────────────────────────────────────────────────┤
│ 📧 Maria Silva - Consulta Agendada                      │
│    Evento: Consulta Agendada                            │
│    Canal: Email                                          │
│    Preview: "Olá Maria, sua consulta está agendada..."  │
│    [Aprovar e Enviar] [Rejeitar] [Ver Detalhes]         │
├─────────────────────────────────────────────────────────┤
│ 📱 João Silva - Lembrete 24h                            │
│    Evento: Lembrete 24h Antes                           │
│    Canal: WhatsApp                                       │
│    Preview: "Olá João! Lembramos que você tem..."        │
│    [Aprovar e Enviar] [Rejeitar] [Ver Detalhes]         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔒 Regras e Validações

1. **Consentimento LGPD**: Sempre verificar antes de enviar
2. **Limites do plano**: Verificar se plano permite envios
3. **Evitar duplicatas**: Não enviar mesmo evento duas vezes para mesma consulta
4. **Validação de variáveis**: Alertar se template usa variável que não existe
5. **Fallback**: Se template não existe, não enviar (ou usar template padrão do sistema)

---

## 📦 Instalação

### 1. Execute a migration principal

```sql
-- Execute no SQL Editor do Supabase
-- Arquivo: migration-message-system.sql
```

### 2. Execute a migration para clínicas existentes

```sql
-- Execute no SQL Editor do Supabase
-- Arquivo: migration-message-system-init-existing.sql
```

### 3. Verificação

```sql
-- Verificar se eventos foram criados
SELECT code, name, category FROM public.message_events ORDER BY category, name;

-- Verificar se configurações foram criadas para sua clínica
SELECT 
  me.name as evento,
  cms.channel,
  cms.enabled,
  cms.send_mode
FROM public.clinic_message_settings cms
JOIN public.message_events me ON me.code = cms.event_code
WHERE cms.clinic_id = 'SEU_CLINIC_ID_AQUI'
ORDER BY me.name, cms.channel;
```

---

## 🚀 Próximos Passos

1. ✅ Estrutura de dados criada
2. ⏳ Interface para criar/editar templates
3. ⏳ Sistema de substituição de variáveis
4. ⏳ Interface de configuração de eventos
5. ⏳ Processamento de eventos (quando acontecem)
6. ⏳ Fila de mensagens pendentes
7. ⏳ Integração com email (Resend)
8. ⏳ Integração com WhatsApp

---

## 📚 Referências

- [Documentação de Integração WhatsApp e Email](./INTEGRACAO-WHATSAPP-E-EMAIL.md)
- [Fluxo Secretária e Médico](./FLUXO-SECRETARIA-MEDICO-FORMULARIOS.md)
