# Migrations Necessárias para Admin de Planos

Para o painel administrativo de planos funcionar corretamente, execute estas migrations no Supabase (nesta ordem):

## 1. ✅ Adicionar coluna `updated_at` na tabela `plans`

**Arquivo**: `supabase/migration-fix-plans-updated-at.sql`

**O que faz**:
- Adiciona coluna `updated_at` se não existir
- Cria trigger para atualizar automaticamente

**Execute primeiro** para evitar erro "Could not find the 'updated_at' column"

---

## 2. ✅ Adicionar políticas RLS para system_admin

**Arquivo**: `supabase/migration-plans-rls-system-admin.sql`

**O que faz**:
- Permite que `system_admin` faça INSERT, UPDATE e DELETE na tabela `plans`
- Mantém SELECT público (para página de preços)

**Execute depois** para permitir que você edite planos pelo admin

---

## Ordem de Execução

1. Execute `migration-fix-plans-updated-at.sql`
2. Execute `migration-plans-rls-system-admin.sql`

---

## Verificação

Após executar as migrations:

1. Acesse `/admin/system/planos`
2. Clique em "Editar" em um plano
3. Faça uma alteração e salve
4. Deve funcionar sem erros

Se ainda der erro "Plano não encontrado":
- Verifique se você é `system_admin` (execute a query de verificação abaixo)
- Verifique se o ID do plano está correto na URL

---

## Query de Verificação

Para verificar se você é system_admin:

```sql
SELECT id, email, role, clinic_id 
FROM public.profiles 
WHERE id = auth.uid();
```

Se `role` não for `'system_admin'`, execute:

```sql
UPDATE public.profiles 
SET role = 'system_admin' 
WHERE id = 'SEU_USER_ID_AQUI';
```

(Substitua `SEU_USER_ID_AQUI` pelo seu ID de usuário)
