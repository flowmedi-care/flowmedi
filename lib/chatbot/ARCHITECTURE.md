# Arquitetura do Agente Flowmedi

Guia de **fronteiras de responsabilidade**. Leitura obrigatória antes de contribuir.

## Seis princípios do workflow engine

1. **Lifecycle** — Operação ativa só termina por `complete()`, `abandon()`, ou interrupção explícita (`ConversationTransition`).
2. **Authority** — `active_workflow_id` é a única autoridade para rules deterministic (toda rule declara `workflow`; sem campo `owner`).
3. **No Promise** — Nunca comunicar ações futuras dependentes de tools; garantia = `ReplyPolicy` no runtime (prompt só reforça).
4. **Authoritative replies** — Cascata Structured → Domain message → LLM → Fallback; níveis 1–2 proíbem o LLM.
5. **Terminal states** — Sem continuidade (`NO_ELIGIBLE`, `DISABLED`, …) → `abandon(reason)`; sync limpa pending derivados.
6. **Deterministic idempotence** — Mesma rule + fingerprint + outcome → skip (`last_deterministic_action`).

```
ACTIVE → COMPLETE   (complete)
ACTIVE → ABANDONED  (abandon + endReason)
```

`abandon()` no engine só muda lifecycle (`status` + `endReason`). Sync/reconcile remove pending / focus / pending_confirmation.

Barreira: `current_operation.status !== "active"` → zero deterministic rules.

## Princípios constitucionais (extractors / tools)

### Nunca

- inferir intenção
- inferir fluxo ou próxima etapa
- decidir próxima tool
- decidir resposta ou tom
- construir mini-prompt dentro de extractors ou runtime
- armazenar estado semântico no `ai_state`

### Sempre

- extrair fatos observáveis no texto
- validar dados antes de mutação
- persistir contexto operacional (`offered_*`, IDs, `pending_slot`)
- expor APIs consistentes (5 status de retorno)

### Determinismo

Mesma entrada + mesmo estado relevante → extractors produzem a mesma saída. Sem LLM, DB ou heurísticas ocultas nos extractors.

## Capacidades

| Domínio | Tools |
|---------|-------|
| Scheduling | `list_doctors`, `list_procedures`, `find_available_slots`, `create_appointment`, `cancel_appointment`, `reschedule_appointment`, `perform_check_in` |
| Pricing | `get_service_price` |
| FAQ | `search_faq` |
| Patient | `lookup_patient_by_phone`, `register_patient` |
| Escalation | `transfer_to_human` |

## Pipeline

```
Mensagem → ConversationTransition → Engine lifecycle → Deterministic (ACTIVE + workflow)
  → Tool → ReplyPolicy (structured|domain|llm|fallback) → paciente
```

**Runtime pode:** persistir, validar, logs, resolver referências (`index → id` via `offered_*`), aplicar ReplyPolicy.

**Runtime não pode:** anunciar “vou listar/buscar” sem resultado de tool; decidir fluxo fora de transition/sticky.

## NormalizedFacts

Só fatos justificáveis por trecho literal ou `offered_*`: `date`, `period`, `selectedIndex`, `confirmed`, `ordinal`, `entityId`.

## Contrato de retorno

| Status | Semântica |
|--------|-----------|
| `success` | Dados disponíveis |
| `needs_input` | Falta parâmetro ou escolha |
| `unavailable` | Recurso existe, indisponível agora |
| `not_found` | Entidade não existe |
| `error` | Falha técnica |

## Tool Documentation

Fonte da verdade: [`tools/tool-docs/`](tools/tool-docs/). Campo `description` em `definitions.ts` é representação compacta.

## Critério de PR

1. Viola princípio constitucional ou um dos seis do workflow engine?
2. Campo em NormalizedFacts é fato observável?
3. Extractor é determinístico?
4. Runtime decide algo além de persistir/validar/resolver referência / ReplyPolicy?
5. Nova tool mapeia para qual capacidade?
6. Nova deterministic rule declara `workflow`?
