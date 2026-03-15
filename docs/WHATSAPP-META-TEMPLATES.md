# Templates WhatsApp (Meta) — Mínimo necessário

Para o Flowmedi enviar mensagens pelo WhatsApp usando a API da Meta, é obrigatório usar **templates aprovados**. Este doc descreve o **conjunto mínimo de templates** que você deve criar no Meta Business Manager (ou via API) para cobrir todos os eventos do sistema com o menor número de templates possível.

---

## 1. Regras da Meta para templates

- Todo envio “inicial” (ou após 24h sem conversa) deve usar um **template aprovado**.
- Templates têm **nome**, **idioma** e **componentes**: cabeçalho (opcional), corpo, botões (opcional), rodapé (opcional).
- No **corpo** você pode usar variáveis no formato `{{1}}`, `{{2}}`, etc.
- Cada template precisa ser **submetido e aprovado** pela Meta antes de usar.

Criar um template por evento geraria muitos templates (e mais demora de aprovação). A ideia aqui é **reutilizar poucos templates** e variar só o texto e as variáveis.

---

## 2. Conjunto mínimo sugerido (3 templates)

Com **três templates** você cobre todos os eventos do Flowmedi: um genérico de **consulta/lembrete**, um de **formulário** e um de **ação rápida** (cancelamento, falta, etc.).

### Template 1: `flowmedi_consulta` (Consulta / lembrete / confirmação)

- **Nome:** `flowmedi_consulta`
- **Idioma:** Português (Brasil)
- **Categoria:** UTILITY (ou MARKETING se quiser botões depois)
- **Corpo (BODY):**
  ```
  Olá {{1}}!

  {{2}}

  📅 Data/hora: {{3}}
  👤 Profissional: {{4}}

  {{5}}
  ```
- **Variáveis:**
  - `{{1}}` = nome do paciente
  - `{{2}}` = frase do evento (ex.: "Sua consulta foi agendada." / "Lembrete: sua consulta está próxima." / "Sua consulta foi confirmada.")
  - `{{3}}` = data e hora da consulta
  - `{{4}}` = nome do profissional
  - `{{5}}` = nome da clínica (ou rodapé)

**Uso no Flowmedi:** eventos de agendamento, lembretes (30d, 15d, 7d, 48h, 24h, 2h), confirmação, remarcação, retorno. Só mudamos o valor de `{{2}}` conforme o evento.

---

### Template 2: `flowmedi_formulario` (Formulário / link)

- **Nome:** `flowmedi_formulario`
- **Idioma:** Português (Brasil)
- **Categoria:** UTILITY
- **Corpo (BODY):**
  ```
  Olá {{1}}!

  {{2}}

  📋 Preencha seu formulário: {{3}}

  {{4}}
  ```
- **Variáveis:**
  - `{{1}}` = nome do paciente
  - `{{2}}` = frase (ex.: "Precisamos que você preencha o formulário antes da consulta." / "Lembrete: formulário pendente.")
  - `{{3}}` = link do formulário
  - `{{4}}` = nome da clínica

**Uso no Flowmedi:** envio de link de formulário, lembrete para preencher formulário.

---

### Template 3: `flowmedi_aviso` (Avisos / cancelamento / falta / pós-consulta)

- **Nome:** `flowmedi_aviso`
- **Idioma:** Português (Brasil)
- **Categoria:** UTILITY
- **Corpo (BODY):**
  ```
  Olá {{1}}!

  {{2}}

  {{3}}
  ```
- **Variáveis:**
  - `{{1}}` = nome do paciente
  - `{{2}}` = mensagem principal (ex.: "Sua consulta foi cancelada." / "Registramos sua falta. Entre em contato para remarcar." / "Obrigado por comparecer. Agende seu retorno.")
  - `{{3}}` = nome da clínica ou instrução

**Uso no Flowmedi:** consulta cancelada, falta, consulta realizada, lembrete de retorno, formulário preenchido (aviso), etc.

---

## 3. Onde criar os templates na Meta

1. Acesse **Meta Business Suite** (business.facebook.com) ou **WhatsApp Manager**.
2. Vá em **Ferramentas de negócios** → **WhatsApp Manager** → número/conta da API.
3. Aba **Gerenciar** → **Templates de mensagem** (ou “Message templates”).
4. **Criar template** e preencher:
   - Nome exatamente como acima: `flowmedi_consulta`, `flowmedi_formulario`, `flowmedi_aviso`.
   - Idioma: Português (Brasil).
   - Componente: **Corpo** (Body) com o texto e as variáveis `{{1}}`, `{{2}}`, etc.
5. Enviar para aprovação. Após aprovação, o Flowmedi poderá usar esses nomes para enviar mensagens.

---

## 4. Mapeamento evento → template no Flowmedi

| Evento (event_code) | Template Meta | Observação |
|---------------------|---------------|------------|
| appointment_created, appointment_rescheduled, appointment_confirmed, appointment_reminder_* , return_appointment_reminder, appointment_marked_as_return | `flowmedi_consulta` | {{2}} = texto do evento (ex.: "Sua consulta foi agendada.") |
| form_link_sent, form_reminder | `flowmedi_formulario` | {{2}} = instrução; {{3}} = link |
| appointment_canceled, appointment_no_show, appointment_completed, form_completed, patient_form_completed, public_form_completed, etc. | `flowmedi_aviso` | {{2}} = mensagem principal |

O sistema (ou a configuração por evento) deve definir qual **nome de template** e quais **valores** enviar para cada variável, de acordo com o evento e com o conteúdo editável em “Mensagens” (templates do Flowmedi).

---

## 5. Resumo

- **3 templates** na Meta: `flowmedi_consulta`, `flowmedi_formulario`, `flowmedi_aviso`.
- Todos em **Português (Brasil)**, só **corpo (body)** com variáveis.
- No Flowmedi, os textos que o usuário edita (por evento/canal) são convertidos para esses templates e variáveis ao enviar pelo WhatsApp.
- Assim você solicita o **mínimo de templates na Meta** e mantém flexibilidade nos eventos e nas mensagens dentro do Flowmedi.
