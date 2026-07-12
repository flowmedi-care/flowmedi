# Reference resolution

Este documento define como referências apresentadas ao usuário (listas, menus e opções) são resolvidas em entidades do domínio. O objetivo é garantir que a interpretação seja determinística e independente do comportamento da LLM.

## Definições

**Referência ativa:** qualquer coleção persistida no estado cuja seleção possa ser feita por **índice** e cuja resolução produza uma **entidade de domínio** (UUID, data, slot ISO, etc.).

Não é “qualquer array do estado” — só menus/listas oferecidos para escolha por índice.

## Contrato

> Quando existir uma referência ativa no estado da conversa e o usuário responder com um inteiro simples, a resolução deve priorizar essa referência antes de qualquer interpretação semântica.

```
Extractors
        │
        ▼
Facts
        │
        ├──────────────┐
        ▼              ▼
Reference        Semantic
Resolution        Mapping
        │              │
        └──────┬───────┘
               ▼
          StatePatch
               ▼
            AiState
```

| Camada | Faz | Não faz |
|--------|-----|---------|
| **Extractors** | Bare `"10"` → só `selectedIndex`. `"10:00"` / `"10h"` → facts de horário | Não lê referências ativas / estado |
| **Reference resolution** (`resolveReferenceFacts`) | `selectedIndex` → entidade na referência ativa → StatePatch | Semântica; fallback; mutar AiState; consumir `selected_scheduled_at` |
| **Semantic mapping** (`applySemanticFacts`) | Facts semânticos → StatePatch | Não sobrescreve entidade já resolvida por referência no mesmo turno |

> **Nome:** `resolveReferenceFacts` resolve **referências**, não “facts”. Rename futuro: `resolveReferences` / `applyReferenceSelections`.

## Exemplos

- Menu de 12 horários; usuário `"10"` → opção 10 (ex. 13:30), **nunca** relógio 10:00.
- Usuário `"10:00"` → semantic mapping via `selected_scheduled_at`.
- Sem referência ativa; usuário `"10"` → só `selectedIndex` nos facts; sem patch de slot até haver menu.

Ver também: [booking.md](./booking.md) (contratos de agendamento).
