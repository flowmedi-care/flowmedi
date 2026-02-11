# 📧 Configuração de Email via Google OAuth

O sistema de mensagens usa a integração Google/Gmail que você já tem configurada. Não precisa de Resend!

---

## ✅ Como Funciona

O sistema usa a função `sendEmail()` de `lib/comunicacao/email.ts` que:
1. Busca as credenciais OAuth do Google da clínica
2. Renova o token automaticamente se expirado
3. Envia email via Gmail API usando a conta conectada

---

## 🔧 Configuração Necessária

### 1. Conectar Conta Google

1. Acesse: **Configurações → Integrações**
2. Clique em **Conectar Google**
3. Autorize o acesso à conta Gmail
4. O sistema salvará as credenciais OAuth automaticamente

### 2. Verificar Conexão

O sistema verifica automaticamente se a integração está conectada antes de enviar emails. Se não estiver conectada, você verá o erro:

> "Integração Google não conectada. Conecte em Configurações → Integrações"

---

## 📝 Como Usar

### Criar Template

1. Acesse: `/dashboard/mensagens/templates`
2. Clique em **Novo Template**
3. Escolha:
   - **Evento:** ex: "Consulta Agendada"
   - **Canal:** Email
   - **Assunto:** ex: "Sua consulta está agendada"
   - **Corpo:** Use variáveis como `{{nome_paciente}}`, `{{data_consulta}}`

### Configurar Evento

1. Acesse: `/dashboard/mensagens`
2. Aba **Email**
3. Ative o evento desejado
4. Escolha modo: **Automático** ou **Manual**
5. Selecione o template criado

### Testar

1. Crie uma consulta na Agenda
2. Se o evento estiver em modo **Automático**:
   - Email será enviado automaticamente via Gmail
3. Se estiver em modo **Manual**:
   - Mensagem ficará pendente em `/dashboard/mensagens/pendentes`
   - Aprove para enviar

---

## ⚠️ Requisitos

- ✅ Conta Google conectada (OAuth)
- ✅ Paciente com email cadastrado
- ✅ Paciente com consentimento LGPD
- ✅ Template criado para o evento
- ✅ Evento ativado e configurado

---

## 🐛 Troubleshooting

### Erro: "Integração Google não conectada"
- Vá em **Configurações → Integrações**
- Conecte sua conta Google
- Verifique se o status está como "Conectado"

### Erro: "Token expirado"
- O sistema renova automaticamente
- Se persistir, desconecte e reconecte a integração

### Email não está sendo enviado
- Verifique se a integração está conectada
- Verifique se o paciente tem email cadastrado
- Verifique se o paciente tem consentimento LGPD
- Verifique os logs do console para erros específicos

---

## 📚 Arquivos Relacionados

- `lib/comunicacao/email.ts` - Função de envio via Gmail API
- `lib/message-processor.ts` - Processador de eventos
- `app/api/integrations/google/` - Rotas de OAuth

---

**Status:** ✅ Integrado com Google OAuth existente
