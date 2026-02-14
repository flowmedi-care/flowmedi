# Plano: Eventos, Consultas, Compliance e Retorno

Documento de análise e planejamento antes da implementação. Reflete os fluxos das imagens, evita redundâncias (especialmente no fluxo de email/WPP) e alinha com a base de código atual.

---

## 1. Visão geral das mudanças

| Área | O que fazer |
|------|-------------|
| **Eventos** | Tirar "Eventos de mensagem" de Mensagens; config em uma única tela: sistema (on/off), email (on/off + auto/manual), wpp (on/off + auto/manual). Abas: **Todos**, **Pendentes**, **Concluídos** + botão **Concluir** por evento. |
| **Agenda/Consulta** | Em "nova consulta" permitir **vincular formulário**; manter opção dentro da consulta. Consultas **canceladas** não aparecem na agenda. |
| **Compliance** | Incluir prazo para **formulário não respondido** (ex.: X dias antes da consulta). |
| **Retorno** | Config de retorno (quando enviar lembrete). Em `/agenda/consulta/[id]` se status = **realizada**, trocar botão "Reagendar" por **"Agendar retorno"** (remarca e muda tipo para retorno; mantém formulários). Tipos **regular** e **retorno** para todos. |
| **Lembretes** | Consulta agendada, remarcada e de retorno iniciam a contagem (30d → 15d → 7d → 48h → 24h → 2h). |
| **Sidebar** | Aba **Consultas** para listar consultas (já existe `/dashboard/consulta`; revisar rótulo/visibilidade). |
| **Admin** | Config: **quais médicos cada secretária atende**; usar no agendamento/consultas. |

---

## 2. Modelo de dados (alterações)

### 2.1 Configuração de eventos: “sistema (on/off)” e uma tela só

- **Onde:** `clinic_message_settings` ou nova tabela de config por evento (por clínica e por evento, não por canal).
- **Proposta:** estender `clinic_message_settings` com um “sistema” por evento. Hoje já existe uma linha por `(clinic_id, event_code, channel)`. Duas opções:
  - **A)** Nova tabela `clinic_event_config` com `(clinic_id, event_code, system_enabled)` e manter email/wpp em `clinic_message_settings`.
  - **B)** Coluna `system_enabled` em uma tabela por evento (uma linha por `clinic_id` + `event_code`), e email/wpp continuam em `clinic_message_settings`.

Recomendação: **B** com tabela `clinic_event_config (clinic_id, event_code, system_enabled)` para não duplicar “sistema” por canal. Na UI, uma única tela por evento com:

- **Sistema:** on/off (define se entra em **Pendentes**).
- **Email:** on/off + automático/manual.
- **WhatsApp:** on/off + automático/manual.
- Template por canal (como hoje).

### 2.2 Abas de eventos (Todos, Pendentes, Concluídos)

- **Pendentes:** `event_timeline` com `status = 'pending'` **e** `clinic_event_config.system_enabled = true` para aquele `event_code`.
- **Todos:** todos os eventos da clínica (pendentes + não pendentes), independente de `system_enabled`.
- **Concluídos:** eventos com `status IN ('sent', 'completed_without_send')` (e eventualmente um status explícito `completed` se quisermos distinguir “concluído sem envio” do “enviado”).

Botão **Concluir:** ação que marca o evento como concluído (ex.: `completed_without_send` ou novo status `completed`), fazendo-o aparecer na aba Concluídos.

### 2.3 Consulta: tipo “retorno” e agendar retorno

- **appointments:** já tem `appointment_type_id`. Garantir que existam tipos **Consulta** (regular) e **Retorno** (por clínica ou sistema). Não é obrigatório novo campo; pode ser só um `appointment_type` chamado “Retorno”.
- **Agendar retorno:** ao clicar em “Agendar retorno” (quando status = realizada): abrir fluxo de reagendar (nova data/hora) e, ao salvar, setar `appointment_type_id` para o tipo “Retorno” e manter `form_instances` (não recriar).

### 2.4 Compliance: formulário não respondido

- **clinics:** nova coluna, por exemplo `compliance_form_days integer` (dias antes da consulta em que o formulário deve estar respondido). NULL = desligado.
- **Lembrete para preencher formulário:** já existe evento `form_reminder`; o job de compliance deve criar/disparar esse evento quando faltar X dias e houver formulário pendente.

### 2.5 Retorno: quando enviar lembrete

- **clinics:** nova coluna, ex.: `return_reminder_days integer` (dias após consulta realizada para sugerir/enviar lembrete de retorno). Opcional.
- **Lembrete de retorno:** evento `return_appointment_reminder`; mesma lógica dos lembretes, mas com texto “retorno” e disparo baseado em `return_reminder_days` após `realizada`.

### 2.6 Secretária ↔ médicos (admin)

- Nova tabela: `secretary_doctors (clinic_id, profile_id, doctor_id)` onde `profile_id` é secretária e `doctor_id` é o médico que ela atende. Ou `profiles` com JSON `allowed_doctor_ids` para secretária. Recomendação: tabela `secretary_doctors (clinic_id, secretary_id, doctor_id)` UNIQUE(clinic_id, secretary_id, doctor_id).
- No agendamento e na lista de consultas: se o usuário for secretária, filtrar médicos pelos que ela atende.

### 2.7 Consultas canceladas fora da agenda

- Na query da agenda (e na lista de consultas, se desejado): excluir `status = 'cancelada'` (ou filtrar na UI). Não remover da base; só não exibir na agenda.

---

## 3. Fluxo único “Entrar em contato” (sem redundância)

Objetivo: um único lugar que decide **se** e **como** entrar em contato (email/WPP), evitando repetir a mesma lógica em vários ramos.

### 3.1 Entrada

Sempre que um evento for criado ou for exibido na UI:

1. Dado: `event_timeline.id` (ou `event_code` + `clinic_id`).
2. Buscar uma única vez:
   - `clinic_event_config`: `system_enabled` (mostrar em Pendentes?).
   - `clinic_message_settings`: para esse `event_code` e `clinic_id`, linhas `channel = 'email'` e `channel = 'whatsapp'` → `enabled`, `send_mode`, `template_id`.

### 3.2 Decisão única (por evento)

- **Onde o card aparece:**
  - Se `system_enabled` → card em **Pendentes** (e em Todos).
  - Se não → card só em **Todos** (sem botão de enviar, ou com indicação “evento desativado no sistema”).
- **Email:**
  - Se `enabled` e `send_mode = 'automatic'` → enviar na hora (template vinculado ao evento, destinatário do formulário/paciente).
  - Se `enabled` e `send_mode = 'manual'` → card com botão “Enviar email”.
  - Se não `enabled` → não mostrar opção de envio por email.
- **WhatsApp:** mesma regra (automático vs manual, habilitado ou não).

Assim, não se repete “verificar configuração do evento” em cada ramo; a aplicação chama uma função única `getEventContactConfig(eventId)` e depois:
- decide onde listar o evento (Pendentes vs Todos);
- decide se envia agora (automático) ou mostra botão (manual);
- usa o mesmo mecanismo de envio (email/WPP) para todos os eventos.

### 3.3 Mapeamento dos fluxos das imagens

- **Formulário público preenchido / Usuário cadastrado:** disparam evento → “Entrar em contato” usa a config acima (sistema, email, wpp, auto/manual).
- **Consulta agendada / sem formulário respondido:** template “consulta agendada + link formulário”; **com** formulário respondido: só template “consulta agendada”. Ambos passam pelo mesmo “Entrar em contato”.
- **Consulta ainda não confirmada:** card vermelho em Pendentes ou em Todos conforme `system_enabled`; depois “Entrar em contato” igual.
- **Consulta confirmada, formulário vinculado, cancelada, remarcada/retorno, realizada, falta, lembretes, lembrete formulário, lembrete retorno:** todos terminam no mesmo ponto “Entrar em contato” com a mesma regra (config por evento + automático/manual por canal).

Isso remove a redundância de repetir o mesmo bloco “verificar configurações de evento” em cada ramo de email e WPP.

---

## 4. Fluxos por evento: disparos e ações recomendadas

Mapeamento direto dos fluxos que você desenhou: **quando dispara**, **o que aparece no card** (ação recomendada) e **onde o card aparece** (pendente / todos). Quando o canal está **on e automático**, a mensagem/email já é enviada ao destinatário; quando **manual**, o card mostra botão para enviar. Compliance de consulta sem confirmação já existe na configuração (`compliance_confirmation_days`).

| # | Evento | Quando dispara (disparo) | Ação recomendada no card | Onde o card aparece |
|---|--------|--------------------------|---------------------------|---------------------|
| 1 | **Formulário público preenchido** | Quando o paciente completa o formulário público. | Cadastrar paciente (registra em não cadastrados). | Sistema on → Pendentes; off → Todos. Se email/WPP on + automático: já envia; senão card com botão. |
| 2 | **Usuário cadastrado** | Quando aperta o botão cadastrar (paciente registrado). | Agendar consulta. | Sistema on → Card pendente; off → Card em todos eventos. **Não entra em contato** (apenas ação recomendada). |
| 3 | **Consulta sem formulário vinculado** (na criação) | Ao agendar e a consulta não tem formulário vinculado. | Vincular formulário. | (Ação na tela da consulta/agenda, não necessariamente card de evento.) |
| 4 | **Consulta ainda não confirmada** | Quando passou o prazo de compliance de confirmação (X dias) e ainda não confirmada. | Confirmar / cancelar / remarcar consulta. | Sistema on → **Card vermelho** em Pendentes; off → **Card vermelho** em Todos. → Entrar em contato. |
| 5 | **Consulta agendada** | Quando uma nova consulta é criada (status agendada). Inicia contagem dos lembretes. | — | Se canal on + automático: já envia email/WPP ao destinatário. Sem form respondido: template "consulta agendada + link formulário". Com form respondido: template só "consulta agendada". → Entrar em contato. |
| 6 | **Consulta confirmada** | Quando a consulta é confirmada (status confirmada). | No dia da consulta: Marcar como realizada / Marcar como falta / Marcar como cancelada. | Se on + automático: já envia. Depois: await até o dia → card com as 3 ações. |
| 7 | **Formulário vinculado** | Quando um novo formulário é vinculado ao paciente/consulta. Inicia contagem compliance do formulário. | — | Se on + automático: já envia. → Entrar em contato. |
| 8 | **Consulta cancelada** | Quando a consulta é cancelada (status cancelada). | — | Se on + automático: já envia. Consulta sai da agenda. |
| 9 | **Consulta remarcada** | Quando salva em "Reagendar" (nova data/hora). | — | Fluxo idêntico à consulta agendada. Se on + automático: já envia. |
| 10 | **Consulta de retorno** | Quando a consulta muda para tipo retorno (ex.: botão "Agendar retorno"). | — | Mesmo fluxo que agendada/remarcada. Se on + automático: já envia. |
| 11 | **Lembretes (30d, 15d, 7d, 48h, 24h, 2h)** | Cada um no seu horário (30 dias antes, 15 dias antes, …). | Confirmar consulta. Texto no card: "Faltam X dias para a consulta com [médico]" (somente para consultas **não confirmadas**). | Sistema on → mostrar card; off → não mostrar lembrete. → Entrar em contato. |
| 12 | **Lembrete para preencher formulário** | Quando verifica SLA de formulário (X dias antes da consulta) e não está preenchido. | Entrar em contato (com o paciente). | Card com ação recomendada. → Entrar em contato. |
| 13 | **Formulário de paciente preenchido** | Quando o paciente completa o formulário de paciente (vinculado à consulta). | — | Sistema on → Card pendente; off → Card em todos eventos. → Entrar em contato. |
| 14 | **Consulta realizada** | Quando a consulta é marcada como realizada (status realizada). | Agendar retorno. | → Entrar em contato. Na tela da consulta: trocar "Reagendar" por "Agendar retorno". |
| 15 | **Falta registrada** | Quando o paciente não comparece (status falta). | Remarcar consulta. | → Entrar em contato. |
| 16 | **Lembrete de retorno** | Mesma lógica dos lembretes, mas para retorno agendado (texto "retorno" em vez de "consulta"). | Confirmar retorno (ou equivalente). | Igual aos lembretes (sistema on/off, card, Entrar em contato). |

Resumo dos disparos por categoria (para implementação):

- **Agendamento:** consulta agendada, cancelada, confirmada, remarcada, de retorno, ainda não confirmada.
- **Lembretes:** 30d, 15d, 7d, 48h, 24h, 2h + lembrete formulário + lembrete retorno.
- **Formulário:** vinculado, paciente preenchido, público preenchido, lembrete preencher formulário.
- **Pós-consulta:** realizada, falta, lembrete de retorno.

---

## 5. Definição dos eventos (códigos e disparos técnicos)

Alinhamento com a base de código: código do evento e onde criar/atualizar o trigger.

### 5.1 Agendamento

| Evento | Código existente | Disparo técnico |
|--------|------------------|------------------|
| Consulta agendada | `appointment_created` | Trigger ao criar consulta (status agendada). |
| Consulta cancelada | `appointment_canceled` | Trigger ao mudar status para cancelada. |
| Consulta confirmada | `appointment_confirmed` | Trigger ao mudar status para confirmada. |
| Consulta remarcada | `appointment_rescheduled` | Trigger ao salvar nova data em “Reagendar”. |
| Consulta de retorno | `appointment_marked_as_return` | Trigger ao mudar tipo para retorno (ou ao usar “Agendar retorno”). |
| Consulta ainda não confirmada | **Criar** `appointment_not_confirmed` | Job de compliance: após `compliance_confirmation_days` sem confirmação, disparar evento. |

### 5.2 Lembretes

Já existem: `appointment_reminder_30d`, `appointment_reminder_15d`, `appointment_reminder_7d`, `appointment_reminder_48h`, `appointment_reminder_24h`, `appointment_reminder_2h`.

- Regra: se faltar menos de 30 dias, não disparar 30d (próximo válido é 15d, etc.). Já coberto em `migration-reminder-events.sql` com intervalos (ex.: 30d entre 15 e 30 dias).
- Consulta agendada, remarcada e de retorno: todas iniciam a contagem dos lembretes (mesma função/job).
- Card de lembrete: só para consultas **não confirmadas**; texto "faltam X dias para a consulta com [médico]"; ação recomendada: **Confirmar consulta**.

### 5.3 Formulário

| Evento | Código existente | Disparo técnico |
|--------|------------------|------------------|
| Formulário vinculado | **Criar** `form_linked` | Quando um formulário é vinculado à consulta (ex.: novo form na consulta). Inicia contagem compliance formulário. |
| Formulário de paciente preenchido | `patient_form_completed` | Trigger em form_instances status → respondido. |
| Formulário público preenchido | `public_form_completed` | Já existe. Registra em não cadastrados; ação recomendada: Cadastrar paciente. |
| Lembrete para preencher formulário | `form_reminder` | Job de compliance quando `compliance_form_days` não atendido. Ação recomendada: Entrar em contato. |

### 5.4 Pós-consulta

| Evento | Código existente | Disparo técnico |
|--------|------------------|------------------|
| Consulta realizada | `appointment_completed` | Trigger ao marcar como realizada. Ação recomendada: Agendar retorno. |
| Falta registrada | `appointment_no_show` | Trigger ao marcar falta. Ação recomendada: Remarcar consulta. |
| Lembrete de retorno | `return_appointment_reminder` | Mesma lógica dos lembretes, texto "retorno"; usar `return_reminder_days` após realizada. |

---

## 6. Ordem sugerida de implementação

1. **DB e eventos**
   - Migration: `clinic_event_config (clinic_id, event_code, system_enabled)` e popular.
   - Migration: evento `appointment_not_confirmed` e `form_linked` em `message_events`; criar configs em `clinic_message_settings` e `clinic_event_config`.
   - Migration: `compliance_form_days` e `return_reminder_days` em `clinics`.
   - Migration: `secretary_doctors (clinic_id, secretary_id, doctor_id)`.

2. **Backend eventos**
   - Ajustar `get_pending_events`: filtrar por `system_enabled = true`.
   - Criar `get_all_events` (Todos) e manter/renomear `get_past_events` para Concluídos (status sent / completed_without_send).
   - Action “Concluir” evento: atualizar status para `completed_without_send` (ou `completed`).
   - Função única `getEventContactConfig(event_id)` e uso dela no envio e na UI.

3. **UI Eventos**
   - Página Eventos: abas **Todos**, **Pendentes**, **Concluídos**; botão **Concluir** em cada card.
   - Mover/duplicar configuração de eventos de Mensagens para Eventos: uma tela por evento com Sistema, Email (on/off + auto/manual), WPP (on/off + auto/manual). Remover abas Email/WhatsApp; tudo na mesma configuração.

4. **Agenda e consulta**
   - Nova consulta: opção “Vincular formulário” (além de tipo/procedimento).
   - Agenda e listagens: excluir `status = 'cancelada'`.
   - Em `/agenda/consulta/[id]`: se status = realizada, mostrar “Agendar retorno” em vez de “Reagendar”; ao salvar, atualizar data e `appointment_type_id` para Retorno; manter formulários.

5. **Compliance**
   - Job/cron: consultas sem confirmação até `compliance_confirmation_days` → disparar `appointment_not_confirmed`.
   - Job: X dias antes da consulta, formulário não respondido → disparar `form_reminder` (usar `compliance_form_days`).

6. **Retorno**
   - Config em admin/clínica: “Dias para lembrete de retorno” (`return_reminder_days`).
   - Lógica de lembrete de retorno (igual outros lembretes, texto “retorno”).

7. **Secretária × médicos**
   - Tela em Configurações (admin): associar médicos por secretária.
   - Agenda e consultas: filtrar médicos pela secretária logada.

8. **Sidebar**
   - Confirmar item “Consultas” apontando para `/dashboard/consulta` e visível para os papéis corretos.

---

## 7. Decisões fechadas

- **“Cadastrar funcionário”** no fluxo de formulário público: é “Cadastrar paciente” ou realmente um passo para cadastrar funcionário? Isso afeta apenas o texto da “ação recomendada” no card.
- **Tipos de consulta “regular” e “retorno”:** criar sempre dois tipos padrão por clínica (ex.: “Consulta” e “Retorno”) ou permitir que a clínica crie com esses nomes?
- **Concluídos:** considerar apenas `sent` e `completed_without_send` ou quer um status explícito `completed` para quando o usuário clica em “Concluir”?

Com esse plano alinhado, a implementação pode seguir por fases (DB → backend eventos → UI eventos → agenda/consulta → compliance → retorno → secretária-médicos) sem duplicar a lógica de “Entrar em contato”.
