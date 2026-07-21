# Domínio financeiro Flowmed

Documento de **domínio**. A arquitetura técnica pode mudar; o modelo de negócio permanece.

> Complementa [`FINANCEIRO-MAPA-E-LACUNAS.md`](FINANCEIRO-MAPA-E-LACUNAS.md) (mapa técnico e lacunas).

---

## Linguagem do produto

| Lente | Verbo | Pergunta |
|-------|-------|----------|
| **Operação** | Agir | O que preciso fazer agora? |
| **Previsão** | Estimar | O que provavelmente acontecerá? |
| **Competência** | Faturar | O que foi faturado? |
| **Caixa** | Receber | O que virou dinheiro? |
| **Performance** | Comparar | Estamos melhores que o período anterior? |

Cada tela responde **uma** lente. Nunca misturar métricas incompatíveis (ex.: somar Previsto com Recebido).

---

## Pipeline Financeiro

Objeto central do domínio. O forecast é **uma capacidade** do pipeline, não o domínio em si.

### Estágios

```
Agendado → Compareceu → Faturado → Recebido
```

Com previsão:

```
Agendado → Previsto → Faturado → Recebido
```

| Estágio | Significado |
|---------|-------------|
| **Agendado** | Marcado na agenda (provisórias / valor ativos) |
| **Previsto** | Agendado × probabilidade de comparecimento |
| **Faturado** | Comanda emitida (`issued_at`) — competência |
| **Recebido** | Dinheiro no caixa (`patient_payments`) |

Cancelamento / falta **descarta** comanda provisória. Exceção: taxa de no-show emitida → Contas a receber.

### Conversões

| Taxa | Significado |
|------|-------------|
| **Comparecimento** | Agendado → quem veio |
| **Faturamento** | Elegível → Faturado |
| **Recebimento** | Faturado → Recebido |

### Pipeline Health

Responde **onde estou perdendo dinheiro?** — queda % entre estágios + causa principal (ex.: no-show por serviço, consultas sem emissão, títulos vencidos).

---

## Operação — Cobrar

**Princípio:** Cobrar = “preciso cobrar **agora**”, não “tudo que tem provisória”.

### Quem entra

1. **Pós-clínico** — encounter `finalizado_aguardando_cobranca` sem comanda emitida  
2. **Antecipado / no dia** — consulta `agendada`/`confirmada` com `payment_policy` ∈ `{ antecipado, no_dia }`, ainda não emitida; **hoje + atrasadas**

### Card: verbo primeiro

- Ação: “Receber antes da consulta” / “Emitir cobrança”
- Badge: Antecipado | No dia | Pós-consulta (explica o *porquê*)

---

## Onde cada lente aparece

| Superfície | Lente | Conteúdo |
|------------|-------|----------|
| Home | Operação | Hoje + Minha fila + indicadores |
| Competência | Competência + previsão de faturamento | Funil Agendado→Previsto→Faturado |
| Contas a receber | Caixa / AR | Funil Faturado→Recebido→Saldo; Agendado/Previsto só contexto |
| Fluxo de caixa | Caixa | Entradas e saídas |
| Performance | Desempenho | MoM, no-show, tempo médio até receber |

Home **não** carrega forecast completo.

---

## Código de referência

Implementação atual: `lib/business-pipeline/` (operational, forecasting, health, analytics, accuracy, eligibility).
