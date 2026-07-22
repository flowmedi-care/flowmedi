# Sistema Operacional de Atendimento — Auditoria Operacional

> **Referência atual:** [`CONSTITUICAO-FLOWMEDI.md`](../CONSTITUICAO-FLOWMEDI.md) · [`ARQUITETURA-OPERACIONAL.md`](../ARQUITETURA-OPERACIONAL.md) · [`ROADMAP-OPERACIONAL.md`](../ROADMAP-OPERACIONAL.md)  
> Os documentos desta pasta são a **auditoria histórica** que originou a Constituição.

**Produto:** reduzir a carga cognitiva da clínica organizando decisões (Atendimento + Pendências + Workspace).

**Não é:** “tem uma IA que conversa no WhatsApp”.

WhatsApp (Conversa), CRM e agenda são **interfaces**. IA e humano são **atores**. Tudo deve manipular a mesma entidade: o **Atendimento**.

---

## Pergunta-guia (obrigatória em todo o documento)

> **Quem deveria tomar a próxima decisão?**

Não “qual é o próximo passo”. **Quem decide.**

Isso gera a segunda pergunta:

> **Quem é o Responsável Atual do caso?**

Sem responsável explícito não há sistema operacional — há interfaces soltas reagindo a eventos.

Em cada seção abaixo, essa pergunta aparece de novo. Se a resposta for “ninguém” ou “os dois”, há ruptura.

---

## Índice dos entregáveis

| # | Documento | Entregável |
|---|-----------|------------|
| 1 | [Diagnóstico Conversacional](./01-diagnostico-conversacional.md) | Matriz ownership + onde a decisão some |
| 2 | [Event Map](./02-event-map.md) | Cascata decisão → evento → efeitos |
| 3 | [Decision Map](./03-decision-map.md) | Inventário de decisões do sistema |
| 4 | [Diagnóstico CRM](./04-diagnostico-crm.md) | Propósito por superfície (op vs analytics) |
| 5 | [Diagnóstico Operacional](./05-diagnostico-operacional.md) | Secretária às 8h → Centro de Operações |
| 6 | [Colaboração IA + Humano](./06-colaboracao-ia-humano.md) | Protocolo do Responsável Atual |
| 7 | [Continuidade e Case](./07-continuidade-e-case.md) | História única + entidade Atendimento |
| 8 | [Filosofia do Atendimento](./08-filosofia-do-atendimento.md) | **Constituição** do sistema |
| 9 | [Arquitetura Operacional Alvo](./09-arquitetura-operacional-alvo.md) | Case + Event Bus + Ops Center |

**Ordem de leitura recomendada:** 08 (Filosofia) → 03 (Decisões) → 02 (Eventos) → 07 (Case) → 09 (Arquitetura) → demais.

---

## Conceitos de primeira classe

### Atendimento (Case)

Objeto operacional único. Mensagem, CRM, agenda ou secretária atualizam **este** objeto.

### Responsável Atual

| Valor | Significado |
|-------|-------------|
| `IA` | Assistente conduz e pode falar |
| `Humano:<id>` | Pessoa nomeada conduz; IA silenciosa |
| `Sistema` | Automação/cron/SLA (ex.: “me chama amanhã”) |
| `Paciente_aguardando` | Bola com o paciente |

---

## Esforço desta auditoria

| Parte | Foco |
|-------|------|
| ~20% | Evidência do estado atual (código e fluxos) |
| ~80% | Arquitetura alvo + Filosofia + Decision/Event Maps |

Código citado é **evidência de ruptura**, não o eixo do documento.

---

## Critério de sucesso

Qualquer pessoa do time responde sem hesitar:

1. O que é um Atendimento (Case)?
2. Quem é o Responsável Atual agora?
3. Quem deveria tomar a próxima decisão?
4. Quais decisões o sistema conhece?
5. Quais eventos essas decisões disparam?
6. Onde a secretaria trabalha?
7. O que diz a Filosofia quando humano e IA discordam?
