# Guia Completo: Templates WhatsApp Meta para Flowmedi

Este documento lista **todos os templates** que você precisa criar no **Meta Business Manager** (ou WhatsApp Manager) para que o Flowmedi envie mensagens quando a **janela de 24h estiver fechada**. Também mostra o mapeamento de cada evento do app para o template correto.

---

## Por que usar templates?

- **Janela de 24h**: A Meta só permite enviar texto livre se o paciente respondeu nas últimas 24h.
- **Fora da janela**: É obrigatório usar um **template aprovado** pela Meta.
- **Templates aprovados**: Precisam ser criados e aprovados no Meta Business Manager antes de usar.

---

## Estratégia: 3 templates (reutilização máxima)

Em vez de criar um template por evento (muitos), usamos **3 templates** que cobrem todos os casos. O Flowmedi escolhe qual template usar e preenche as variáveis conforme o evento.

| Template Meta   | Uso                                      | Eventos cobertos |
|-----------------|------------------------------------------|------------------|
| `flowmedi_consulta`   | Consultas, lembretes, confirmações, remarcações | 14 eventos |
| `flowmedi_formulario` | Formulários, links, lembretes de preenchimento  | 5 eventos |
| `flowmedi_aviso`      | Avisos, cancelamentos, faltas, pós-consulta     | 7 eventos |

---

## Templates a criar no Meta Business Manager

A Meta exige **mais texto fixo** que variáveis. Cada template tem **no máximo 3 variáveis** e bastante texto fixo para aprovação.

---

### 1. flowmedi_consulta

**Onde criar:** Meta Business Suite → WhatsApp Manager → Gerenciar → Templates de mensagem → Criar template

- **Nome exato:** `flowmedi_consulta`
- **Idioma:** Português (Brasil)
- **Categoria:** UTILITY
- **Componente:** Corpo (Body)

**Corpo:**
```
Olá {{1}}!

Temos uma mensagem importante sobre sua consulta médica:

{{2}}

Para qualquer dúvida, entre em contato conosco. Atenciosamente, {{3}}
```

**Variáveis:**
- `{{1}}` = Nome do paciente
- `{{2}}` = Mensagem completa (ex: "Sua consulta foi agendada para 21/02/2025 às 14:00 com Dr. João.")
- `{{3}}` = Nome da clínica

---

### 2. flowmedi_formulario

- **Nome exato:** `flowmedi_formulario`
- **Idioma:** Português (Brasil)
- **Categoria:** UTILITY
- **Componente:** Corpo (Body)

**Corpo:**
```
Olá {{1}}!

Precisamos que você preencha o formulário antes da sua consulta. Acesse o link abaixo para preencher:

{{2}}

Obrigado por nos ajudar a preparar seu atendimento. Atenciosamente, {{3}}
```

**Variáveis:**
- `{{1}}` = Nome do paciente
- `{{2}}` = Link do formulário (URL completa)
- `{{3}}` = Nome da clínica

---

### 3. flowmedi_aviso

- **Nome exato:** `flowmedi_aviso`
- **Idioma:** Português (Brasil)
- **Categoria:** UTILITY
- **Componente:** Corpo (Body)

**Corpo:**
```
Olá {{1}}!

{{2}}

Estamos à disposição para qualquer dúvida. Atenciosamente, {{3}}
```

**Variáveis:**
- `{{1}}` = Nome do paciente
- `{{2}}` = Mensagem principal (ex: "Sua consulta foi cancelada. Para reagendar, entre em contato.")
- `{{3}}` = Nome da clínica

---

## Mapeamento: evento Flowmedi → template Meta

| event_code | Template Meta | Observação |
|------------|---------------|------------|
| `appointment_created` | flowmedi_consulta | "Confirmamos o agendamento da sua consulta." |
| `appointment_rescheduled` | flowmedi_consulta | "Sua consulta foi remarcada." |
| `appointment_confirmed` | flowmedi_consulta | "Recebemos sua confirmação." |
| `appointment_not_confirmed` | flowmedi_consulta | "Sua consulta ainda não foi confirmada." |
| `appointment_reminder_30d` | flowmedi_consulta | "Lembrete: consulta em 30 dias." |
| `appointment_reminder_15d` | flowmedi_consulta | "Lembrete: consulta em 15 dias." |
| `appointment_reminder_7d` | flowmedi_consulta | "Lembrete: sua consulta é na próxima semana." |
| `appointment_reminder_48h` | flowmedi_consulta | "Sua consulta é em 48 horas." |
| `appointment_reminder_24h` | flowmedi_consulta | "Lembrete: sua consulta é amanhã." |
| `appointment_reminder_2h` | flowmedi_consulta | "Sua consulta é em 2 horas." |
| `return_appointment_reminder` | flowmedi_consulta | "Lembrete da sua consulta de retorno." |
| `appointment_marked_as_return` | flowmedi_consulta | "Sua consulta foi marcada como retorno." |
| `form_linked` | flowmedi_formulario | "Formulário vinculado à sua consulta." |
| `form_link_sent` | flowmedi_formulario | "Link do formulário para preencher." |
| `form_reminder` | flowmedi_formulario | "Lembrete: preencha o formulário." |
| `form_incomplete` | flowmedi_formulario | "Complete o formulário." |
| `appointment_canceled` | flowmedi_aviso | "Sua consulta foi cancelada." |
| `appointment_no_show` | flowmedi_aviso | "Registramos sua falta." |
| `appointment_completed` | flowmedi_aviso | "Obrigado por comparecer à consulta." |
| `form_completed` | flowmedi_aviso | "Obrigado por preencher o formulário." |
| `patient_form_completed` | flowmedi_aviso | "Obrigado por preencher o formulário." |
| `public_form_completed` | flowmedi_aviso | "Recebemos suas informações." |
| `patient_registered` | flowmedi_aviso | "Bem-vindo à nossa clínica." |

---

## Passo a passo para criar no Meta

1. Acesse [business.facebook.com](https://business.facebook.com) ou **WhatsApp Manager**.
2. Vá em **Ferramentas de negócios** → **WhatsApp Manager** → seu número.
3. Aba **Gerenciar** → **Templates de mensagem**.
4. Clique em **Criar template**.
5. Para cada um dos 3 templates:
   - Nome: exatamente `flowmedi_consulta`, `flowmedi_formulario` ou `flowmedi_aviso`
   - Categoria: UTILITY
   - Idioma: Português (Brasil)
   - Adicione componente **Corpo** e cole o texto com `{{1}}`, `{{2}}`, etc.
6. Envie para aprovação. A Meta costuma aprovar em até 24h.

---

## Templates da Meta (Template Library)

A Meta oferece uma **Template Library** com templates pré-aprovados para casos como lembretes de pagamento e atualização de entrega. Para o Flowmedi, os casos são específicos de clínica (consultas, formulários, cancelamentos), então **não há template pré-aprovado que sirva**. É necessário criar os 3 templates customizados acima.

---

## Resumo

- **3 templates** na Meta: `flowmedi_consulta`, `flowmedi_formulario`, `flowmedi_aviso`
- Todos em **Português (Brasil)**, categoria **UTILITY**
- O Flowmedi associa automaticamente cada evento ao template correto e preenche as variáveis
- Quando a janela de 24h estiver fechada, o app usa o template e a mensagem é enviada normalmente
