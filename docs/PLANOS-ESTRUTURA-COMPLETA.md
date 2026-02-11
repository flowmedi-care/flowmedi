# FlowMedi — Estrutura Completa de Planos

Este documento define todos os limites e features dos planos Starter e Pro.

---

## 📋 Plano Starter (Gratuito)

| Recurso | Limite |
|---------|--------|
| **Médicos** | 1 médico |
| **Secretário(a)** | Ilimitado |
| **Consultas/mês** | 30 consultas |
| **Pacientes** | Ilimitado |
| **Formulários (templates)** | 5 formulários |
| **Formulários preenchidos** | Ilimitado |
| **Campos customizados** | Ilimitado |
| **WhatsApp** | ❌ Bloqueado |
| **E-mail automático** | ❌ Bloqueado |
| **Armazenamento de exames** | 500 MB |
| **Logo personalizada** | ❌ Não |
| **Suporte** | Comunidade |

---

## 🚀 Plano Pro (Pago)

| Recurso | Limite |
|---------|--------|
| **Médicos** | Ilimitado |
| **Secretário(a)** | Ilimitado |
| **Consultas/mês** | Ilimitado |
| **Pacientes** | Ilimitado |
| **Formulários (templates)** | Ilimitado |
| **Formulários preenchidos** | Ilimitado |
| **Campos customizados** | Ilimitado |
| **WhatsApp** | ✅ Habilitado |
| **E-mail automático** | ✅ Habilitado |
| **Armazenamento de exames** | 10 GB |
| **Logo personalizada** | ✅ Sim |
| **Suporte** | Prioritário |

---

## 🔒 Comportamento ao Ultrapassar Limites

### Médicos
- **Starter**: Ao tentar adicionar 2º médico → **Bloquear** + Modal: "Upgrade para Pro para adicionar mais médicos"
- **Pro**: Sem limite

### Consultas/mês
- **Starter**: Ao atingir 30 consultas no mês → **Bloquear** criação de novas consultas + Modal: "Limite de 30 consultas/mês atingido. Upgrade para Pro para agendar sem limites"
- **Pro**: Sem limite

### Formulários (templates)
- **Starter**: Ao atingir 5 templates → **Bloquear** criação + Modal de upsell
- **Pro**: Sem limite

### WhatsApp / E-mail
- **Starter**: Botões desabilitados + Tooltip: "Disponível no plano Pro"
- **Pro**: Habilitado

### Armazenamento de exames
- **Starter**: Ao atingir 500 MB → **Bloquear** upload + Modal: "Upgrade para Pro para mais espaço (10 GB)"
- **Pro**: 
  - Aviso ao atingir 80% (8 GB)
  - Bloquear ao atingir 10 GB
  - Modal: "Limite de armazenamento atingido. Entre em contato com suporte."

### Logo personalizada
- **Starter**: Campo de upload desabilitado + Tooltip: "Disponível no plano Pro"
- **Pro**: Habilitado

---

## 🗄️ Estrutura no Banco de Dados

### Tabela `plans`

```sql
CREATE TABLE public.plans (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  
  -- Limites numéricos (NULL = ilimitado)
  max_doctors int,
  max_secretaries int,
  max_appointments_per_month int,
  max_patients int,
  max_form_templates int,
  max_custom_fields int,
  storage_mb int,
  
  -- Features booleanas
  whatsapp_enabled boolean DEFAULT false,
  email_enabled boolean DEFAULT false,
  custom_logo_enabled boolean DEFAULT false,
  priority_support boolean DEFAULT false,
  
  -- Stripe
  stripe_price_id text,
  
  -- Metadados
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### Valores no Banco

**Starter:**
- `max_doctors`: `1`
- `max_secretaries`: `NULL` (ilimitado)
- `max_appointments_per_month`: `30`
- `max_patients`: `NULL` (ilimitado)
- `max_form_templates`: `5`
- `max_custom_fields`: `NULL` (ilimitado)
- `storage_mb`: `500`
- `whatsapp_enabled`: `false`
- `email_enabled`: `false`
- `custom_logo_enabled`: `false`
- `priority_support`: `false`

**Pro:**
- `max_doctors`: `NULL` (ilimitado)
- `max_secretaries`: `NULL` (ilimitado)
- `max_appointments_per_month`: `NULL` (ilimitado)
- `max_patients`: `NULL` (ilimitado)
- `max_form_templates`: `NULL` (ilimitado)
- `max_custom_fields`: `NULL` (ilimitado)
- `storage_mb`: `10240` (10 GB)
- `whatsapp_enabled`: `true`
- `email_enabled`: `true`
- `custom_logo_enabled`: `true`
- `priority_support`: `true`

---

## 🛠️ Implementação dos Gates

Os gates devem verificar:
1. **Plano da clínica** (`clinics.plan_id`)
2. **Status da assinatura** (`clinics.subscription_status = 'active'` para Pro)
3. **Limites atuais** (contar registros e comparar com `plans.max_*`)

**Regra importante**: Para o plano Pro, só liberar recursos se `subscription_status = 'active'`. Se `past_due`, `unpaid` ou `canceled`, tratar como Starter.

---

## 📝 Notas

- **Formulários preenchidos**: Sempre ilimitados em ambos os planos
- **Pacientes**: Sempre ilimitados em ambos os planos
- **Secretários**: Sempre ilimitados em ambos os planos
- **Tipos de consulta**: Sempre ilimitados em ambos os planos (não há limite)
