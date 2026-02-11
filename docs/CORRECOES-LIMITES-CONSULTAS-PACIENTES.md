# Correções nos Limites de Consultas e Pacientes

## Problemas Corrigidos

### 1. ✅ Consultas/mês - Contar TODAS criadas no mês
**Problema**: Ao deletar uma consulta, podia criar outra, mesmo tendo atingido o limite de 30.

**Solução**: Agora conta **todas as consultas criadas no mês** (por `created_at`), mesmo que tenham sido deletadas depois.

**Arquivo**: `lib/plan-helpers.ts` - função `countMonthAppointments()`

**Comportamento**:
- Conta todas as consultas com `created_at` no mês atual
- Não importa se foram deletadas depois
- Quando o mês virar, o contador reseta e pode criar mais 30

---

### 2. ✅ Pacientes/mês - Contar TODOS criados no mês
**Problema**: Mesmo problema das consultas - ao deletar, podia criar outro.

**Solução**: Agora conta **todos os pacientes criados no mês** (por `created_at`), mesmo que tenham sido deletados depois.

**Arquivo**: 
- `lib/plan-helpers.ts` - função `countMonthPatients()` (nova)
- `lib/plan-gates.ts` - função `canCreatePatient()` (nova)
- `app/dashboard/pacientes/actions.ts` - gate adicionado em `createPatient()`

**Comportamento**:
- Conta todos os pacientes com `created_at` no mês atual
- Não importa se foram deletados depois
- Quando o mês virar, o contador reseta

**Nota**: No Starter, pacientes é ilimitado (`max_patients = NULL`), então não bloqueia. O código está pronto para quando/quiser adicionar limite.

---

### 3. ✅ Médicos e Formulários - Pode deletar e criar outro
**Comportamento**: Mantido como estava - pode deletar e criar outro (não conta histórico).

**Razão**: Limites são sobre quantidade atual, não sobre criação mensal.

---

### 4. ✅ Coluna `updated_at` na tabela `plans`
**Problema**: Erro ao tentar atualizar plano no admin: "Could not find the 'updated_at' column".

**Solução**: Migration criada para adicionar `updated_at` e trigger automático.

**Arquivo**: `supabase/migration-fix-plans-updated-at.sql`

**Execute no Supabase**:
```sql
-- Já está no arquivo migration-fix-plans-updated-at.sql
```

---

## Resumo das Regras

| Recurso | Starter | Pro | Conta Histórico? |
|---------|---------|-----|------------------|
| **Médicos** | 1 | Ilimitado | ❌ Não (quantidade atual) |
| **Secretários** | Ilimitado | Ilimitado | ❌ Não (quantidade atual) |
| **Consultas/mês** | 30 | Ilimitado | ✅ Sim (todas criadas no mês) |
| **Pacientes/mês** | Ilimitado* | Ilimitado | ✅ Sim (todos criados no mês) |
| **Formulários** | 5 | Ilimitado | ❌ Não (quantidade atual) |

\* Pacientes é ilimitado no Starter, mas o código está pronto para limitar se necessário.

---

## Como Funciona

### Consultas e Pacientes (com limite mensal)
1. Ao criar, conta quantas foram criadas no mês atual (por `created_at`)
2. Se atingir o limite, bloqueia criação
3. Deletar não libera espaço - o limite é sobre criação mensal
4. Quando o mês virar, o contador reseta automaticamente

### Médicos e Formulários (limite absoluto)
1. Conta quantidade atual existente
2. Se atingir o limite, bloqueia criação
3. Deletar libera espaço - pode criar outro

---

## Próximos Passos

1. **Execute a migration** `migration-fix-plans-updated-at.sql` no Supabase
2. **Teste**:
   - Criar 30 consultas no mês → deve bloquear
   - Deletar uma consulta → ainda deve estar bloqueado
   - Esperar mês virar → deve poder criar mais 30

3. **Secretários**: Está funcionando corretamente (ilimitado no Starter). Se quiser adicionar limite, atualize `max_secretaries` no plano Starter no admin.
