# Reference resolution

Este documento define como referências apresentadas ao usuário (listas, menus e opções) são resolvidas em entidades do domínio. O objetivo é garantir que a interpretação seja determinística e independente do comportamento da LLM.

## Definições

**Referência ativa:** o menu em `active_selection` — o **último componente interativo que o paciente recebeu** (commit após outbound bem-sucedido).

Tools preparam `pending_active_selection` + `offered_*`; só após `reply_sent` o pending vira `active_selection` e menus concorrentes são limpos.

Não é “qualquer array do estado” — o resolver **não** percorre `offered_doctors` + `offered_days` + `offered_slots` em competição.

## Contrato

> Quando existir `active_selection` (ou derivação legado do menu mais específico) e o usuário responder com um inteiro simples, a resolução usa **somente** esse menu, antes de qualquer interpretação semântica.

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
(active_selection)   │
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
| **Reference resolution** (`resolveReferenceFacts`) | `selectedIndex` → opção em `active_selection` → StatePatch | Semântica; caminhar menus antigos; mutar AiState; consumir `selected_scheduled_at` |
| **Semantic mapping** (`applySemanticFacts`) | Facts semânticos → StatePatch | Não sobrescreve entidade já resolvida por referência no mesmo turno |

> **Nome:** `resolveReferenceFacts` resolve **referências**, não “facts”. Rename futuro: `resolveReferences` / `applyReferenceSelections`.

## Exemplos

- Menu de 12 horários commitado; usuário `"10"` → opção 10 (ex. 13:30), **nunca** relógio 10:00 nem dia do menu anterior.
- Usuário `"10:00"` → semantic mapping via `selected_scheduled_at`.
- Sem referência ativa; usuário `"10"` → só `selectedIndex` nos facts; sem patch de slot até haver menu.
- Dias listados → slots listados (outbound OK) → `active_selection.type === "slot"`; `"1"` não remapeia para dia 1.

Ver também: [booking.md](./booking.md) (contratos de agendamento).
