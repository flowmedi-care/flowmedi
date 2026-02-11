# 📧 Passo a Passo — Sistema de Mensagens Automáticas

Este guia explica como configurar e usar o sistema de mensagens automáticas (Email e WhatsApp) do FlowMedi.

---

## ✅ Passo 1: Executar Migrations no Supabase

### 1.1. Acesse o Supabase Dashboard

1. Vá para: https://supabase.com/dashboard
2. Selecione seu projeto
3. Clique em **SQL Editor** no menu lateral

### 1.2. Execute a Migration Principal (OBRIGATÓRIO PRIMEIRO)

⚠️ **IMPORTANTE:** Esta migration DEVE ser executada primeiro!

1. Abra o arquivo: `supabase/migration-message-system.sql`
2. Copie todo o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** (ou pressione Ctrl+Enter)
5. Aguarde a execução completar (deve mostrar "Success")
6. **Verifique se não houve erros** antes de continuar

**O que esta migration faz:**
- Cria tabela `message_events` com 14 eventos pré-definidos
- Cria tabela `message_templates` para templates editáveis
- Cria tabela `clinic_message_settings` para configurações por clínica
- Cria tabela `pending_messages` para fila de aprovação
- Adiciona campos de preparo na tabela `appointments`
- Configura RLS (Row Level Security)
- Cria trigger para inicializar configurações em novas clínicas

### 1.3. Execute a Migration para Clínicas Existentes (DEPOIS DA PRINCIPAL)

⚠️ **IMPORTANTE:** Execute esta migration APENAS DEPOIS da migration principal!

1. Abra o arquivo: `supabase/migration-message-system-init-existing.sql`
2. Copie todo o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em **Run**
5. Aguarde a execução completar

**O que esta migration faz:**
- Cria configurações padrão para todas as clínicas que já existem
- Separa configurações para Email e WhatsApp
- **Se você receber erro dizendo que a tabela não existe, significa que não executou a migration principal primeiro!**

### 1.4. Verificar se Funcionou

Execute esta query no SQL Editor para verificar:

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
WHERE cms.clinic_id = (
  SELECT clinic_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
)
ORDER BY me.name, cms.channel;
```

Você deve ver:
- 14 eventos listados
- Configurações para Email e WhatsApp de cada evento para sua clínica

---

## ✅ Passo 2: Acessar a Interface de Mensagens

1. Faça login no FlowMedi como **Admin**
2. No menu lateral, clique em **Mensagens** (ou acesse `/dashboard/mensagens`)
3. Você verá duas abas: **Email** e **WhatsApp**

---

## ✅ Passo 3: Configurar Eventos

### 3.1. Ativar/Desativar Eventos

Para cada evento, você pode:

- **Ativar/Desativar**: Use o toggle ao lado do nome do evento
- **Modo de Envio**: Se o evento pode ser automático, escolha:
  - **Automático**: Mensagem é enviada automaticamente quando o evento acontece
  - **Manual**: Mensagem fica pendente de aprovação da secretária

### 3.2. Escolher Template

- Se você criou templates personalizados, pode escolher qual usar
- Se não escolher, o sistema usa o template padrão (quando implementado)

### 3.3. Exemplo de Configuração Recomendada

**Para Email:**
- ✅ Consulta Agendada (Automático)
- ✅ Consulta Remarcada (Automático)
- ✅ Consulta Cancelada (Automático)
- ✅ Lembrete 24h Antes (Automático)
- ✅ Link do Formulário Enviado (Manual)
- ✅ Formulário Incompleto (Automático)

**Para WhatsApp:**
- ✅ Consulta Remarcada (Automático)
- ✅ Lembrete 24h Antes (Automático)
- ✅ Link do Formulário Enviado (Manual)

---

## ✅ Passo 4: Criar Templates Personalizados

### 4.1. Acessar Editor de Templates

1. Na página de Mensagens, clique em **Criar Template**
2. Ou acesse: `/dashboard/mensagens/templates` (quando implementado)

### 4.2. Criar um Template

1. Escolha o **Evento** (ex: "Consulta Agendada")
2. Escolha o **Canal** (Email ou WhatsApp)
3. Preencha o **Nome** do template
4. Para Email: preencha **Assunto**
5. Preencha o **Corpo** da mensagem usando variáveis

### 4.3. Variáveis Disponíveis

Use estas variáveis no corpo da mensagem:

**Paciente:**
- `{{nome_paciente}}` - Nome completo
- `{{email_paciente}}` - Email
- `{{telefone_paciente}}` - Telefone

**Consulta:**
- `{{data_consulta}}` - Data formatada (ex: 15/02/2026)
- `{{hora_consulta}}` - Hora formatada (ex: 14:30)
- `{{data_hora_consulta}}` - Data e hora juntas
- `{{nome_medico}}` - Nome do médico
- `{{tipo_consulta}}` - Tipo/procedimento

**Preparação:**
- `{{recomendacoes}}` - Campo de recomendações
- `{{precisa_jejum}}` - "Sim" ou "Não"
- `{{instrucoes_especiais}}` - Instruções especiais
- `{{notas_preparo}}` - Notas de preparo
- `{{preparo_completo}}` - Texto completo formatado

**Clínica:**
- `{{nome_clinica}}` - Nome da clínica
- `{{telefone_clinica}}` - Telefone da clínica

### 4.4. Exemplo de Template

**Assunto:** Sua consulta está agendada — {{nome_clinica}}

**Corpo:**
```
Olá {{nome_paciente}},

Sua consulta está agendada para:

📅 Data: {{data_consulta}}
🕐 Hora: {{hora_consulta}}
👨‍⚕️ Médico: {{nome_medico}}
📋 Tipo: {{tipo_consulta}}

{{#if precisa_jejum}}
⚠️ IMPORTANTE: Esta consulta requer jejum de 8 horas.
{{/if}}

{{#if recomendacoes}}
📋 Recomendações:
{{recomendacoes}}
{{/if}}

Em caso de dúvidas, entre em contato: {{telefone_clinica}}

Atenciosamente,
{{nome_clinica}}
```

---

## ✅ Passo 5: Usar Campos de Preparo ao Agendar Consulta

### 5.1. Ao Criar uma Consulta

1. Vá para **Agenda** → **Nova consulta**
2. Preencha os dados básicos (paciente, médico, data/hora)
3. Role até a seção **"Preparação e Recomendações"**

### 5.2. Campos Disponíveis

- ☑ **Precisa de jejum?** - Marque se a consulta requer jejum
- ☑ **Precisa parar medicação?** - Marque se precisa parar medicação
- **Recomendações** - Texto livre com recomendações gerais
- **Instruções especiais** - Instruções específicas para esta consulta
- **Notas de preparo** - Notas adicionais

### 5.3. Exemplo

Para uma colonoscopia:
- ✅ Marcar "Precisa de jejum?"
- **Recomendações:** "Comparecer em jejum de 8 horas. Trazer exames anteriores e carteirinha do convênio."
- **Instruções especiais:** "Não tomar medicamentos anticoagulantes 3 dias antes."

Essas informações aparecerão automaticamente nas mensagens enviadas ao paciente!

---

## ✅ Passo 6: Mensagens Pendentes (Modo Manual)

### 6.1. Quando uma Mensagem Fica Pendente

Se você configurou um evento como **Manual**, quando o evento acontecer:

1. A mensagem será criada mas **não enviada**
2. Aparecerá na lista de **Mensagens Pendentes**
3. A secretária pode **aprovar** ou **rejeitar**

### 6.2. Aprovar/Rejeitar

1. Acesse a lista de mensagens pendentes (quando implementado)
2. Veja o preview da mensagem
3. Clique em **Aprovar e Enviar** ou **Rejeitar**

---

## 🔧 Próximos Passos (Ainda Não Implementados)

### 1. Editor de Templates
- Interface completa para criar/editar templates
- Preview com dados de exemplo
- Validação de variáveis

### 2. Processamento de Eventos
- Sistema que detecta quando eventos acontecem
- Processa templates e substitui variáveis
- Envia mensagens automaticamente ou cria pendências

### 6. Integração com Email
- Integração com Resend ou SendGrid
- Envio real de emails

### 7. Integração com WhatsApp
- Integração com WhatsApp Business API
- Envio real de mensagens WhatsApp

### 8. Mensagens Pendentes
- Interface para ver mensagens pendentes
- Aprovar/rejeitar mensagens

### 9. Histórico de Mensagens
- Ver todas as mensagens enviadas
- Filtrar por paciente, evento, canal

---

## 🐛 Troubleshooting

### Erro: "Não autorizado"
- Certifique-se de estar logado como **Admin**
- Verifique se você tem `clinic_id` no seu perfil

### Configurações não aparecem
- Execute a migration `migration-message-system-init-existing.sql`
- Verifique se sua clínica existe na tabela `clinics`

### Eventos não aparecem
- Execute a migration `migration-message-system.sql`
- Verifique se a tabela `message_events` foi criada

### Campos de preparo não aparecem no formulário
- Certifique-se de que a migration foi executada
- Verifique se os campos foram adicionados na tabela `appointments`

---

## 📚 Documentação Adicional

- [Sistema de Mensagens Completo](./MENSAGENS-SISTEMA-COMPLETO.md)
- [Integração WhatsApp e Email](./INTEGRACAO-WHATSAPP-E-EMAIL.md)
- [Fluxo Secretária e Médico](./FLUXO-SECRETARIA-MEDICO-FORMULARIOS.md)

---

## ✅ Checklist de Implementação

- [x] Migrations criadas
- [x] Actions para templates e configurações
- [x] Sistema de variáveis
- [x] Componente de configuração de eventos
- [x] Campos de preparo no formulário de consulta
- [ ] Editor de templates (criar/editar)
- [ ] Processamento de eventos
- [ ] Integração com email
- [ ] Integração com WhatsApp
- [ ] Interface de mensagens pendentes
- [ ] Histórico de mensagens

---

**Última atualização:** 11/02/2026
