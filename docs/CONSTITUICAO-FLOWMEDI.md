# Constituição da Flowmedi

Documento **imutável**. Muda raramente.

Gate de toda PR, feature ou tela nova:

> Isso respeita a Constituição do produto?  
> Sim → implementa. Não → redesenha a feature, não a Constituição.

Discussões de conceitos (“o que é Atendimento?”) vivem aqui.  
Como implementar → [`ARQUITETURA-OPERACIONAL.md`](./ARQUITETURA-OPERACIONAL.md).  
O que fazer agora → [`ROADMAP-OPERACIONAL.md`](./ROADMAP-OPERACIONAL.md).

Este texto **não** cita tecnologias, tabelas, campos, arquivos ou stacks. Deve sobreviver a reescrever o backend.

---

## Objetivo do produto

```text
Objetivo
  → Reduzir a carga cognitiva / esforço operacional da clínica
       → Como? Organizando decisões
            → Como? Atendimento + Pendências + Workspace + IA
                 (+ telas de consulta, análise e configuração que apoiam)
```

- O produto não existe “para processar decisões” no sentido fundamental.
- **Decisão** é o **mecanismo**.
- O objetivo é **menos esforço** para a clínica saber o que fazer a seguir.
- Telas de consulta, análise e configuração existem para **apoiar** esse objetivo. Não precisam ser uma decisão para existir; precisam não **competir** com o fluxo de decisão (ver Anti-pattern).

---

## Princípio Zero

> O usuário nunca deve precisar decidir *onde* realizar uma ação. O sistema deve levá-lo automaticamente ao lugar correto.

Ele pensa: *“Quero confirmar esta consulta.”*  
O sistema leva ao Workspace do Atendimento — não pergunta Conversa ou Fluxo, Agenda ou Workspace, Paciente ou Atendimento, Pendências ou Home.

---

## North Star

> A clínica sempre sabe quem deve tomar a próxima decisão e por quê.

Toda superfície operacional deve tornar isso óbvio.

---

## Vocabulário oficial

| Termo | Significado |
|-------|-------------|
| **Conversa** | Canal de mensagem com a pessoa |
| **Atendimento** | Unidade operacional de responsabilidade contínua |
| **Paciente** | Pessoa atendida ou a atender |
| **Pendência** | Decisão que exige ação |
| **Fluxo** | Sequência de fases do atendimento |
| **Agenda** | Compromisso no tempo |
| **Financeiro** | Obrigação / cobrança |
| **Workspace** | Lugar onde a decisão é executada |
| **Home / Agora** | Lugar que prioriza pendências |

Fora do vocabulário operacional cotidiano: termos que forcem o usuário a escolher entre modelos mentais concorrentes (ex.: “pipeline”, “ticket” como unidade de trabalho).

---

## As 8 leis

### Lei 1 — Um Responsável Atual

Existe apenas um responsável atual por Atendimento.

### Lei 2 — Uma próxima ação destacada

Pode haver uma fila ordenada de decisões no mesmo Atendimento.  
Apenas uma é apresentada ao operador como **próxima ação**.

Não interpretar como “só pode existir uma decisão no atendimento”.

### Lei 3 — Decisão pertence ao Atendimento

Toda decisão pertence a um **Atendimento**. Nunca à conversa.  
A conversa pode originar o evento; o Atendimento detém a pendência.

### Lei 4 — Conversa não muda o domínio

Conversa nunca muda o domínio. Só solicita mudança.  
Pedir remarcação no chat ≠ consulta remarcada.

### Lei 5 — Só módulos especialistas confirmam fatos

Agenda confirma consulta. Financeiro confirma pagamento.  
Assistentes e automações emitem **intenções**, não fatos.

### Lei 6 — Workspace executa; dashboard não

Workspace é onde decisões são executadas.  
Dashboards, visão geral e KPIs não executam decisão.

### Lei 7 — Home nunca substitui Workspace

A Home só prioriza (“Agora: N pendências”).  
Clicar leva ao Workspace.

### Lei 8 — Toda tela operacional responde

```text
Quem?
  → Decide o quê?
  → Até quando?
  → Com qual contexto?
```

Se a tela não responde, remover, simplificar ou fundir.

---

## Anti-pattern

Nunca adicionar uma nova tela operacional sem declarar se ela:

1. **Cria** decisão?
2. **Executa** decisão?
3. **Apenas consulta** (em apoio ao objetivo)?

Se não responder com clareza → **não entra**.

Atalhos (ex.: iniciar remarcação a partir da conversa) só são válidos se **levam** ao lugar correto (Princípio Zero) sem criar um segundo cérebro operacional.
