# 8. Filosofia do Atendimento

**Status:** Constituição do Sistema Operacional de Atendimento (v1 — proposta de produto).  
**Uso:** Qualquer funcionalidade nova consulta este documento. Mudança de regra = **emenda explícita**, não só PR de feature.

**Pergunta-mãe da constituição:** Em cada situação, *quem deveria tomar a próxima decisão?*

---

## Artigo I — Propósito

1. O Flowmedi opera o **atendimento da clínica em um único lugar**, independentemente de o ator ser IA ou humano.
2. WhatsApp, CRM, agenda e demais UIs são **interfaces** sobre o **Atendimento (Case)**.
3. Eventos são consequências de **decisões**. O sistema prioriza modelar decisões e responsáveis.

---

## Artigo II — O Case

1. A unidade operacional é o **Atendimento (Case)**.
2. Todo Case tem, em qualquer instante:
   - um **Responsável Atual**;
   - zero ou uma **próxima decisão pendente** explícita;
   - uma **timeline** append-only de decisões e eventos relevantes.
3. Interfaces não mantêm “verdades” paralelas que contradigam o Case. Podem cachear; o Case prevalece.

---

## Artigo III — Responsável Atual

Valores permitidos:

| Responsável | Pode falar no canal | Carrega SLA de resposta | Decide mutações de domínio* |
|-------------|---------------------|-------------------------|-----------------------------|
| `IA` | Sim (automático) | Sim (política IA) | Conforme Art. VIII |
| `Humano:<id>` | Sim (só este, salvo admin) | Sim | Sim |
| `Sistema` | Só mensagens/templates autorizados | Sim (due do lembrete) | Só as agendadas |
| `Paciente_aguardando` | Não (aguarda inbound) | SLA de espera do paciente | Não |

\*Detalhe no Art. VIII.

### Regras

1. **Nunca ambíguo.** Proibido estado “IA e humano conduzindo”.
2. **Humano sempre vence a IA.** Se humano envia mensagem no Case ou faz claim, Responsável vira esse humano e a IA silencia imediatamente.
3. Assign/encaminhar para humano **é** mudança de Responsável (não só label de UI).
4. Devolver à IA exige **brief** (o que foi feito / o que falta), salvo ATIVAR do paciente após opt-out (brief automático “paciente reativou”).

---

## Artigo IV — Início e fim do Atendimento

### Quem inicia

1. **Sistema** cria Case quando:
   - chega primeiro contato WhatsApp de telefone sem Case open; ou
   - entra lead por formulário/site que exige acompanhamento; ou
   - humano cria atendimento manualmente (futuro).
2. Paciente não “cria Case” conscientemente; o ato de contato inicia.

### Mesma conversa ou novo Case?

1. **Default:** um Case open por participante+clínica no canal WhatsApp (alinhado à conversa única por telefone).
2. **Novo Case** quando o anterior está **closed** e surge **nova intenção comercial/clínica distinta** após período de frio (parâmetro de clínica; default sugerido: 30 dias) **ou** humano força “novo atendimento”.
3. Reopen de ticket WhatsApp com Case closed recente: **reabre o mesmo Case** se dentro da janela; senão novo Case ligado à mesma conversa.

### Quem fecha

1. Humano responsável ou admin pode fechar.
2. IA pode **sugerir** fechamento; só fecha sozinha se política da clínica permitir (default: **não**).
3. Sistema pode fechar por timeout de abandono comercial (lifecycle perdido) conforme política — registrando decisão `Sistema`.

### Quem reabre

1. Inbound do paciente com Case closed na janela → reopen automático (Responsável conforme Art. V default).
2. Humano pode reabrir manualmente.

### Quem define que acabou

1. Decisão explícita `close_case` com motivo (resolvido, perdido, spam, duplicado).
2. Fechar ticket WhatsApp ≠ fechar Case (podem divergir só temporariamente; UI deve alertar).

---

## Artigo V — Condução padrão

1. **Default de entrada (clínica com VA ativo):** Responsável = `IA`, salvo routing que force humano (primeira resposta / fila).
2. **Default com VA inativo:** Responsável = pool humano / secretária geral.
3. **Prioridade de interrupção:**
   1. Humano (sempre)
   2. Pedido explícito do paciente por humano (dentro da política de horário)
   3. Sistema (SLA / segurança / loop)
   4. IA

---

## Artigo VI — Pedido de ator

### Paciente → humano

1. Paciente pode pedir humano **sempre** (intenção clara / “atendente”).
2. Fora do horário de handoff: Sistema informa janela e registra pedido; Responsável = `Sistema` ou permanece política da clínica (mensagem fora de hora já existente).
3. Reclamação grave: handoff imediato, sem auto-reativar por timeout curto.

### Secretária → IA

1. Secretária pode devolver à IA **sempre**, se paciente não estiver em opt-out.
2. **Brief obrigatório** (mínimo um campo texto).
3. Clear context é operação destrutiva: requer confirmação; registra decisão.

### IA → humano

1. Por tool `transfer_to_human`, falhas repetidas, bot-loop, ou políticas de estágio.
2. Sempre com `handoff_reason` na timeline.

### Sistema → alguém

1. Ao disparar lembrete (“me chama amanhã”), Sistema executa contato e devolve Responsável para `IA` ou `Humano` conforme configuração (default: `IA` se VA ativo).

---

## Artigo VII — Memória e SLA

1. “Me chama amanhã” / follow-ups = Responsável `Sistema` + `pending_decision` com `due_at`.
2. Se o Responsável não decide a tempo:
   - Humano: escalar para admin/pool (notificação).
   - IA: handoff ou fallback message (política).
   - Sistema: retry limitado → escalar humano.
3. Opt-out do paciente: IA não decide respostas; humano/Sistema (templates necessários) apenas.

---

## Artigo VIII — Autoridade sobre domínio

| Ação | IA sozinha | IA com confirmação do paciente | Só humano | Médico |
|------|------------|--------------------------------|-----------|--------|
| Informar preço/FAQ/horários | Sim | — | — | — |
| Cadastrar paciente (dados mínimos) | Sim* | Preferível se ambíguo | Sim | — |
| Agendar consulta | Sim* | Slot deve ser confirmado na conversa | Sim | — |
| Remarcar | Sim* | Sim | Sim | — |
| Cancelar | Condicional* | Motivo explícito | Sim | Sim (clínico) |
| Enviar orçamento formal | Condicional | — | Default comercial | — |
| Marcar falta / realizada | Não | — | Sim | Sim |
| Mudar lifecycle comercial | Sugerir / via Event Bus após fatos | — | Sim | — |
| Fechar Case | Não (default) | — | Sim | — |

\*Conforme capabilities/políticas da clínica e stage do agent pipeline.

**Emenda futura:** clínicas podem endurecer qualquer linha para “só humano”.

---

## Artigo IX — Decisão e evento

1. Nenhuma mutação relevante sem **decisão** atribuída a um Responsável (ainda que automática).
2. Toda decisão gera zero ou mais **eventos** (ver Event Map).
3. UI operacional mostra decisões pendentes, não só mensagens.

---

## Artigo X — Conflitos

1. Se IA e humano discordam: **humano prevalece**; timeline registra override.
2. Se CRM e conversa discordam: **Case prevalece** após sync; se conflito irresolvível, Responsável humano.
3. Se dois humanos claimam: primeiro claim vence; segundo é notificado.

---

## Artigo XI — Emendas

1. Alterar esta Filosofia exige atualizar este arquivo (versão + data) e revisar Decision/Event Maps afetados.
2. Features que violem a constituição não devem mergear sem emenda.

---

## Versão

| Versão | Data | Notas |
|--------|------|-------|
| 1.0 | 2026-07-17 | Constituição inicial da auditoria operacional |

---

*Este capítulo é o entregável “constituição”. Defaults marcados podem ser parametrizados por clínica sem violar os artigos estruturais (Case, Responsável único, humano vence IA, brief na devolução).*
