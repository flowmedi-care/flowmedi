# FlowMedi — Integração WhatsApp e E-mail automático

Orientações para implementar o envio de mensagens (WhatsApp e e-mail) pela secretária, de forma **transacional** e **assistida** (sistema sugere, secretária confirma).

---

## 1. Visão geral

- **Canal:** mensagens **transacionais** (lembrete de consulta, link de formulário, recomendação de jejum, confirmação). Não é chat livre.
- **Quem dispara:** a **secretária** (manual ou ao aceitar sugestão do sistema). Nada é enviado sem ação dela.
- **Regras:** só enviar se o paciente tiver **consentimento LGPD** registrado; respeitar **plano** (quando houver limite de envios).

---

## 2. WhatsApp

### 2.1 Opções de API

| Opção | Prós | Contras |
|-------|------|--------|
| **WhatsApp Business API (Meta)** | Oficial, estável | Aprovação Meta, custo por conversa, configuração mais complexa |
| **Provedor terceiro (Twilio, MessageBird, etc.)** | Abstrai parte da complexidade | Custo; ainda depende das regras Meta |
| **Evolution API / Baileys (não oficial)** | Gratuito, rápido para teste | Não oficial, risco de banimento; não recomendado para produção |

**Sugestão:** para produção, usar **WhatsApp Business API** via Meta ou via provedor (ex.: Twilio). Para MVP/teste, pode-se usar um provedor que ofereça sandbox.

### 2.2 Passos práticos (WhatsApp Business API)

1. **Conta Meta Business** e app em [developers.facebook.com](https://developers.facebook.com).
2. **Produto WhatsApp** no app; obter **Phone Number ID** e **Access Token**.
3. **Webhook** (opcional): receber status de entrega/leitura; registrar URL no Meta.
4. **Backend FlowMedi:**
   - Criar módulo **Comunicação** (ex.: `lib/comunicacao/whatsapp.ts`).
   - Função que recebe: `patientId`, `appointmentId?`, `template` ou `body`, `type` (lembrete, formulário, confirmação, recomendação).
   - Antes de enviar: checar **consentimento** (tabela `consents`) e **plano** (se plano tiver limite de envios).
   - Chamar a API do WhatsApp (Meta ou Twilio) para enviar a mensagem.
   - Inserir registro em **`message_log`** (canal `whatsapp`, tipo, `sent_at`).

5. **Templates:** a API oficial exige **templates aprovados** pela Meta para mensagens iniciadas pelo negócio. Ex.: “Sua consulta está agendada para {{1}}. Recomendações: {{2}}.” Cadastrar no Meta Business Manager.

6. **Secretária no dashboard:** botões “Enviar lembrete”, “Enviar link do formulário”, “Enviar recomendação”. Ao clicar, chamar API route/Server Action que valida consentimento + plano e chama o módulo WhatsApp; em seguida gravar em `message_log`.

### 2.3 Variáveis de ambiente (exemplo)

```env
# WhatsApp (ex.: Meta Cloud API)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
# ou Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
```

---

## 3. E-mail automático

### 3.1 Opções

| Opção | Uso típico |
|-------|------------|
| **Resend** | Transacional, API simples, bom para Vercel |
| **SendGrid** | Transacional, plano gratuito limitado |
| **Supabase Auth (built-in)** | Já usado para “esqueci senha”; pode enviar outros templates via Edge Function |
| **AWS SES / Postmark** | Custo baixo, mais configuração |

**Sugestão:** **Resend** ou **SendGrid** para e-mails transacionais (lembrete, link de formulário); manter Supabase Auth para e-mails de autenticação.

### 3.2 Passos práticos (ex.: Resend)

1. **Conta Resend** ([resend.com](https://resend.com)); criar API Key e domínio verificado.
2. **Backend FlowMedi:**
   - Módulo **Comunicação** (ex.: `lib/comunicacao/email.ts`).
   - Função `sendAppointmentReminder(patientEmail, appointment, template)` etc.
   - Checar **consentimento** e **plano** antes de enviar.
   - Inserir em **`message_log`** (canal `email`, tipo, `sent_at`).
3. **Templates:** HTML/texto para “Lembrete de consulta”, “Link do formulário”, “Recomendações (jejum)”.
4. **Secretária:** mesmo fluxo do WhatsApp — botão “Enviar por e-mail”; API route/Server Action → validação → envio → `message_log`.

### 3.3 Variáveis de ambiente (exemplo)

```env
RESEND_API_KEY=
EMAIL_FROM=FlowMedi <noreply@seudominio.com>
```

---

## 4. Fluxo único na interface (secretária)

- **Uma ação** “Enviar lembrete” pode:
  - Abrir modal: “Enviar por WhatsApp, e-mail ou ambos?”
  - Ou enviar por ambos conforme preferência da clínica (configurável depois).
- **Histórico:** tela “Mensagens enviadas” ou seção no paciente/consulta listando `message_log` (canal, tipo, data).
- **Sugestões:** lista “Paciente não confirmou”, “Formulário pendente”; ao clicar “Enviar lembrete”, sistema sugere o canal; secretária confirma e envia.

---

## 5. Ordem sugerida de implementação

1. **Consentimento LGPD** já previsto no schema; garantir checagem antes de qualquer envio.
2. **E-mail primeiro** (Resend ou similar): mais simples, sem aprovação de template; lembrete e link de formulário.
3. **Registro em `message_log`** em todo envio (e-mail e WhatsApp).
4. **WhatsApp** em seguida: cadastro no Meta/provedor, templates, módulo e botões no dashboard.
5. **Preferência da clínica** (só e-mail, só WhatsApp, ou ambos) e **limites por plano** quando houver checkout.

---

*Documento de referência para desenvolvimento; revisar conforme escolha de provedores e políticas da Meta.*
