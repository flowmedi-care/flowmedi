# FlowMedi — Visão de Produto e Arquitetura

**Documento de referência:** organização do sistema, entidades, fluxos, arquitetura de alto nível e decisões de produto.  
*Sem código — foco em clareza e visão.*

---

## 1. Visão geral do produto

**FlowMedi** é um SaaS para clínicas que centraliza **agenda**, **formulários clínicos** e **comunicação com o paciente**, com papéis distintos para **admin**, **médico** e **secretária**, e preparação para **planos/checkout** e **integração WhatsApp**.

**Identidade visual (referência):** aparência predominantemente clara, verde como cor secundária.

---

## 2. Fluxo geral do sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO GERAL FLOWMEDI                               │
└─────────────────────────────────────────────────────────────────────────────┘

  [Admin]                    [Secretária]                    [Médico]
     │                            │                             │
     │  define tipos de consulta   │  cadastra paciente          │
     │  define formulários padrão  │  cria/edita consulta         │
     │  gerencia usuários          │  associa formulário         │
     │  gestão pagamento do SaaS   │  envia link / lembrete      │
     │  (plano, cancelar, etc.)    │  confirmações / falta        │
     │                            │                             │
     └────────────────────────────┴─────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   AGENDA CENTRAL DA CLÍNICA    │
                    │   (por médico, dia/semana/     │
                    │    mês/ano; status consulta)   │
                    └───────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
   [Paciente]                [Formulários]              [WhatsApp]
   - recebe link             - preenche anamnese         - lembrete consulta
   - confirma presença       - status: pendente/        - recomendações
   - aceita LGPD               respondido/incompleto      (ex.: jejum)
          │                         │                         │
          └─────────────────────────┴─────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   DASHBOARDS                  │
                    │   Médico: agenda + paciente   │
                    │   Secretária: agenda + ops    │
                    └───────────────────────────────┘
```

### 2.0 Papel do Admin da clínica

O Admin não aparece tanto no dia a dia da agenda, mas é quem **prepara o terreno** e **acompanha o uso** quando a clínica cresce. Deixar isso explícito evita que o papel pareça “apagado”:

- **Define tipos de consulta / procedimento** — ex.: consulta geral, colonoscopia, retorno. A secretária só escolhe entre o que o admin já configurou.
- **Define formulários padrão** — cria e edita os templates (anamnese, preparo, etc.) e vincula a tipos de consulta. Médico e secretária usam; não criam do zero.
- **Gerencia usuários** — convida e remove usuários; atribui papéis (médico, secretária); vincula médico à clínica e à agenda.
- **Gestão do pagamento do SaaS** — o Admin é o único que acessa a parte de assinatura/checkout: trocar de plano, cancelar, ver faturas, método de pagamento. Na interface (ex.: modal ou tela de configurações da clínica), o Admin pode mudar de plano, cancelar a assinatura, etc. **Para médicos e secretárias essa área não aparece** — eles não veem opções de plano, pagamento ou cancelamento; só o Admin da clínica.

Ou seja: **Admin = configuração, governança e pagamento do SaaS**; Secretária = operação do dia a dia; Médico = consulta e decisão clínica.

### 2.1 Fluxo “Consulta → Formulário → Médico”

1. **Secretária** cria registro do **paciente** (se não existir).
2. **Secretária** agenda **consulta** e associa **tipo de consulta/procedimento** (ex.: colonoscopia).
3. O tipo de consulta pode ter **formulários vinculados** (ex.: anamnese colonoscopia).
4. Sistema gera **link único** do formulário para o paciente (envio manual ou automático).
5. **Paciente** preenche; respostas ficam **registradas** e **vinculadas à consulta**.
6. No **dashboard do médico**: ao abrir a consulta, vê formulários respondidos, resumo clínico e alertas (alergias, preparo, riscos).
7. **Secretária** vê status de formulário (pendente/respondido/incompleto) e pode reenviar link ou lembrete.

### 2.2 Fluxo LGPD e comunicação

1. **Paciente** deve **aceitar consentimento** (uso de dados + mensagens).
2. Sistema registra **data**, **texto aceito** e **identificação**.
3. **Sem consentimento** → bloqueio de envio de mensagens/links.
4. **WhatsApp**: mensagens como “sua consulta está amanhã”, recomendações (jejum, etc.), lembretes de confirmação — sempre respeitando consentimento.

### 2.3 Fluxo planos (futuro)

1. **Checkout** libera recursos por **plano** (ex.: número de médicos, envio WhatsApp, formulários ilimitados).
2. **Separação de planos** desde o desenho: limites e features por plano, sem travar a arquitetura.

---

## 3. Entidades principais

| Entidade | Descrição breve | Relacionamentos principais |
|----------|-----------------|----------------------------|
| **Clínica** | Tenant do sistema; escopo de dados | tem Usuários, Pacientes, Agenda, Formulários (templates), Tipos de consulta |
| **Usuário** | Login; pertence a uma clínica | papel: admin, médico, secretária; pode ser “médico” com agenda própria |
| **Paciente** | Quem é atendido na clínica | pertence à Clínica; tem Consultas; Consentimento LGPD; pode ter múltiplos contatos |
| **Consulta** | Evento na agenda (data/hora, médico, tipo) | pertence a Paciente, Médico, Clínica; status (agendada, confirmada, realizada, falta); pode ter vários FormuláriosPreenchidos |
| **Tipo de consulta / Procedimento** | Ex.: consulta geral, colonoscopia | vinculado a templates de Formulário; usado ao criar Consulta |
| **Formulário (template)** | Construtor: campos (texto, múltipla escolha, data, etc.) | pertence à Clínica; pode ser vinculado a Tipo de consulta/procedimento |
| **FormulárioPreenchido / Resposta** | Instância do formulário para uma consulta | vinculado a Consulta + Paciente; status: pendente, respondido, incompleto; armazena respostas |
| **Link do formulário** | Link único por formulário/consulta para o paciente | expira ou é de uso único; rastreável |
| **Consentimento (LGPD)** | Aceite do paciente | data, texto, identificação; bloqueia envio se ausente |
| **Mensagem / Histórico de envio** | WhatsApp e outros (futuro) | enviada para Paciente; tipo: lembrete, formulário, confirmação, recomendação |
| **Plano / Assinatura** (futuro) | Limites e features por plano | Clínica pertence a um Plano; checkout define o que está liberado |

---

## 4. Arquitetura de alto nível (sugestão)

### 4.1 Camadas

- **Frontend (web):** aplicação única com rotas e layouts diferentes por papel (admin, médico, secretária). Dashboards separados conforme definido abaixo.
- **Backend (API):** serviços por domínio (auth, clínica, agenda, pacientes, formulários, comunicação, consentimento). Preparar desde já um “gate” por plano (middleware ou serviço de limites).
- **Integrações:** WhatsApp (API oficial ou provedor tipo Twilio/Evolution API) em módulo isolado; envios condicionados a consentimento e plano.
- **Persistência:** banco relacional para núcleo (usuários, clínicas, pacientes, consultas, formulários, respostas, consentimentos); considerar fila para envio de mensagens.

### 4.2 Módulos e responsabilidades

| Módulo | Responsabilidade | Expõe / Consome |
|--------|------------------|------------------|
| **Auth** | Login, sessão, papéis, vínculo usuário–clínica | Usado por todos os módulos |
| **Clínica / Tenant** | CRUD clínica, usuários da clínica, tipos de consulta | Consumido por Agenda, Formulários, Pacientes |
| **Pacientes** | Cadastro, edição, histórico de consultas, consentimento | Agenda, Formulários, Comunicação |
| **Agenda** | Slots, consultas (criar, editar, cancelar, falta), filtros por médico/período | Pacientes, Formulários, Dashboards |
| **Formulários** | Templates (construtor), vínculo tipo de consulta, links únicos, respostas, status | Agenda, Pacientes, Dashboards |
| **Comunicação** | Envio de link, lembrete, confirmação; histórico; integração WhatsApp | Consentimento, Formulários, Agenda |
| **Consentimento (LGPD)** | Registrar aceite, consultar status; bloquear envios | Comunicação, Pacientes |
| **Dashboards** | Visões médico vs secretária (dados agregados); não implementa regra, só consome APIs | Agenda, Formulários, Pacientes |
| **Planos / Billing** (futuro) | Limites, checkout, liberação de features | Todos (gate por clínica/plano) |

### 4.3 Dependências entre módulos (ordem lógica)

```
Auth
  └── Clínica/Tenant
        ├── Pacientes ──► Consentimento
        ├── Agenda ◄──── Pacientes
        ├── Formulários (templates + vínculo tipo consulta)
        │     └── FormulárioPreenchido ◄── Agenda, Pacientes
        ├── Comunicação ◄── Consentimento, Formulários, Agenda
        └── Dashboards ◄── Agenda, Formulários, Pacientes

(futuro) Planos/Billing ──► gate em Clínica, Comunicação, etc.
```

- **Auth** e **Clínica** são base; **Pacientes** e **Agenda** vêm em seguida; **Formulários** e **FormulárioPreenchido** dependem de Agenda e Tipos de consulta; **Comunicação** depende de Consentimento e dos dados de consulta/formulário; **Dashboards** só leem dados já existentes.

---

## 5. Dashboards — resumo

### 5.1 Dashboard do Médico

- **Foco:** consulta e decisão clínica. Sem cobrança, envio de mensagens ou configuração de sistema.
- **Visão principal:** agenda do dia (ou semana) com nome do paciente, horário, tipo de consulta, status (confirmada, pendente).
- **Destaques:** consultas não confirmadas; pacientes que não preencheram o formulário.
- **Acesso ao paciente:** ao clicar na consulta → formulários respondidos, resumo clínico (principais respostas), alertas (alergias, preparo, riscos).
- **Funcionalidades:** visualizar formulários, status de preenchimento, histórico do paciente, bloquear horários na agenda.

### 5.2 Dashboard da Secretária

- **Foco:** operação da clínica; garantir que tudo esteja pronto antes da consulta.
- **Visão principal:** agenda geral (filtro por médico e status); indicadores: não confirmadas, formulários pendentes, consultas do dia seguinte.
- **Gestão de consultas:** criar, editar, remarcar; associar tipo de consulta/procedimento; ver status do formulário; cancelar ou marcar falta.
- **Comunicação:** enviar formulário manualmente, reenviar link, lembrete de confirmação, histórico de mensagens.
- **Automação assistida:** o sistema **sugere** ações (“paciente não confirmou”, “formulário pendente”); **a secretária confirma** se envia ou não. Nada é disparado sozinho — evita disparos errados e a sensação de “robô mandando mensagem”; a pessoa controla, o sistema apenas recomenda.
- **Cadastro:** criar registro do paciente e, ao agendar, associar formulários (ex.: anamnese colonoscopia); respostas ficam disponíveis no painel do médico.

---

## 6. Integração WhatsApp (visão)

- **Tipo de uso:** canal de **mensagens transacionais**, não chat livre. Ou seja: o FlowMedi envia mensagens disparadas pelo contexto da consulta (lembrete, link de formulário, recomendação de jejum, confirmação). **Não é** WhatsApp estilo conversa aberta com o paciente — isso evita expectativa errada do cliente e alinha com políticas de uso da API.
- **Uso típico:** lembrete de consulta, recomendações (ex.: jejum), envio/reenvio de link de formulário, confirmação de presença.
- **Regras:** só enviar se houver **consentimento** registrado; respeitar **plano** (futuro) para envio.
- **Arquitetura:** módulo de Comunicação chama provedor WhatsApp (API oficial ou terceiro); fila de mensagens para retentativas e auditoria; histórico vinculado ao paciente/consulta.

---

## 7. Planos e checkout (futuro)

- **Objetivo:** liberar recursos somente para quem paga.
- **Sugestão:** desde já ter no modelo “Clínica” (ou tenant) um conceito de **Plano** (ou “nível”): free, básico, profissional, etc.
- **Limites possíveis por plano:** número de médicos, consultas/mês, envios WhatsApp, número de formulários ou de respostas.
- **Checkout:** integração com gateway (Stripe, Mercado Pago, etc.); webhook para ativar/atualizar/cancelar plano e aplicar limites no backend.
- **Quem gerencia o pagamento:** apenas o **Admin** da clínica. A interface de gestão (trocar de plano, cancelar, ver faturas, atualizar cartão) — por exemplo em modal ou tela dedicada — fica visível só para o perfil Admin. Médicos e secretárias não veem opções de plano, pagamento ou cancelamento.

---

## 8. Riscos e decisões técnicas

| Risco / decisão | Impacto | Sugestão |
|-----------------|--------|----------|
| **Multi-tenant (clínica)** | Vazamento de dados entre clínicas | Sempre filtrar por `clinic_id` (ou equivalente); testes de isolamento. |
| **LGPD e consentimento** | Bloqueio incorreto ou envio sem consentimento | Consentimento como entidade explícita; toda ação de envio checa consentimento; auditoria de envios. |
| **API WhatsApp** | Regras comerciais, banimento, custo | Definir provedor (oficial vs terceiro); rate limit; fallback (ex.: SMS ou e-mail) no desenho. |
| **Formulários dinâmicos** | Schema flexível (campos configuráveis) | Armazenar definição do formulário (JSON ou tabela de campos); respostas em estrutura flexível (JSON ou tabela chave–valor) com versionamento do template. |
| **Links únicos** | Segurança e uso único/reuso | Token não sequencial, expiração, opção de “uso único”; HTTPS obrigatório. |
| **Performance da agenda** | Muitos eventos por médico/clínica | Índices por clínica, médico, data; paginação e filtros no backend; cache leve se necessário. |
| **Separação de planos** | Evitar refatoração pesada depois | Camada de “limites/planos” desde o início (serviço ou middleware); features sensíveis (WhatsApp, número de médicos) consultam essa camada. |
| **UX médico vs secretária** | Confusão ou telas inadequadas | Rotas e layouts distintos por papel; médico sem acesso a “envio de mensagens” e “configuração”; secretária sem “bloquear horários” com mesma ênfase que o médico (definir na UX). |
| **Comunicação “automação”** | Medo de disparos errados ou “robô mandando mensagem” | Deixar explícito em copy e UX: “O sistema sugere, a secretária confirma”; nenhum envio automático sem ação da secretária. |
| **Expectativa WhatsApp** | Cliente achar que é chat livre | Comunicar claramente: canal transacional (lembretes, links, recomendações); não é conversa aberta. |

---

## 9. Próximos passos sugeridos (ordem de produto)

1. **Fundação:** modelo de dados (entidades acima); Auth + Clínica + Papéis.
2. **Cadastro e agenda:** Pacientes; Agenda (por médico); tipos de consulta; status de consulta.
3. **Formulários:** construtor de templates; vínculo tipo de consulta; FormulárioPreenchido; links únicos; status.
4. **Consentimento LGPD:** registro de aceite; bloqueio de envio quando não houver consentimento.
5. **Dashboards:** médico (agenda + paciente + formulários + alertas); secretária (agenda + indicadores + gestão + comunicação).
6. **Comunicação:** envio manual de link; lembrete de confirmação; histórico; depois integração WhatsApp (lembrete, recomendações).
7. **Planos e checkout:** modelo de planos; gates; integração de pagamento.

---

*Documento vivo: revisar conforme decisões de implementação e feedback de uso.*
