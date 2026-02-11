# FlowMedi — Implementação dos Gates de Planos

Este documento descreve onde e como os gates de verificação de limites dos planos foram implementados.

---

## ✅ Gates Implementados

### 1. **Criar Convite (Médico/Secretário)**
**Arquivo**: `app/dashboard/equipe/actions.ts`

- Verifica limite de médicos antes de criar convite para médico
- Verifica limite de secretários antes de criar convite para secretária
- Retorna mensagem de erro com link para upgrade se limite atingido

**Funções usadas**:
- `getClinicPlanData()` - busca dados do plano
- `countDoctors()` / `countSecretaries()` - conta membros atuais
- `canAddDoctor()` / `canAddSecretary()` - verifica se pode adicionar
- `getUpgradeMessage()` - mensagem de upsell

---

### 2. **Criar Consulta**
**Arquivo**: `app/dashboard/agenda/actions.ts`

- Verifica limite de consultas/mês antes de criar nova consulta
- Conta consultas do mês atual (primeiro dia até último dia)
- Retorna erro se limite atingido

**Funções usadas**:
- `getClinicPlanData()` - busca dados do plano
- `countMonthAppointments()` - conta consultas do mês
- `canCreateAppointment()` - verifica se pode criar
- `getUpgradeMessage()` - mensagem de upsell

---

### 3. **Criar Template de Formulário**
**Arquivo**: `app/dashboard/formularios/actions.ts`

- Verifica limite de templates de formulários antes de criar
- Conta templates existentes da clínica
- Retorna erro se limite atingido

**Funções usadas**:
- `getClinicPlanData()` - busca dados do plano
- `countFormTemplates()` - conta templates existentes
- `canCreateFormTemplate()` - verifica se pode criar
- `getUpgradeMessage()` - mensagem de upsell

---

### 4. **Criar Campo Customizado**
**Arquivo**: `app/dashboard/campos-pacientes/actions.ts`

- Verifica limite de campos customizados antes de criar
- Conta campos existentes da clínica
- Retorna erro se limite atingido

**Funções usadas**:
- `getClinicPlanData()` - busca dados do plano
- `countCustomFields()` - conta campos existentes
- `canCreateCustomField()` - verifica se pode criar
- `getUpgradeMessage()` - mensagem de upsell

---

### 5. **Upload de Exame**
**Arquivo**: `app/dashboard/exames/actions.ts`

- Verifica limite de armazenamento antes de fazer upload
- Calcula tamanho total usado pela clínica (soma de todos os exames)
- Verifica se novo arquivo + tamanho atual não excede limite
- Avisa se atingir 80% do limite (apenas para Pro)
- Retorna erro se limite atingido

**Funções usadas**:
- `getClinicPlanData()` - busca dados do plano
- `canUploadFile()` - verifica se pode fazer upload (com aviso a 80%)
- `getUpgradeMessage()` - mensagem de upsell

---

## 📋 Estrutura de Verificação

Todos os gates seguem o mesmo padrão:

```typescript
// 1. Buscar dados do plano
const planData = await getClinicPlanData();

// 2. Contar recursos atuais
const currentCount = await countResource(clinicId);

// 3. Verificar se pode criar/adicionar
const check = canDoSomething(planData.limits, currentCount);

// 4. Se não permitido, retornar erro com mensagem de upgrade
if (!check.allowed) {
  const upgradeMsg = getUpgradeMessage("recurso");
  return { error: `${check.reason}. ${upgradeMsg}` };
}

// 5. Continuar com a operação normalmente
```

---

## 🔒 Regras de Verificação

### Plano Starter
- **Médicos**: máximo 1
- **Secretários**: ilimitado
- **Consultas/mês**: máximo 30
- **Formulários**: máximo 5 templates
- **Campos customizados**: ilimitado (não há limite definido)
- **Armazenamento**: máximo 500 MB

### Plano Pro
- Todos os limites são `null` (ilimitado), exceto:
- **Armazenamento**: máximo 10 GB (10240 MB)
- **Aviso**: ao atingir 80% (8 GB)

### Status da Assinatura
- Para Pro: só libera recursos se `subscription_status = 'active'`
- Se `past_due`, `unpaid` ou `canceled`: trata como Starter

---

## 🎯 Mensagens de Erro

Todas as mensagens de erro incluem:
1. **Razão técnica**: ex. "Limite de médicos atingido (1/1)"
2. **Mensagem de upgrade**: ex. "Upgrade para Pro para adicionar mais médicos"

Exemplo completo:
```
"Limite de médicos atingido (1/1). Upgrade para Pro para adicionar mais médicos"
```

---

## 📝 Notas de Implementação

1. **Consultas/mês**: Conta do primeiro dia do mês até o último dia (00:00 até 23:59:59)
2. **Armazenamento**: Calculado em MB, soma de todos os `file_size` dos exames da clínica
3. **Aviso de armazenamento**: Para Pro, avisa ao atingir 80% mas ainda permite upload até 100%
4. **Secretários**: Sem limite em ambos os planos (não há verificação, mas gate existe para futuro)

---

## 🚀 Próximos Passos (Opcional)

1. **UI/UX**: Adicionar modais visuais quando limite atingido (além da mensagem de erro)
2. **Dashboard**: Mostrar uso atual vs limite em cards informativos
3. **Notificações**: Avisar admin quando próximo do limite (ex: 80% de consultas)
4. **Logs**: Registrar tentativas bloqueadas por limite para analytics
