# Arquitetura do Agente Flowmedi

Guia de **fronteiras de responsabilidade**. Leitura obrigatória antes de contribuir.

## Princípios constitucionais

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
Mensagem → extractors/ → NormalizedFacts → Runtime (statePatch, validators)
  → formatContextForPrompt → LLM + tool descriptions → execute.ts → ToolResult
```

**Runtime pode:** persistir, validar, logs, resolver referências (`index → id` via `offered_*`).

**Runtime não pode:** decidir tool, fluxo, retries, gerar linguagem.

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

1. Viola princípio constitucional?
2. Campo em NormalizedFacts é fato observável?
3. Extractor é determinístico?
4. Runtime decide algo além de persistir/validar/resolver referência?
5. Nova tool mapeia para qual capacidade?
