# 📋 Instruções: Central de Eventos - Como Executar e Testar

## 🚀 Passo a Passo para Implementar

### 1. Executar as Migrations (na ordem)

Execute no **SQL Editor do Supabase** (https://supabase.com/dashboard → SQL Editor → New query) na seguinte ordem:

#### Ordem de execução:
1. ✅ `schema.sql` (se ainda não executou)
2. ✅ `migration-message-system.sql` (se ainda não executou)
3. ✅ `migration-message-events-allow-automatic.sql` (se ainda não executou)
4. ✅ `migration-public-forms.sql` (se ainda não executou)
5. ✅ **`migration-message-events-extend.sql`** (novos eventos: 30/15/7 dias, formulários diferenciados)
6. ✅ **`migration-event-central.sql`** (tabela event_timeline + triggers + funções)
7. ✅ **`migration-reminder-events.sql`** (funções para gerar lembretes automáticos)

### 2. Verificar se tudo foi criado corretamente

Execute estas queries para verificar:

```sql
-- Verificar se tabela event_timeline existe
SELECT COUNT(*) FROM public.event_timeline;

-- Verificar se novos eventos foram criados
SELECT code, name, category, can_be_automatic 
FROM public.message_events 
WHERE code IN (
  'appointment_reminder_30d',
  'appointment_reminder_15d', 
  'appointment_reminder_7d',
  'patient_form_completed',
  'public_form_completed',
  'appointment_marked_as_return'
)
ORDER BY code;

-- Verificar triggers
SELECT 
  trigger_name, 
  event_object_table, 
  action_timing, 
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%event%'
ORDER BY trigger_name;

-- Verificar funções criadas
SELECT 
  routine_name, 
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_event_timeline',
    'process_event_timeline',
    'get_pending_events',
    'get_past_events',
    'generate_reminder_events',
    'cleanup_invalid_reminders'
  )
ORDER BY routine_name;
```

---

## 🧪 Queries para Testar o Sistema

### Teste 1: Criar uma consulta e verificar se evento foi gerado

```sql
-- 1. Criar uma consulta (substitua os IDs pelos seus)
INSERT INTO public.appointments (
  clinic_id,
  patient_id,
  doctor_id,
  scheduled_at,
  status
) VALUES (
  'SEU_CLINIC_ID_AQUI',
  'SEU_PATIENT_ID_AQUI',
  'SEU_DOCTOR_ID_AQUI',
  now() + interval '20 days', -- 20 dias no futuro
  'agendada'
) RETURNING id;

-- 2. Verificar se evento foi criado automaticamente
SELECT 
  et.id,
  me.name AS evento,
  et.status,
  et.origin,
  et.occurred_at,
  p.full_name AS paciente
FROM public.event_timeline et
JOIN public.message_events me ON me.code = et.event_code
LEFT JOIN public.patients p ON p.id = et.patient_id
WHERE et.appointment_id = 'ID_DA_CONSULTA_CRIADA'
ORDER BY et.created_at DESC;
```

### Teste 2: Alterar status da consulta e ver eventos

```sql
-- 1. Alterar status para "confirmada"
UPDATE public.appointments
SET status = 'confirmada',
    updated_at = now()
WHERE id = 'ID_DA_CONSULTA';

-- 2. Ver eventos gerados
SELECT 
  et.id,
  me.name AS evento,
  et.status,
  et.origin,
  a.status AS status_consulta,
  et.occurred_at
FROM public.event_timeline et
JOIN public.message_events me ON me.code = et.event_code
LEFT JOIN public.appointments a ON a.id = et.appointment_id
WHERE et.appointment_id = 'ID_DA_CONSULTA'
ORDER BY et.created_at DESC;
```

### Teste 3: Remarcar consulta

```sql
-- 1. Alterar data/hora da consulta
UPDATE public.appointments
SET scheduled_at = now() + interval '25 days',
    updated_at = now()
WHERE id = 'ID_DA_CONSULTA';

-- 2. Verificar se evento de remarcação foi criado
SELECT 
  et.id,
  me.name AS evento,
  et.status,
  et.variables->>'old_scheduled_at' AS data_antiga,
  et.variables->>'new_scheduled_at' AS data_nova
FROM public.event_timeline et
JOIN public.message_events me ON me.code = et.event_code
WHERE et.appointment_id = 'ID_DA_CONSULTA'
  AND et.event_code = 'appointment_rescheduled'
ORDER BY et.created_at DESC;
```

### Teste 4: Preencher formulário vinculado

```sql
-- 1. Criar instância de formulário vinculada a uma consulta
INSERT INTO public.form_instances (
  appointment_id,
  form_template_id,
  status,
  link_token,
  responses
) VALUES (
  'ID_DA_CONSULTA',
  'ID_DO_TEMPLATE',
  'pendente',
  'token_teste_' || gen_random_uuid()::text,
  '{}'::jsonb
) RETURNING id;

-- 2. Marcar como respondido (isso deve disparar o trigger)
UPDATE public.form_instances
SET status = 'respondido',
    responses = '{"campo1": "valor1"}'::jsonb,
    updated_at = now()
WHERE id = 'ID_DA_INSTANCIA';

-- 3. Verificar se evento foi criado
SELECT 
  et.id,
  me.name AS evento,
  et.status,
  et.origin,
  et.form_instance_id
FROM public.event_timeline et
JOIN public.message_events me ON me.code = et.event_code
WHERE et.form_instance_id = 'ID_DA_INSTANCIA'
ORDER BY et.created_at DESC;
```

### Teste 5: Gerar lembretes automáticos

```sql
-- 1. Criar consultas em diferentes períodos futuros
INSERT INTO public.appointments (
  clinic_id,
  patient_id,
  doctor_id,
  scheduled_at,
  status
) VALUES 
  -- Consulta em 35 dias (deve gerar lembrete 30d)
  ('CLINIC_ID', 'PATIENT_ID', 'DOCTOR_ID', now() + interval '35 days', 'agendada'),
  -- Consulta em 10 dias (deve gerar lembrete 7d)
  ('CLINIC_ID', 'PATIENT_ID', 'DOCTOR_ID', now() + interval '10 days', 'agendada'),
  -- Consulta em 3 dias (deve gerar lembrete 48h ou 24h)
  ('CLINIC_ID', 'PATIENT_ID', 'DOCTOR_ID', now() + interval '3 days', 'agendada'),
  -- Consulta em 1 hora (deve gerar lembrete 2h)
  ('CLINIC_ID', 'PATIENT_ID', 'DOCTOR_ID', now() + interval '1 hour', 'agendada');

-- 2. Executar função para gerar lembretes
SELECT public.generate_reminder_events('SEU_CLINIC_ID_AQUI');

-- 3. Ver lembretes criados
SELECT 
  et.id,
  me.name AS evento,
  et.status,
  et.origin,
  a.scheduled_at,
  EXTRACT(EPOCH FROM (a.scheduled_at - now())) / 86400 AS dias_ate_consulta
FROM public.event_timeline et
JOIN public.message_events me ON me.code = et.event_code
JOIN public.appointments a ON a.id = et.appointment_id
WHERE et.event_code LIKE 'appointment_reminder%'
  AND et.status = 'pending'
ORDER BY a.scheduled_at ASC;
```

### Teste 6: Buscar eventos pendentes (para UI)

```sql
-- Buscar eventos pendentes de uma clínica
SELECT * FROM public.get_pending_events(
  p_clinic_id := 'SEU_CLINIC_ID_AQUI',
  p_patient_id := NULL, -- NULL = todos os pacientes
  p_event_code := NULL, -- NULL = todos os eventos
  p_limit := 50,
  p_offset := 0
);

-- Buscar eventos pendentes de um paciente específico
SELECT * FROM public.get_pending_events(
  p_clinic_id := 'SEU_CLINIC_ID_AQUI',
  p_patient_id := 'SEU_PATIENT_ID_AQUI',
  p_event_code := NULL,
  p_limit := 50,
  p_offset := 0
);

-- Buscar apenas lembretes pendentes
SELECT * FROM public.get_pending_events(
  p_clinic_id := 'SEU_CLINIC_ID_AQUI',
  p_patient_id := NULL,
  p_event_code := 'appointment_reminder_7d',
  p_limit := 50,
  p_offset := 0
);
```

### Teste 7: Buscar eventos passados (para UI)

```sql
-- Buscar eventos passados de uma clínica
SELECT * FROM public.get_past_events(
  p_clinic_id := 'SEU_CLINIC_ID_AQUI',
  p_patient_id := NULL,
  p_event_code := NULL,
  p_limit := 50,
  p_offset := 0
);

-- Buscar eventos passados de um paciente
SELECT * FROM public.get_past_events(
  p_clinic_id := 'SEU_CLINIC_ID_AQUI',
  p_patient_id := 'SEU_PATIENT_ID_AQUI',
  p_event_code := NULL,
  p_limit := 50,
  p_offset := 0
);
```

### Teste 8: Processar evento (marcar como ok ou enviar)

```sql
-- 1. Buscar um evento pendente
SELECT id, event_code, status 
FROM public.event_timeline 
WHERE status = 'pending' 
LIMIT 1;

-- 2. Marcar como "ok" sem enviar
SELECT public.process_event_timeline(
  p_event_id := 'ID_DO_EVENTO',
  p_action := 'mark_ok',
  p_processed_by := 'SEU_USER_ID_AQUI' -- opcional
);

-- 3. Verificar se status mudou
SELECT id, event_code, status, processed_at, processed_by
FROM public.event_timeline
WHERE id = 'ID_DO_EVENTO';

-- 4. Para enviar, use a ação 'send' (mas a aplicação precisa processar depois)
SELECT public.process_event_timeline(
  p_event_id := 'ID_DO_EVENTO',
  p_action := 'send',
  p_processed_by := 'SEU_USER_ID_AQUI'
);
```

### Teste 9: Limpar lembretes inválidos

```sql
-- Executar limpeza de lembretes de consultas que já passaram
SELECT public.cleanup_invalid_reminders();

-- Verificar quantos foram ignorados
SELECT 
  COUNT(*) AS total_ignorados,
  event_code
FROM public.event_timeline
WHERE status = 'ignored'
  AND event_code LIKE 'appointment_reminder%'
GROUP BY event_code;
```

---

## 📊 Queries Úteis para Monitoramento

### Ver todos os eventos de uma consulta (timeline completa)

```sql
SELECT 
  et.id,
  me.name AS evento,
  me.category AS categoria,
  et.status,
  et.origin,
  et.occurred_at AS quando_ocorreu,
  et.created_at AS quando_criado,
  et.processed_at AS quando_processado,
  p.full_name AS processado_por,
  et.channels AS canais,
  CASE 
    WHEN et.status = 'pending' THEN '⏳ Pendente'
    WHEN et.status = 'sent' THEN '✅ Enviado'
    WHEN et.status = 'completed_without_send' THEN '✓ Concluído sem envio'
    WHEN et.status = 'ignored' THEN '🚫 Ignorado'
    ELSE '❓ ' || et.status
  END AS status_formatado
FROM public.event_timeline et
JOIN public.message_events me ON me.code = et.event_code
LEFT JOIN public.profiles p ON p.id = et.processed_by
WHERE et.appointment_id = 'ID_DA_CONSULTA'
ORDER BY et.occurred_at DESC, et.created_at DESC;
```

### Estatísticas de eventos por clínica

```sql
SELECT 
  me.category AS categoria,
  me.name AS evento,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE et.status = 'pending') AS pendentes,
  COUNT(*) FILTER (WHERE et.status = 'sent') AS enviados,
  COUNT(*) FILTER (WHERE et.status = 'completed_without_send') AS concluidos_sem_envio,
  COUNT(*) FILTER (WHERE et.status = 'ignored') AS ignorados
FROM public.event_timeline et
JOIN public.message_events me ON me.code = et.event_code
WHERE et.clinic_id = 'SEU_CLINIC_ID_AQUI'
GROUP BY me.category, me.name, me.code
ORDER BY me.category, total DESC;
```

### Eventos pendentes agrupados por paciente

```sql
SELECT 
  p.full_name AS paciente,
  COUNT(*) AS eventos_pendentes,
  array_agg(DISTINCT me.name) AS tipos_eventos
FROM public.event_timeline et
JOIN public.message_events me ON me.code = et.event_code
LEFT JOIN public.patients p ON p.id = et.patient_id
WHERE et.clinic_id = 'SEU_CLINIC_ID_AQUI'
  AND et.status = 'pending'
GROUP BY p.id, p.full_name
ORDER BY eventos_pendentes DESC;
```

---

## 🔄 Configurar Execução Automática (Opcional)

Para gerar lembretes automaticamente, você pode:

### Opção 1: Cron Job no Supabase (recomendado)

No Supabase Dashboard → Database → Cron Jobs, criar:

```sql
-- Executar a cada hora
SELECT public.generate_reminder_events(NULL);

-- Limpar lembretes inválidos diariamente
SELECT public.cleanup_invalid_reminders();
```

### Opção 2: Chamar da aplicação

Chamar periodicamente (ex: via API route ou scheduled function):

```typescript
// Exemplo em TypeScript/Next.js
import { createClient } from '@/lib/supabase';

export async function generateReminders() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('generate_reminder_events', {
    p_clinic_id: null // null = todas as clínicas
  });
  
  if (error) {
    console.error('Erro ao gerar lembretes:', error);
    return;
  }
  
  console.log('Lembretes gerados:', data);
}
```

---

## ✅ Checklist de Verificação

- [ ] Todas as migrations foram executadas sem erros
- [ ] Tabela `event_timeline` existe e tem dados
- [ ] Triggers estão criados e funcionando
- [ ] Funções estão criadas e podem ser executadas
- [ ] Novos eventos aparecem em `message_events`
- [ ] Configurações de clínica foram criadas para novos eventos
- [ ] Testes básicos funcionam (criar consulta → ver evento)
- [ ] Lembretes podem ser gerados via `generate_reminder_events`
- [ ] Queries de UI (`get_pending_events`, `get_past_events`) funcionam

---

## 🐛 Troubleshooting

### Erro: "relation event_timeline does not exist"
- Execute `migration-event-central.sql` novamente

### Erro: "function create_event_timeline does not exist"
- Verifique se a função foi criada: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'create_event_timeline';`
- Se não existir, execute `migration-event-central.sql` novamente

### Eventos não estão sendo criados automaticamente
- Verifique se os triggers existem: `SELECT * FROM information_schema.triggers WHERE trigger_name LIKE '%event%';`
- Verifique se RLS não está bloqueando: `SELECT * FROM pg_policies WHERE tablename = 'event_timeline';`

### Lembretes não estão sendo gerados
- Verifique se as consultas têm `status IN ('agendada', 'confirmada')`
- Verifique se `scheduled_at` está no futuro
- Execute manualmente: `SELECT public.generate_reminder_events('SEU_CLINIC_ID');`

---

## 📝 Próximos Passos (Integração com Frontend)

1. **Criar página de Central de Eventos** (`/dashboard/eventos`)
   - Aba "Pendentes" usando `get_pending_events()`
   - Aba "Passados" usando `get_past_events()`
   - Filtros por paciente e tipo de evento

2. **Integrar com sistema de mensagens existente**
   - Quando evento é processado com ação "send", chamar `processMessageEvent()`
   - Atualizar `event_timeline.status` para 'sent' após envio confirmado

3. **Configurar execução automática de lembretes**
   - Cron job ou scheduled function para `generate_reminder_events()`
   - Executar a cada hora ou conforme necessário

4. **Adicionar eventos em cadeia**
   - Form público preenchido → evento "Cadastrar paciente"
   - Cadastro concluído → evento "Agendar consulta"

---

**Pronto!** 🎉 O sistema de Central de Eventos está implementado e pronto para uso.
