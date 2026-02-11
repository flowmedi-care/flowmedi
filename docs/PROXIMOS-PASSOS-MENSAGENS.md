# 🚀 Próximos Passos — Sistema de Mensagens

Agora que as migrations foram executadas com sucesso, aqui estão os próximos passos:

---

## ✅ Passo 1: Testar a Interface de Configuração

### 1.1. Acessar a Página de Mensagens

1. Faça login no FlowMedi como **Admin**
2. No menu lateral, clique em **Mensagens**
3. Ou acesse diretamente: `/dashboard/mensagens`

### 1.2. Verificar se os Eventos Aparecem

Você deve ver:
- Duas abas: **Email** e **WhatsApp**
- Lista de eventos organizados por categoria:
  - **Agendamento**: Consulta Agendada, Remarcada, Cancelada, etc.
  - **Lembretes**: 48h Antes, 24h Antes, 2h Antes
  - **Formulários**: Link Enviado, Lembrete, Preenchido, Incompleto
  - **Pós-Consulta**: Realizada, Falta, Retorno

### 1.3. Testar Configurações

1. **Ativar um evento:**
   - Clique no toggle ao lado de "Consulta Agendada" (aba Email)
   - Deve mudar para "ON"

2. **Mudar modo de envio:**
   - Se o evento está ativado, escolha entre "Automático" ou "Manual"
   - Deve salvar automaticamente

3. **Testar em ambas as abas:**
   - Configure alguns eventos na aba **Email**
   - Configure outros eventos na aba **WhatsApp**
   - Verifique se as configurações são independentes

---

## ✅ Passo 2: Testar Campos de Preparo na Consulta

### 2.1. Criar uma Consulta com Preparo

1. Vá para **Agenda** → **Nova consulta**
2. Preencha os dados básicos:
   - Paciente
   - Médico
   - Data/Hora
   - Tipo de consulta

3. Role até a seção **"Preparação e Recomendações"**

4. Preencha os campos:
   - ☑ Marque "Precisa de jejum?"
   - **Recomendações:** "Comparecer em jejum de 8 horas. Trazer exames anteriores."
   - **Instruções especiais:** "Não tomar medicamentos anticoagulantes 3 dias antes."

5. Clique em **Agendar**

### 2.2. Verificar se os Dados Foram Salvos

1. Abra a consulta que você acabou de criar
2. Verifique se os campos de preparo aparecem (quando implementado na visualização)

Ou execute esta query no Supabase para verificar:

```sql
SELECT 
  id,
  recommendations,
  requires_fasting,
  special_instructions,
  preparation_notes
FROM public.appointments
ORDER BY created_at DESC
LIMIT 5;
```

---

## ✅ Passo 3: Verificar Dados no Banco

Execute estas queries para verificar se tudo está funcionando:

### 3.1. Verificar Eventos

```sql
SELECT code, name, category, default_enabled_email, default_enabled_whatsapp
FROM public.message_events
ORDER BY category, name;
```

**Deve retornar:** 14 eventos

### 3.2. Verificar Configurações da Sua Clínica

```sql
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

**Deve retornar:** Configurações para Email e WhatsApp de cada evento

### 3.3. Verificar Campos de Preparo

```sql
SELECT 
  id,
  scheduled_at,
  recommendations,
  requires_fasting,
  requires_medication_stop,
  special_instructions,
  preparation_notes
FROM public.appointments
WHERE recommendations IS NOT NULL 
   OR requires_fasting = true
   OR special_instructions IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎯 Próximas Implementações Necessárias

### 1. Editor de Templates (Prioridade Alta)

**O que falta:**
- Interface para criar/editar templates
- Editor de texto com preview
- Painel de variáveis disponíveis
- Validação de variáveis

**Arquivos a criar:**
- `app/dashboard/mensagens/templates/page.tsx`
- `app/dashboard/mensagens/templates/[id]/page.tsx`
- `app/dashboard/mensagens/template-editor.tsx`

### 2. Processamento de Eventos (Prioridade Alta)

**O que falta:**
- Sistema que detecta quando eventos acontecem
- Processa templates e substitui variáveis
- Cria mensagens pendentes (modo manual)
- Envia mensagens automaticamente (modo automático)

**Arquivos a criar:**
- `lib/message-processor.ts` - Processador de eventos
- Integração nas actions de consulta (`app/dashboard/agenda/actions.ts`)
- Job/cron para lembretes agendados

### 3. Interface de Mensagens Pendentes (Prioridade Média)

**O que falta:**
- Lista de mensagens pendentes de aprovação
- Preview da mensagem
- Botões de aprovar/rejeitar

**Arquivos a criar:**
- `app/dashboard/mensagens/pendentes/page.tsx`
- Componente de lista de pendentes

### 4. Integração com Email (Prioridade Alta)

**O que falta:**
- Configurar Resend ou SendGrid
- Função para enviar emails
- Processar mensagens aprovadas

**Arquivos a criar:**
- `lib/email/sender.ts`
- Variáveis de ambiente para API key

### 5. Integração com WhatsApp (Prioridade Média)

**O que falta:**
- Configurar WhatsApp Business API
- Função para enviar mensagens
- Processar mensagens aprovadas

**Arquivos a criar:**
- `lib/whatsapp/sender.ts`
- Variáveis de ambiente para credenciais

### 6. Histórico de Mensagens (Prioridade Baixa)

**O que falta:**
- Lista de todas as mensagens enviadas
- Filtros por paciente, evento, canal
- Visualização de detalhes

**Arquivos a criar:**
- `app/dashboard/mensagens/historico/page.tsx`

---

## 📋 Checklist de Testes

- [ ] Migrations executadas com sucesso
- [ ] Página `/dashboard/mensagens` acessível
- [ ] Eventos aparecem organizados por categoria
- [ ] Toggle de ativar/desativar funciona
- [ ] Modo de envio (automático/manual) funciona
- [ ] Configurações são salvas corretamente
- [ ] Campos de preparo aparecem no formulário de consulta
- [ ] Dados de preparo são salvos ao criar consulta
- [ ] Configurações são independentes entre Email e WhatsApp

---

## 🐛 Se Algo Não Funcionar

### Erro: "Não autorizado"
- Certifique-se de estar logado como **Admin**
- Verifique se você tem `clinic_id` no seu perfil

### Eventos não aparecem
- Execute a query de verificação acima
- Verifique se a migration principal foi executada

### Configurações não salvam
- Abra o console do navegador (F12)
- Verifique se há erros
- Verifique se a action está sendo chamada

### Campos de preparo não aparecem
- Verifique se a migration foi executada
- Verifique se os campos foram adicionados na tabela `appointments`

---

## 📚 Documentação de Referência

- [Sistema de Mensagens Completo](./MENSAGENS-SISTEMA-COMPLETO.md)
- [Passo a Passo Completo](./PASSO-A-PASSO-MENSAGENS.md)
- [Integração WhatsApp e Email](./INTEGRACAO-WHATSAPP-E-EMAIL.md)

---

**Última atualização:** 11/02/2026
