# Tabletop — incidente de segurança (semestral)

**Art. 48 LGPD** — simulação sem deploy. Duração sugerida: 90 minutos.

## Cenário base

**Vazamento suspeito de mensagens WhatsApp** (`whatsapp_messages`) via token de integração comprometido.

### Injeção (T+0)

- Alerta: volume anormal de exportação via API
- Suspeita: `META_SYSTEM_USER_TOKEN` ou token de clínica vazado em log

## Roteiro

| Fase | Tempo | Ações esperadas |
|------|-------|-----------------|
| Contenção | 15 min | Rotacionar secrets, revogar tokens Meta, desabilitar integração afetada |
| Escopo | 20 min | Query `audit_log`, `whatsapp_ai_event_log`; identificar clínicas/titulares |
| Comunicação | 20 min | Notificar clínicas controladoras em 24h; template e-mail |
| Titulares/ANPD | 15 min | Clínica avalia notificação ANPD/titulares (advogado) |
| Lições | 20 min | Atualizar RIPD, runbook, treinamento |

## Participantes

- CTO (facilitador)
- Encarregado
- Suporte (comunicação clínicas)
- Jurídico (observador)

## Checklist pós-exercício

- [ ] Runbook `plano-resposta-incidentes.md` atualizado?
- [ ] Gaps de logging identificados?
- [ ] Tempo de contenção aceitável?
- [ ] Ata arquivada com data e ações

## Próxima simulação

| Data prevista | Cenário alternativo |
|---------------|---------------------|
| _+6 meses_ | Bucket `exams` com policy incorreta |
