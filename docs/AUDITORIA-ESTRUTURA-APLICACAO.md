# Auditoria Completa da Estrutura da Aplicação — FlowMed

> Documento funcional do produto. Objetivo: permitir que outra IA (ou pessoa) redesenhe, reimplemente ou audite a aplicação **sem abrir o código**, compreendendo arquitetura, telas, elementos de UI, fluxos, dados, estados especiais, integrações e relações entre módulos.
>
> Gerado a partir da análise do código-fonte em `app/`, `components/`, `lib/dashboard-nav-config.ts`, layouts e actions.
>
> **Stack:** Next.js 15 (App Router) · React 18 · TypeScript · Tailwind · Supabase (Auth/DB/Realtime/Storage/MFA) · Stripe · Meta WhatsApp Cloud API · Google Gmail · LangChain/LangGraph (assistente IA) · Recharts · Framer Motion · @xyflow/react · @dnd-kit · ViaProve (transcrição).
>
> **Papéis de usuário:** `admin` · `secretaria` · `medico` · `system_admin`
>
> **Idioma da UI:** Português (Brasil). Este documento está em português.

---

## Sumário

1. [Arquitetura e Shell](#1-arquitetura-e-shell)
2. [Mapa de Navegação por Papel](#2-mapa-de-navegação-por-papel)
3. [Inventário Completo de Rotas](#3-inventário-completo-de-rotas)
4. [Dashboard (Visão Geral / Início)](#4-dashboard-visão-geral--início)
5. [Agenda](#5-agenda)
6. [Consulta (Lista e Recepção)](#6-consulta-lista-e-recepção)
7. [Atendimento (Fila e Clínico)](#7-atendimento-fila-e-clínico)
8. [Documentos Clínicos](#8-documentos-clínicos)
9. [Contatos e Pacientes](#9-contatos-e-pacientes)
10. [CRM e Jornada](#10-crm-e-jornada)
11. [Central de Eventos](#11-central-de-eventos)
12. [Comunicação (WhatsApp e Mensagens)](#12-comunicação-whatsapp-e-mensagens)
13. [Financeiro](#13-financeiro)
14. [Vendas](#14-vendas)
15. [Serviços e Valores](#15-serviços-e-valores)
16. [Planos de Tratamento](#16-planos-de-tratamento)
17. [Estoque](#17-estoque)
18. [Configurações](#18-configurações)
19. [Assistente Virtual (IA)](#19-assistente-virtual-ia)
20. [Formulários](#20-formulários)
21. [Perfil, Equipe, Plano, Onboarding](#21-perfil-equipe-plano-onboarding)
22. [Auditoria e Privacidade (LGPD)](#22-auditoria-e-privacidade-lgpd)
23. [Instruções](#23-instruções)
24. [Admin System](#24-admin-system)
25. [Site Público e Agendamento Online](#25-site-público-e-agendamento-online)
26. [Formulários Públicos](#26-formulários-públicos)
27. [Marketing, Legal e Auth](#27-marketing-legal-e-auth)
28. [Integrações Transversais e Fluxos Ponta a Ponta](#28-integrações-transversais-e-fluxos-ponta-a-ponta)
29. [Observações de UX Transversais](#29-observações-de-ux-transversais)
30. [Redirects e Rotas Legadas](#30-redirects-e-rotas-legadas)
31. [Apêndices](#31-apêndices)

---

# 1. Arquitetura e Shell

## 1.1 Visão Geral

FlowMed é um SaaS multi-tenant para clínicas médicas (e segmentos configuráveis). Cada clínica (`clinics`) possui usuários (`profiles`) com papéis, pacientes, agenda, CRM/jornada, financeiro, estoque, comunicação WhatsApp/e-mail, site público, formulários e assistente virtual.

O roteamento é **file-based** (App Router do Next.js). A fonte canônica do menu lateral do dashboard é `lib/dashboard-nav-config.ts`. Gates de plano e papel controlam o que aparece no menu e o que as páginas permitem.

### Problema que o produto resolve

Centralizar operação clínica (agenda, recepção, atendimento), relacionamento (contatos, leads, CRM), comunicação (WhatsApp/e-mail/eventos), cobrança (comandas/financeiro) e presença pública (site + booking) em um único sistema multi-papel.

### Conexões com outros módulos

Quase todos os módulos convergem para: **Paciente** (entidade central), **Appointment** (consulta), **Encounter** (atendimento clínico), **Comanda** (cobrança), **Journey Case** (CRM operacional) e **WhatsApp Conversation** (canal).

## 1.2 Estrutura de pastas relevantes

```
app/                 # Páginas, layouts, API routes (App Router)
components/          # UI e features (dashboard-ui, crm, whatsapp-*, landing, public-site, agents, ops)
lib/                 # Domínio (financeiro, chatbot, virtual-assistant, nav-config, compliance, operational-queue)
middleware.ts        # Sessão, MFA, subdomínio da clínica, host legado, bloqueio /dev
supabase/            # Migrations / schema
```

## 1.3 Shell do Dashboard

### Server layout (`app/dashboard/layout.tsx`)

Sequência de gates:

1. Sem usuário autenticado → redirect `/entrar`
2. Carrega profile (`id`, `full_name`, `role`, `clinic_id`, `active`)
3. `system_admin` → redirect `/admin/system` (não usa sidebar de clínica)
4. `active === false` → redirect `/acesso-removido`
5. Calcula gates de plano: `canAccessAudit`, `canUseWhatsApp` (e outros via plan data)
6. Lê `services_pricing_mode` da clínica (`centralizado` | `descentralizado`) — afeta menu Serviços e Valores para médico
7. Renderiza `DashboardLayoutClient` + `MfaReminderBanner` + children

### Client shell (`DashboardLayoutClient`)

Elementos permanentes:

| Zona | Conteúdo |
|------|----------|
| Provider | `DashboardNavigationProvider` — navegação otimista (destaca item destino antes da rota carregar) |
| Esquerda | `DashboardNav`: rail de ícones + subpainel do módulo ativo + drawer mobile |
| Topbar | Título da página, busca desabilitada (“Buscar…”), sino de notificações (UI stub sem painel), avatar + nome + papel |
| Conteúdo | `max-w-7xl`, padding responsivo |

**Exceções de layout:**

- **WhatsApp** (`/dashboard/whatsapp`): full-bleed sem topbar padrão (inbox estilo app)
- **Instruções**: padding zero / sem max-width (experiência de lição)

### Rail de navegação

- Colapsável: 60px (só ícones) ↔ 220px (com labels); preferência em `localStorage` (`flowmedi-sidebar-expanded`)
- Clique em grupo: no desktop navega para o primeiro filho; no mobile expande filhos
- Badge de não lidas no grupo Comunicação (polling `/api/whatsapp/unread-count` a cada 10s)
- Rodapé: avatar do usuário (quando expandido), Configurações (admin), Sair

### Middleware (`middleware.ts`)

Ordem de execução:

1. Bloqueia `/dev/*` em produção (exceto se `ENABLE_API_AUDIT_PANEL`)
2. Redirect 301 de domínio legado `.com.br` → canônico
3. Em subdomínio da clínica: rewrite `/` → `/c/{slug}` e paths públicos
4. No apex: redirect `/c/{slug}` → `https://{slug}.{apex}`
5. Atualiza sessão Supabase + enforce MFA em rotas `/dashboard`

### Layouts de módulo com gate extra

| Layout | Gate |
|--------|------|
| `financeiro/layout` | Bloqueia médico; injeta `FinanceAlertsPanel` no topo de todas as subpáginas |
| `vendas/layout` | Bloqueia médico |
| `estoque/layout` | Bloqueia médico; sidebar de categorias |
| `crm/layout` | Apenas admin/secretaria |

## 1.4 Conceitos de domínio transversais (obrigatório para redesign)

### Três camadas de status (não confundir)

| Camada | Valores típicos | Onde aparece |
|--------|-----------------|--------------|
| **Appointment** | agendada, confirmada, realizada, falta, cancelada | Agenda, StatusBar, listas, Comparecimento CRM |
| **Encounter** | em_andamento, finalizado_aguardando_cobranca, cobrado | Stepper operacional, fila, clínico |
| **Comanda** | provisória, aberta, parcial, paga, cancelada | Cobrança, financeiro AR, vendas |

### Princípio CRM

- **Pipeline / Indicadores** = números e funis (analytics)
- **Jornada** = posto de trabalho operacional (cases)
- **Leads** = lista de entrada comercial (Contatos)

### Dualidade “Atendimento”

- `/dashboard/atendimento` = **fila operacional** (consumo/comanda/cobrança)
- `/dashboard/agenda/atendimento/[id]` = **workspace clínico** (fichas/docs/notas)

---

# 2. Mapa de Navegação por Papel

## 2.1 Admin

| Zona | Itens |
|------|-------|
| Topo | Visão Geral · Agenda (Calendário, Lista) · Central de Eventos · Comunicação (Conversas, Mensagens enviadas, Fila de envio, Templates, E-mail) |
| Módulos | Contatos (Pacientes, Profissionais, Fornecedores, Leads, Todos, Aniversariantes) · CRM (Pendências e Fluxo, Indicadores, Formulários) · Atendimento (Fila, Prescrições, Pedidos de exame, Atestados) · Vendas · Financeiro · Estoque |
| Utilitários | Serviços e Valores (Serviços, Procedimentos) · Instruções · Auditoria (se plano) · Configurações (11 itens) · Sair |

## 2.2 Secretária

| Zona | Itens |
|------|-------|
| Topo | Início · Agenda · Central de Eventos · Comunicação (Conversas, Fila de envio) — **sem** Templates / Mensagens enviadas / E-mail |
| Módulos | Contatos (com Fornecedores/Leads) · CRM · Atendimento · Vendas · Financeiro · Estoque (sem Campos de produto) |
| Utilitários | Instruções · Sair — **sem** Configurações, Serviços e Valores, Auditoria, Perfil no menu utilitário |

## 2.3 Médico (Profissional)

| Zona | Itens |
|------|-------|
| Topo | Início · Agenda · Comunicação (só Conversas) — **sem** Central de Eventos |
| Módulos | Contatos (sem Fornecedores/Leads) · Atendimento — **sem** CRM / Vendas / Financeiro / Estoque |
| Utilitários | Meu Perfil · Serviços e Valores (só se pricing `descentralizado`) · Instruções · Sair |

## 2.4 System admin

Redirecionado de `/dashboard` para `/admin/system` (clínicas e planos da plataforma). Sem sidebar de clínica.

## 2.5 Matriz resumida

| Item | admin | secretaria | medico |
|------|:-----:|:----------:|:------:|
| Visão Geral / Início | ✓ | ✓ | ✓ |
| Agenda | ✓ | ✓ | ✓ |
| Central de Eventos | ✓ | ✓ | — |
| WhatsApp Conversas | ✓* | ✓* | ✓* |
| Mensagens/Templates/E-mail | ✓ | Fila só | — |
| Contatos (base) | ✓ | ✓ | ✓ |
| Fornecedores / Leads | ✓ | ✓ | — |
| CRM | ✓ | ✓ | — |
| Atendimento + docs | ✓ | ✓ | ✓ |
| Vendas / Financeiro / Estoque | ✓ | ✓ | — |
| Serviços e Valores | ✓ | — | se descentralizado |
| Configurações | ✓ | — | — |
| Meu Perfil | — | — | ✓ |
| Auditoria | ✓+plano | — | — |

\* exige plano com WhatsApp + integração Meta conectada

## 2.6 Menu Configurações (admin) — filhos canônicos

1. Preferências do sistema  
2. Dados da clínica  
3. Base de conhecimento  
4. Salas e consultórios  
5. Integrações  
6. Assistente virtual  
7. Campos personalizados  
8. Contas bancárias  
9. Site da clínica  
10. Privacidade e segurança  
11. Assinatura  

---

# 3. Inventário Completo de Rotas

## 3.1 Públicas / marketing / legal / auth

`/` · `/recursos` · `/precos` · `/contato` · `/sugestoes` · `/seguranca` · `/politica-de-privacidade` · `/politica-de-cookies` · `/termos-de-servico` · `/acordo-tratamento-dados` · `/subprocessadores` · `/encarregado-dados` · `/privacidade-titular` · `/exclusao-de-dados` · `/entrar` · `/criar-conta` · `/esqueci-senha` · `/redefinir-senha` · `/auth/recuperar` · `/acesso-removido` · `/convite/[token]` · `/c/[slug]` · `/c/[slug]/agendar` · `/f/[token]` (+ segmentos) · `/f/public/[slug]` (+ formSlug) · `/edit/[token]` · `/dev/api-validation`

## 3.2 Admin platform

`/admin/system` · `/admin/system/clinicas` · `/admin/system/clinicas/[id]` · `/admin/system/planos` · `/admin/system/planos/novo` · `/admin/system/planos/[id]`

## 3.3 Dashboard (clínica autenticada)

Todas as rotas sob `/dashboard/*` detalhadas nas seções seguintes (agenda, consulta, atendimento, contatos, crm, financeiro, vendas, estoque, mensagens, whatsapp, configuracoes, etc.).

---

# 4. Dashboard (Visão Geral / Início)

## 4.1 Visão Geral do módulo

| Campo | Valor |
|--------|--------|
| **Rotas** | `/dashboard` (home por papel). Não existe `/dashboard/visao-geral` como rota própria — a Visão Geral admin é montada no próprio `/dashboard`. |
| **Objetivo** | Home operacional/gerencial conforme o papel |
| **Problema que resolve** | Orientar o usuário no “o que fazer agora” (secretária/médico) ou métricas + setup + operação do dia (admin) |
| **Conexões** | Agenda, Contatos, Formulários, Financeiro (alertas), CRM/Agora, Auditoria, Fila operacional, Eventos |

### Roteador (`app/dashboard/page.tsx`)

1. Autentica via Supabase (`auth.getUser()`)
2. Lê `profiles` (`id`, `full_name`, `role`, `clinic_id`)
3. **Sem perfil** → tela de onboarding incompleto
4. `secretaria` → `SecretariaDashboard`
5. `medico` → `MedicoDashboard`
6. Caso contrário (admin e demais) → `AdminDashboard` (Visão Geral)

### UI — estado sem perfil

| Elemento | Texto / destino |
|---|---|
| Título | Complete seu cadastro |
| Corpo | Crie sua clínica… administrador… convidar profissionais e Secretário(a)s |
| Info | E-mail da conta: `{user.email}` |
| CTA | **Criar minha clínica** → `/dashboard/onboarding` |

---

## 4.2 Dashboard Secretária

### Visão Geral

Home operacional do dia: quick actions de criação, métricas configuráveis, compliance de confirmação, consultas em andamento, atalho para leads e lista do dia com StatusToggle. Acima do client: `AgoraStrip` (decisões CRM) + `FinanceAlertsPanelServer`.

### Estrutura de Navegação

- Menu: **Início** → `/dashboard`
- Destinos frequentes: Agenda (`?new=true`), Pacientes (`?new=true`), Formulários novo, detalhe consulta, leads, jornada CRM, financeiro via alertas

### Conteúdo de Cada Página (UI completa)

#### Cabeçalho

| Tipo | Label / texto |
|---|---|
| H1 | Dashboard do Secretário(a) |
| Subtítulo | Gerencie consultas, pacientes e formulários |
| Botão | **Preferências** (ícone Settings) — toggle painel |

#### Preferências (`PreferencesClient`) — se aberto

Card **Preferências do Dashboard** com switches:

| Switch | Descrição |
|---|---|
| Compliance | Mostrar alertas de consultas que precisam de confirmação |
| Métricas | Mostrar cards com números e estatísticas |
| Pipeline de Não Cadastrados | Mostrar pipeline Kanban… |
| Próximas Consultas | Mostrar lista de próximas consultas… |
| Atividades Recentes | Mostrar feed… (**preferência existe; feed ainda não implementado na UI**) |

Persistência via `updateDashboardPreferences` + `revalidatePath("/dashboard")`.

#### Quick Actions (3 cards clicáveis)

| Card | Descrição | Link |
|---|---|---|
| Nova Consulta | Agendar uma nova consulta para um paciente | `/dashboard/agenda?new=true` |
| Novo Paciente | Cadastrar um novo paciente na clínica | `/dashboard/contatos/pacientes?new=true` |
| Novo Formulário | Criar um novo template de formulário | `/dashboard/formularios/novo` |

#### Métricas (`preferences.show_metrics`)

| Card | Valor |
|---|---|
| Consultas Hoje | count |
| Compliance | count |
| Não Cadastrados | count pipeline |
| Formulários Pendentes | count |
| Desempenho do dia: comparecimento | `%` |
| Desempenho do dia: no-show | `%` |

#### Consultas em andamento (condicional)

- Título **Consultas em andamento** + badge contagem
- Texto: “O profissional chamou o paciente. Consulta iniciada — aguardando ser marcada como realizada.”
- Por item: nome paciente; `Iniciada às HH:mm • Agendada: DD/MM/AAAA às HH:mm • Prof.: {nome}`; badge **Em andamento**
- Click → `/dashboard/agenda/consulta/{id}`

#### Compliance (condicional)

- Título **Consultas precisando de confirmação**
- Texto com janela de `clinics.compliance_confirmation_days`
- Por item: nome; data/hora; Prof.; badge **Não confirmada**
- Click → detalhe recepção

#### Pipeline (se `show_pipeline`)

- Título **Leads e entrada comercial**
- Texto explicando que a decisão do dia fica em Agora → Workspace; kanban permanece em Contatos
- Link **Abrir leads** → `/dashboard/contatos/leads`
- Nota: `pipelineItems` pode ser carregado no server, mas **não há kanban inline** — só CTA

#### Consultas do Dia (se `show_upcoming_appointments`)

- Título **Consultas do Dia**
- Botão **Ver todas** → `/dashboard/agenda`
- Por item: nome; data/hora; Prof.; `StatusToggle` (Agendada / Confirmada / Realizada / Falta / Cancelada)
- Empty: “Nenhuma consulta agendada para hoje.”

#### AgoraStrip (server wrapper)

| Elemento | Texto |
|---|---|
| Título | Agora |
| Métrica | contagem |
| Sub | atendimento(s) com próxima ação humana |
| Links (até 3) | label da decisão → `/dashboard/crm/jornada/{id}` |
| Botão | **Ver pendências** → `/dashboard/crm/jornada?view=pendencias` |

#### FinanceAlertsPanel (só se houver alertas)

| Alerta | Destino |
|---|---|
| Atendimentos aguardando emissão de comanda | `/dashboard/atendimento` |
| Comandas vencidas (+30 dias) | `/dashboard/financeiro/receber` |
| Contas a vencer hoje/amanhã | `/dashboard/financeiro/pagar` |
| Contas vencidas | `/dashboard/financeiro/pagar` |

### Fluxos do Usuário

| Ação | Resultado |
|------|-----------|
| Preferências → toggle switch | Persiste widgets; refresh; erro → `alert` e reverte |
| Quick action Nova Consulta | Agenda com deep-link de criação |
| Quick action Novo Paciente | Lista pacientes com form aberto |
| Quick action Novo Formulário | Editor de template |
| StatusToggle na lista do dia | `updateAppointment` + refresh (stopPropagation no clique do badge) |
| Click consulta/compliance/andamento | Detalhe recepção |
| Agora → Ver pendências / link caso | Workspace ou board Jornada |
| Abrir leads | Contatos/Leads |

### Funcionalidades

- Widgets configuráveis por preferência
- KPIs do dia
- Compliance de confirmação
- Lista de andamento (`started_at` preenchido)
- Status inline
- Deep-links de criação
- Integração visual com Agora (CRM) e alertas financeiros

### Dados Utilizados

| Dado | Origem |
|---|---|
| Preferências | `dashboard_preferences` |
| Compliance days | `clinics.compliance_confirmation_days` |
| Compliance appointments | `appointments` status `agendada` no prazo + joins `patients`, `profiles` |
| Métricas consultas hoje | `appointments` |
| Pipeline count | `non_registered_pipeline` |
| Formulários pendentes | `form_instances` status `pendente` (próximos 7 dias) |
| Consultas do dia | `appointments` hoje, ≠ cancelada; filtro `secretary_doctors` se houver vínculos |
| Em andamento | `appointments` com `started_at` not null, status agendada/confirmada |
| Agora | `journey_cases` (active/waiting + pending_decision) |
| Financeiro | `comandas`, `financial_entries`, `encounters` |

Sem API REST dedicada no home — Server Components + Server Actions.

### Estados Especiais

| Estado | Comportamento |
|---|---|
| Preferência off | Seção ocultada |
| Sem compliance days / lista vazia | Bloco compliance oculto |
| Sem andamento | Bloco oculto |
| Sem alertas financeiros | Painel não renderiza |
| Sem consultas hoje | Empty state textual |
| Escopo secretária | Se `secretary_doctors` tem médicos, filtra consultas |
| Atividades recentes | Switch existe; feed não implementado |

### Integrações

- CRM Journey / Agora
- Financeiro (alertas)
- Agenda / Pacientes / Formulários (CTAs)
- WhatsApp indireto via jornada

### Observações de UX

- Preferências com min-height touch 44px no mobile
- Pipeline legado (kanban) substituído por CTA para Contatos
- Compliance e andamento com cores de alerta (laranja/âmbar)
- `pipelineItems` carregado sem uso visual (possível dead data)

---

## 4.3 Dashboard Médico

### Visão Geral

Home do profissional: métricas por período (Hoje/Semana/Mês/Ano), desempenho do dia, calendário semanal, consultas de hoje com detecção de atraso, formulários pendentes. **Não** inclui AgoraStrip nem alertas financeiros.

### Estrutura de Navegação

- Menu: **Início** → `/dashboard`
- Links: detalhe consulta, **Ver Agenda Completa** → `/dashboard/agenda`

### Conteúdo de Cada Página

#### Cabeçalho

| Elemento | Texto |
|---|---|
| H1 | Dashboard do Profissional |
| Sub (daily) | Consultas e informações do dia de hoje |
| Sub (weekly/monthly/yearly) | …da semana / mês / ano atual |

#### Filtro de período

Label **Período:** + botões **Hoje | Semana | Mês | Ano** (disabled enquanto `loadingMetrics`).

#### Métricas principais

| Card | Ícone / cor |
|---|---|
| Total {Hoje\|Semana\|Mês\|Ano} | Calendar |
| Realizadas | CheckCircle2 verde |
| Restantes | Clock |
| Formulários Pendentes | AlertTriangle laranja |

Loading → `Skeleton`.

#### Desempenho (sempre; baseado em consultas de **hoje** no client)

| Card |
|---|
| Desempenho: comparecimento `%` |
| Desempenho: no-show `%` |
| Desempenho: pontualidade `%` |

Pontualidade usa `late_threshold_minutes` (default 15) de `profiles.preferences.doctor`.

#### Calendário Semanal (`WeeklyCalendar`)

| Elemento | Detalhe |
|---|---|
| Título | Calendário Semanal |
| Range | DD/MM - DD/MM |
| 7 colunas | weekday curto + dia; hoje com borda primary |
| Por consulta | Nome, hora, badge status (Realizada/Agendada/Confirmada/raw) |
| Empty dia | Sem consultas |
| Loading | 7 skeletons |
| Link | `/dashboard/agenda/consulta/{id}` |

#### Seção Consultas de Hoje

| Elemento | Detalhe |
|---|---|
| H2 | Consultas de Hoje |
| Botão | **Ver Agenda Completa** → `/dashboard/agenda` |
| Painel | **Próxima Consulta** |
| Lista | **Todas as consultas** (scroll max ~60vh) |
| Subseção past | Consultas Realizadas / Falta / Canceladas |

**Próxima Consulta (com dados):** nome, data/hora, tipo, StatusToggle, botão **Ver Detalhes**  
**Próxima Consulta (vazia):** Nenhuma consulta próxima.

**Card ativo:** hora, nome, badge **Atrasada** se late, tipo, idade, telefone, notes (line-clamp), StatusToggle, ArrowRight.

**Empty total do dia:** ícone calendário + “Nenhuma consulta agendada para hoje.” + painel próxima vazio.

#### Formulários Pendentes (condicional)

| Elemento | Detalhe |
|---|---|
| Título | Formulários Pendentes |
| Texto | Os seguintes pacientes ainda não preencheram os formulários: |
| Badge item | Pendente / Incompleto |
| Link | detalhe da consulta |

### Fluxos do Usuário

| Ação | Resultado |
|------|-----------|
| Trocar período | Se ≠ daily → `getDoctorMetricsByPeriod`; skeleton nas métricas; subtítulo muda. **Lista do dia / calendário semanal não mudam** (só KPIs) |
| Abrir consulta | `/dashboard/agenda/consulta/{id}` |
| StatusToggle | `updateAppointment` → callback local + refresh |
| Ver agenda | `/dashboard/agenda` |

### Funcionalidades

Métricas por período · detecção de atraso · StatusToggle inline · skeletons · lista de formulários pendentes · calendário semanal

### Dados Utilizados

| Dado | Origem |
|---|---|
| Consultas hoje | `appointments` filtrado `doctor_id` + joins patients, services, procedures, appointment_types |
| Formulários | `form_instances` pendente/incompleto do dia do médico |
| Métricas por período | `getDoctorMetricsByPeriod` |
| Semana | `getWeeklyAppointments` |
| Atraso | `getDoctorPreferences` → `late_threshold_minutes` |
| Status update | `updateAppointment` |

### Estados Especiais

| Estado | Comportamento |
|---|---|
| Loading metrics/weekly | Skeletons / opacity |
| Sem consultas hoje | Empty dual-column |
| Sem próxima (só atrasadas/past) | Próxima vazia; lista pode ter itens |
| Atrasada | Borda/fundo laranja + badge |
| Erro status | `alert("Erro ao alterar status: …")` |
| Sem pending forms | Seção ocultada |

### Integrações

Nenhuma externa no home; foco operacional em agenda/formulários.

### Observações de UX

- Filtro de período afeta só KPIs — risco de confusão com “Consultas de Hoje”
- Desempenho % usa appointments de hoje no client, não o período filtrado
- Lista com scroll interno; cards past com opacity 75%

---

## 4.4 Dashboard Admin — Visão Geral

### Visão Geral

Home gerencial + operacional: setup checklist, Agora, operação de hoje, alertas financeiros e analytics (7d/30d/90d) com metas, calendário semanal, risco de no-show e tendência.

### Estrutura de Navegação

- Menu: **Visão Geral** → `/dashboard?period=7d|30d|90d`
- Link condicional **Auditoria** → `/dashboard/auditoria` (se plano com `audit_log_enabled`)
- Destinos: jornada, fila, eventos, lista operacional, serviços/procedimentos, agenda, financeiro

### Conteúdo de Cada Página

#### Cabeçalho

| Elemento | Texto |
|---|---|
| H1 | Visão Geral |
| Sub | Agora prioriza decisões — o Workspace executa |
| Link condicional | **Auditoria** |

#### SetupChecklist — “Primeiros passos” (some se todos done)

| Step label | Href | Done when |
|---|---|---|
| Ver uma pendência no Workspace (demo) | jornada pendências | `journey_cases` > 0 |
| Convidar equipe | `/dashboard/equipe` | profiles > 1 |
| Conectar WhatsApp (recomendado) | integracoes | WA Meta/Simple + phone_number_id |
| Cadastrar salas | salas | rooms > 0 |
| Cadastrar serviços | serviços | services > 0 |

Botões: **Criar atendimento demo** / **Criando…** · **Ver como funciona** → `/dashboard/instrucoes/jornada-crm` · **Ir para Pendências**

#### AdminTodayStrip — “Operação de hoje”

| Métrica | Label |
|---|---|
| N | consultas agendadas |
| N | eventos pendentes |

Botões: **Pendências** · **Fila do dia** · **Central de Eventos** · **Lista de consultas** (`?preset=operacional`)

#### VisaoGeralClient — toolbar e KPIs

SegmentedControl **Período**: **7 dias | 30 dias | 90 dias** (atualiza URL).

**StatCards linha 1:** Total de consultas (trend vs período anterior) · Realizadas · Canceladas / Faltas · Taxa comparecimento `%`

**StatCards linha 2:** Perda estimada (faltas/cancelamentos) BRL · Ticket médio (realizadas) BRL · Taxa de no-show `%`

#### Grade semana

**ProcedureWeekPanel — Procedimentos:** sub “Consultas na semana selecionada”; botão **Gerenciar** → procedimentos; filtro **Todos** + badge soma; por proc: nome, duração, badge count; empty “Nenhum procedimento cadastrado.”; click seleciona/desseleciona (filtra calendário por opacity).

**OverviewWeekCalendar — Agenda da semana:** range label; botões Semana anterior / Próxima; **Agenda completa**; células com slots (hora, patientName, doctorName); overflow `+N mais` (max 4/dia).

#### Metas (`GoalProgressCard`)

Título **Metas operacionais**; labels Confirmação, Comparecimento, No-show, Ocupação, Retorno; display `current / target` + `%` + Progress bar.

#### Top pacientes com risco de no-show

Sub: “Priorize contato hoje…”. Empty: “Sem pacientes críticos…”. Item: nome; data/hora · telefone; badge **Risco alto/medio (score)**. Limite UI top 10.

#### Horários com maior ociosidade

Sugestões de encaixe; empty “Sem dados suficientes”; item `{hour} - {N} agendamentos` + recommendation.

#### ConsultasTrendChart

Título **Consultas no período**; granularidade **Dia | Semana | Mês**; séries Total, Realizadas, Canceladas, Faltas; dia com média móvel 7d.

#### Erro dados

Card: **Não foi possível carregar os dados da Visão Geral.**

### Fluxos do Usuário

| Ação | Resultado |
|------|-----------|
| Mudar período KPI | `router.push` com query → SSR + cache memória ~120s |
| Navegar semana | `getVisaoGeralWeekData` (transition); limpa filtro procedimento |
| Filtrar por procedimento | Calendário esmaece não-matching |
| Criar demo | Action → navega para case |
| Botões strip | Pendências / fila / eventos / lista |

### Funcionalidades

Setup onboarding · Agora · operação do dia · analytics multi-período · metas · risco no-show · ociosidade · tendência · link auditoria

### Dados Utilizados

`getVisaoGeralData` (appointments período+anterior, `clinic_report_goals`, pacientes risco, buckets hora) · `getVisaoGeralWeekData` (procedures, appointments, appointment_procedures) · cache `visao-geral:{clinicId}:{period}` · `getClinicPlanData` · setup (profiles, clinic_integrations, rooms, services, journey_cases) · RPC `get_pending_events`

### Estados Especiais

Não logado → `/entrar` · não admin → `/dashboard` · visaoGeral null → erro · weekData null → grade omitida · metas/chart vazios → cards omitidos · setup completo → checklist some · week data não-admin → “Não autorizado”

### Integrações

WhatsApp (checklist) · Financeiro (alertas) · CRM Journey · Metas · Auditoria (feature flag)

### Observações de UX

Mensagem “Agora prioriza / Workspace executa” alinha home a CRM. KPI período independente da semana do calendário. Filtro procedimento só visual. Calendar week max 4 slots + “+N mais” sem link para o restante.

## 4.5 StatusToggle — componente compartilhado

Usado em secretária (lista do dia) e médico (próxima + listas).

| UI | Detalhe |
|---|---|
| Trigger | Badge status + ChevronDown |
| Menu | Agendada, Confirmada, Realizada, Falta, Cancelada |
| Loading | opacity-50, disabled |
| Sucesso | onStatusChange + refresh |
| Erro | alert |

Action: `updateAppointment`.

## 4.6 Matriz comparativa das homes

| Capacidade | Secretária | Médico | Admin |
|---|---|---|---|
| Quick actions criação | Sim | Não | Não |
| Preferências UI seções | Sim | Não | Não |
| AgoraStrip | Sim | Não | Sim |
| Finance alerts | Sim | Não | Sim |
| Setup checklist | Não | Não | Sim |
| Operação de hoje strip | Não | Não | Sim |
| KPIs financeiros / tendência | Não | Não | Sim |
| Calendário semanal | Não | Sim | Sim |
| StatusToggle inline | Sim | Sim | Não |
| Filtro período | Não | Hoje/Semana/Mês/Ano | 7d/30d/90d |
| Compliance confirmação | Sim | Não | Não |
| Consultas em andamento | Sim | Não | Não |

---

# 5. Agenda

## 5.1 Visão Geral

| Campo | Valor |
|--------|--------|
| **Rota** | `/dashboard/agenda` |
| **Objetivo** | Calendário operacional: criar/editar/reagendar consultas, bloqueios, fila de espera |
| **Problema** | Unificar grade horária, status e atalhos para recepção/clínico |
| **Conexões** | Pacientes, Procedimentos/Serviços, Salas, Formulários, Estoque (BOM), Financeiro (comanda), Waitlist, Planos de tratamento |
| **Arquivo principal** | `agenda-client.tsx` + modal de appointment + sidebar de detalhes |

## 5.2 Estrutura de Navegação

Menu Agenda → **Calendário** (esta página) · **Lista de consultas** (`/dashboard/consulta`).

Deep-links que abrem modal de nova consulta e limpam a URL:

- `?new=true`
- `?novaConsulta=1`
- `?patientId=`
- `?patientEmail=`
- `?doctorId=`

Clique em evento → sidebar de detalhes. Links da sidebar: recepção `/agenda/consulta/[id]` e clínico `/agenda/atendimento/[id]`.

## 5.3 Conteúdo de Cada Página (UI completa)

### Header / ações

- Título **Agenda**
- Botão filtros (ícone sliders) + badge com contagem de filtros ativos
- **Indisponibilidades** (ícone Ban; mobile = ícone)
- **Fila de espera** (admin/secretaria; badge com contagem)
- **Nova consulta** (+ ; mobile = ícone)

### Toolbar — Visualização

- Toggle: **Timeline** (`Rows3`) | **Calendário** (`CalendarDays`) — preferência persistida
- Timeline: **Dia | Semana | Mês**
- Calendário: **Semana | Mês**

### Período

- Anterior / label do intervalo / Próximo
- Botão **Hoje**

### Dialog “Filtros da agenda”

| Filtro | Opções |
|--------|--------|
| Status (multi) | Agendada, Confirmada, Realizada, Falta, Cancelada |
| Profissional | Todos + lista (só se >1 médico) |
| Procedimento | Todos + lista |
| Formulários | Todos \| Confirmados sem formulário \| Confirmados com formulário |
| Serviço | Todos + lista |
| Sala | Todas + lista |
| Critério de cor | Status \| dimensões de preço |
| Ações | **Limpar tudo** \| **Aplicar** |

### Views de conteúdo

**Timeline dia/semana/mês:** cards por dia; itens com grip (DnD `@dnd-kit`), horário, paciente, procedimento/serviço/valor, link externo, editar, badge “N form.” se pendente, dropdown de status. Empty por dia: “Nenhuma consulta nesta data”.

**Calendário semana (desktop):** grade horária tipicamente 7h–20h + bloqueios cinza; eventos coloridos com layout de overlap; drop em slot.

**Calendário semana (mobile):** seletor de dias + lista.

**Calendário mês:** grade Seg–Dom; desktop mostra até 4 eventos; mobile abre dialog do dia.

### Cores de status

| Status | Cor |
|--------|-----|
| agendada | azul |
| confirmada | verde |
| realizada | roxo |
| falta | âmbar |
| cancelada | vermelho |

### Modal Nova/Editar consulta (wizard 4 passos)

| Passo | Campos / ações |
|-------|----------------|
| **1 Dados básicos** | Paciente*, Profissional*, Sala/consultório (* se `roomsRequired`), Observações (textarea) |
| **2 Procedimentos** | Checkboxes procedimentos (filtrados por vínculo médico), aviso BOM insumos, Recomendações (textarea), Vincular formulário (select + Adicionar / Remover) — só create |
| **3 Data e hora** | Data início*, Hora início*, Hora término*, duração prevista; Recorrência: checkbox, Frequência (semanal/quinzenal/mensal), Nº sessões (2–52), overrides por sessão, forçar conflito (admin) |
| **4 Financeiro** | Política pagamento: antecipado / no_dia / pos_atendimento; Serviço; selects por dimensão de preço; resumo serviço+materiais+total; modelo cobrança da série |

Rodapé: **Cancelar** · **Anterior** · **Próximo** · **Agendar consulta** / **Salvar alterações**. Em conflito: CTA **Adicionar à fila de espera**. Sucesso → refresh + abre sidebar do evento.

**Campos no modelo sem UI no wizard atual:** `requiresFasting`, `requiresMedicationStop`, `specialInstructions`, `preparationNotes` (salvos na API se enviados, mas sem inputs visíveis).

### Modal Indisponibilidades (`ScheduleConfigModal`)

Abas: **Novo bloqueio** | **Períodos** — criar/listar bloqueios avulsos ou recorrentes que aparecem cinza no calendário semanal.

### Modal Fila de espera (`AgendaWaitlistModal`)

Lista do dia: paciente · médico · faixa horária · **Remover**. Origem típica: conflito de horário no agendamento. Liberação de horário pode gerar toast com matches da fila.

### Sidebar Detalhes do evento (~380px)

- Horário + duração prevista + sala + badge status
- Médico, paciente, telefone
- Procedimentos
- Bloco Comanda (provisória ou emitida): itens, subtotal, desconto, total
- “N un. reservadas”
- Links: Editar agendamento; Materiais (se estoque); Enviar formulário (pendentes) / “Formulários ok”
- Footer: **Atendimento** | **Finalizar** (desabilitado sem comanda ou se já finalizada)
- Painel Materiais: qty, lixeira, select produto + qty + Plus; bloqueado se encounter finalizado/cobrado

## 5.4 Fluxos do Usuário

| Ação | O que acontece |
|------|----------------|
| Click consulta | Abre sidebar detalhes |
| Nova consulta | Wizard 4 passos → sucesso → sidebar |
| DnD | `updateAppointment` horário (preserva duração); toast erro se falhar |
| Mudar status no badge da lista | Atualiza appointment |
| Conflito no agendamento | CTA fila de espera |
| Liberação de horário | Toast com matches da fila |
| Indisponibilidade | Bloqueia slots |
| Atendimento (sidebar) | Vai para `/agenda/atendimento/{id}` |
| Finalizar | Vai para `/consulta/[id]?operacional=1` (foca cobrança) |

## 5.5 Funcionalidades

Criar · Editar · Reagendar (DnD) · Filtrar · Colorir por status/dimensão · Bloquear horário · Fila de espera · Preferências persistidas (view, granularidade, filtros, cor) · Deep-link criação · Preview de cobrança · Recorrência / série · Vincular formulários na criação

## 5.6 Dados Utilizados

`appointments` (+ patient, doctor, procedures, service, room, valor, dimension_value_ids, form_instances) · catálogo (patients, doctors, procedures, services, rooms, form_templates, pricing dimensions/values, servicePriceRules, doctorProcedures, scheduleBlocks) · preferências do usuário (`agenda_*`) · waitlist por data · comandas/consumo · BOM/preço (`getAppointmentChargePreview`) · planos de tratamento (série recorrente)

## 5.7 Estados Especiais

- Loading: `CalendarPageSkeleton`
- Schema incompleto: `SchemaErrorBanner`
- Empty por dia/coluna
- Toasts de erro no DnD
- Mobile <640px: UI condensada (ícones circulares)
- Fila só para admin/secretaria
- Sala sem `room_id` permanece visível mesmo com filtro de sala
- Escopo médico: próprias consultas; secretária: médicos vinculados

## 5.8 Integrações

Supabase (load + actions) · toast · preferências · waitlist · estoque BOM · financeiro preview · formulários · planos de tratamento

## 5.9 Observações de UX

- Filtros só em dialog — toolbar limpa
- Contador de filtros e fila de espera reduzem ansiedade
- Tooltip do evento com tempo, sala, procedimentos, serviço, valor, formulários
- Pós-criar abre sidebar (feedback imediato)
- Criação unificada: lista de consultas redireciona para cá
- Preferências da agenda persistem; filtros da lista Consulta **não**

---

# 6. Consulta (Lista e Recepção)

## 6.1 Lista `/dashboard/consulta`

### Visão Geral

Lista cronológica ampla (−1 a +2 anos no servidor) com filtros de período, busca e dimensões. **Nova consulta** redireciona para a Agenda (`?new=true`) — criação unificada.

| Campo | Valor |
|--------|--------|
| **Objetivo** | Arquivo/lista filtrável de appointments com atalho operacional |
| **Problema** | Buscar consultas fora da grade do calendário; modo operacional (−7/+14) alinhado à fila |
| **Conexões** | Agenda (criação), Recepção (detalhe), Fila operacional |

### Estrutura de Navegação

- Menu Agenda → **Lista de consultas**
- Item → `/dashboard/agenda/consulta/[id]`
- Banner operacional → `/dashboard/atendimento`
- `?preset=operacional` → período operacional (−7/+14)
- `?filterPatientId=` → filtro por paciente
- Params `new` / `patientId` / `doctorId` → redirect para Agenda

### Conteúdo de Cada Página

- Título **Lista de consultas**
- Botão filtros (dialog) + **Nova consulta**
- Banner operacional (se período operacional) + link fila
- Banner filtro paciente + **Limpar filtro**
- Busca: “Busca por nome ou telefone”
- Período: **Hoje | Operacional (21 dias) | 7 dias | Mês | Personalizado** (+ datas de/até)
- Dialog filtros: Serviço, Status, Profissional (>1), Dimensão, Valor da dimensão | **Limpar** | **Aplicar**
- Lista: data/hora, nome, telefone, procedimento · serviço, Prof., badge status, badge **Incompleto WhatsApp** se `intake_pendencies`
- Modo operacional: cards por dia + badge **Hoje** + contagem

### Filtros / status

- Status (single): Todos | Agendada | Confirmada | Cancelada | Realizada | Falta
- Serviço, médico, dimensão, valor dimensão, paciente via URL, busca texto/telefone

### Fluxos do Usuário

Filtrar → abrir consulta · Nova → Agenda · preset operacional ↔ fila operacional · limpar filtro paciente

### Funcionalidades

Busca · períodos pré-definidos · filtros de serviço/status/profissional/dimensão · badge intake WhatsApp · escopo por papel

### Dados Utilizados

`appointments` + patient (nome, phone), doctor, procedure, service_id/name, dimension_value_ids, intake_pendencies; catálogos auxiliares; `lib/operational-queue`

### Estados Especiais

Lista vazia · médico vê só suas · secretária só médicos vinculados · período personalizado invertido zera lista

### Integrações

Supabase direto na page · `getStatusBadgeClassName` · fila operacional

### Observações de UX

Lista como “arquivo”; Agenda como “calendário vivo”; criação unificada na Agenda; filtros da lista **não** persistem em preferências (diferente da Agenda).

---

## 6.2 Recepção `/dashboard/agenda/consulta/[id]`

### Visão Geral

Visão operacional da consulta: dados, status do agendamento, encounter, materiais, comanda. Nav **Recepção | Clínico**.

| Campo | Valor |
|--------|--------|
| **Objetivo** | Check-in operacional e cobrança |
| **Problema** | Separar recepção (status/comanda/consumo) do workspace clínico |
| **Arquivos** | page + `AppointmentStatusBar` + `AtendimentoClient` (mode full) |

**Nota:** `ConsultaDetalheClient`, `FormulariosConsultaClient` e `CheckInPaymentPolicy` existem no código, mas **não estão montados** na página atual (legado/órfãos).

### Estrutura de Navegação

- Breadcrumb: Agenda → nome paciente; back Agenda
- `AppointmentEncounterNav`: **Recepção** (atual) | **Clínico** (`/agenda/atendimento/{id}`)
- Query params:
  - `?operacional=1` — auto-abre emit comanda
  - `?autostart=1` — inicia atendimento
  - `?tab=formularios|exames` — redirect clínico
  - `?tab=consulta|paciente|operacional` — abas legadas se presentes

### Conteúdo de Cada Página

#### Card Consulta

- Horário + **Reagendar** / **Agendar retorno** (se realizada) — popup data/hora início/fim
- Botão série recorrente (se `recurrence_group_id`)
- Paciente, Profissional, Atendimento (procs · serviço)
- Badge status
- Badge política pagamento (`antecipado` | `no_dia` | `pos_atendimento` ou “Não definido”)
- Duração previsto/real (+ alerta se real > 120% previsto)
- Observações

#### Card Procedimentos e valor

- Lista procs; breakdown serviço + materiais BOM + total (`getAppointmentChargePreview`)

#### Card Paciente

- Nome, email, telefone, nascimento

#### AppointmentStatusBar

- Banner “Atendimento em andamento desde HH:MM” + **Marcar como realizada**
- Duração se realizada
- Status buttons:
  - Admin/secretaria: Agendada, Confirmada, Realizada, Falta, Cancelada + **Excluir**
  - Médico: Realizada, Falta
- Cancelada/Falta → `AppointmentCancelWizard` (taxas, no-show)
- Excluir → ConfirmDialog → volta Agenda

#### AtendimentoClient (mode full) — stepper operacional (5 etapas)

1. Agendada → 2. Em atendimento → 3. Clínico encerrado → 4. Comanda emitida → 5. Quitada

Estados terminais: “Falta registrada” / “Consulta cancelada”

**Cards operacionais:**

- **Iniciar atendimento** (se sem encounter)
- Badges encounter: Em atendimento | Aguardando comanda | Quitado; comanda + saldo
- Card Atendimento clínico + **Encerrar atendimento clínico**
- Card Cobrança (`ComandaBillingPanel`): Gerar comanda, Finalizar comanda, Receber pagamento; total/desconto/pago/saldo; itens; pagamentos
- Card Consumo de material (se há linhas): qty, remover, adicionar produto; locked após encerrar
- Dialogs: atenção ao encerrar → revisar materiais → encerrar

### Fluxos do Usuário

Check-in operacional típico:

1. Confirmar / ajustar status
2. **Iniciar atendimento** → encounter `em_andamento`
3. Ajustar materiais (opcional na recepção)
4. Encerrar clínico (recepção ou workspace)
5. Finalizar comanda / Receber
6. Appointment pode ir para `realizada` em paralelo

Autostart da fila; `operacional=1` foca cobrança; cancelamento com wizard; reagendar / retorno.

### Funcionalidades

Status por papel · wizard cancelamento · stepper 5 etapas · encounter lifecycle · comanda · consumo estoque · preview cobrança · série recorrente · deep-links autostart/operacional

### Dados Utilizados

Appointment gate, timing, payment_policy, recurrence, procedures, charge preview, encounters, consumption lines, comandas, products, patients, profiles

### Estados Especiais

Schema error banner · notFound · médico só edita operacional se for o doctor da consulta · consumo locked pós clínico · comanda cancelada filtrada na fila

### Integrações

Financeiro (comanda/pagamento) · estoque · waitlist ao cancelar/reagendar · formulários públicos linkados por email · clínico (nav)

### Observações de UX

Separação clara Recepção vs Clínico; stepper educa o fluxo; cancelamento com wizard; três camadas de status devem ser comunicadas visualmente.

---

# 7. Atendimento (Fila e Clínico)

## 7.1 Fila operacional `/dashboard/atendimento`

### Visão Geral

Lista de consultas no range operacional (−7/+14 dias), statuses `agendada|confirmada|realizada`, com badges de encounter/comanda e CTAs rápidos.

| Campo | Valor |
|--------|--------|
| **Objetivo** | Inbox do dia a dia de consumo/comanda/cobrança |
| **Problema** | Não misturar fila operacional com lista histórica completa |
| **Redirects** | `/dashboard/atendimentos` e `/atendimentos/sadt` → esta fila |

### Estrutura de Navegação

Menu Atendimento → **Fila operacional**. Link **Ver na lista de consultas** (`?preset=operacional`). Botões por item: **Consulta** (recepção) · **Iniciar atendimento** (`?autostart=1`).

### Conteúdo de Cada Página

- Título **Fila operacional** + texto explicativo
- Cards por dia (destaque Hoje) + contagem
- Por item: nome, data/hora · médico, badges status appointment + operacional
- Badges operacionais: **Quitada** | **Comanda aberta** | **Comanda parcial** | **Aguardando comanda** | **Em atendimento**

### Fluxos do Usuário

Abrir recepção · Iniciar com autostart · Ir para lista operacional · Escopo por papel

### Funcionalidades

Agrupamento por dia · badges compostos · CTAs rápidos · link cruzado lista

### Dados Utilizados

appointments + encounters + comandas; escopo: médico = próprias; secretária = `secretary_doctors` (zero vínculos → lista vazia)

### Estados Especiais

Empty por escopo · range −7/+14 · canceladas fora do conjunto típico da fila

### Integrações

Recepção · Clínico · Financeiro

### Observações de UX

Fila “do dia a dia” vs lista completa em Consulta; nomenclatura “Atendimento” exige atenção (fila ≠ clínico).

---

## 7.2 Clínico `/dashboard/agenda/atendimento/[id]`

### Visão Geral

Workspace clínico: fichas, documentos, notas, transcrição, arquivos, timer, encerrar clínico, modal comanda.

| Campo | Valor |
|--------|--------|
| **Arquivo** | `atendimento-clinico-client.tsx` |
| **Objetivo** | Posto clínico do profissional durante/após o encounter |
| **Conexões** | Fichas, Clinical Documents, Notas, Transcrição, Exames, Comanda |

### Estrutura de Navegação

- Header + breadcrumb Agenda → paciente
- Nav Recepção | **Clínico**
- Sidebar esquerda → painel principal
- `?finalize=1` abre modal comanda

### Conteúdo de Cada Página

**Header:** nome, data · médico; ação **Finalizar comanda** se aguardando cobrança

**Sidebar paciente:** foto/idade

**Seção Fichas de atendimento**

- Agrupadas por procedimento ou histórico (`FichaHistorySidebar`)
- Itens numerados; histórico de consultas anteriores
- Copy single ficha

**Seção Relatórios do paciente**

- Esta consulta / Outras; badges Pendente | OK | Incompleto
- `VincularRelatorioAtendimento` no rodapé sidebar

**Seção Registro**

- Notas da consulta
- Transcrição de áudio (Mic)
- Arquivos (`ExamesClient`)

**Painel central**

- **Trazer da consulta anterior** (`CopyFichasDialog`)
- Ficha tipo `fields` → `FichaFieldsPanel` (editável se atual e não concluída)
- Tipos `certificate` / `prescription` / `exam_request` / slug `atestado` → `ClinicalDocumentsClient` (**só médico**)
- Não-médico: “Apenas o profissional pode preencher…”
- Histórico doc-type: link para atendimento antigo
- Relatório → `AtendimentoRelatorioPanel`
- Notas → feed tipo Facebook (`ConsultationNotesClient`)
- Transcrição → `ClinicalTranscriptionPanel` (streaming config ViaProve)
- Arquivos → upload exames

**Footer:** timer MM:SS; **Encerrar atendimento clínico** (médico + encounter em andamento)

**Modal Finalizar comanda:** `AtendimentoClient` mode `billing-only`

### ConsultationNotesClient (detalhe)

- CTA “Escrever sobre esta consulta…” → textarea → **Cancelar** / **Publicar**
- Feed: autor, tempo relativo, **Editar** / **Excluir** (próprias ou admin)
- Confirm delete

### Fluxos do Usuário

Abrir ficha → preencher/salvar → documentos clínicos → encerrar → comanda  
Copiar fichas de atendimento anterior  
Registrar notas / áudio / arquivos  
Finalizar comanda se `finalize=1` ou header

### Funcionalidades

Split sidebar/main · cópia de fichas · documentos gated · streaming/batch transcription · timer de sessão · vincular relatório · billing-only modal

### Dados Utilizados

Fichas (`ensureAppointmentFichas`, history) · form reports · encounter status · clinical documents · transcription config · exames do paciente · catálogos médico (meds/exames/atestados)

### Estados Especiais

Sem ficha: empty states · fichas concluídas read-only · loading · só médico emite docs · encounter não em andamento: footer encerrar oculto/disabled

### Integrações

Clinical documents (PDF/print) · estoque via comanda modal · ViaProve streaming · catálogos do perfil médico

### Observações de UX

Layout split clínico; timer de sessão; agrupamento por procedimento; barreira clara “só médico” em docs.

---

# 8. Documentos Clínicos

## 8.1 Visão Geral do módulo

Hubs reutilizam `DocumentosHubClient` para listar e criar documentos clínicos avulsos ou vinculados a atendimento.

| Página | Rota | Type |
|--------|------|------|
| Prescrições | `/dashboard/atendimentos/prescricoes` | prescription |
| Pedidos de exame | `/dashboard/atendimentos/pedidos-exame` | exam_request |
| Atestados | `/dashboard/atendimentos/atestados` | certificate |

`/dashboard/atendimentos` redireciona para fila operacional (não é hub de docs).

## 8.2 Estrutura de Navegação

Menu Atendimento → Prescrições / Pedidos de exame / Atestados. Links para perfil do paciente e “Ver atendimento”.

## 8.3 Conteúdo de Cada Página (UI comum)

### Lista

- Título/subtitle por tipo
- **Nova prescrição / Novo pedido / Novo atestado** (só médico)
- Card: N registros
- Item: paciente (link), Dr(a)., badge **Avulso**, data, **Reimprimir**, **Download PDF**, **Ver atendimento**

### Fluxo criar (médico)

Views: `list` → `pick-patient` (`ClinicalPatientPicker`) → `edit` (`ClinicalDocumentsClient` standalone) → refresh

### Clinical Documents Client (embutido ou standalone)

**Views:**

- **list:** título + Nova; itens com status; editar rascunho / imprimir / PDF / eye
- **edit:** Voltar; templates (exceto atestado); editors estruturados; preview; **Salvar rascunho**; **Finalizar e imprimir**; layout picker (exame/atestado)

**Status documento:** `draft` | `issued_manual` | `signed_digital` | `pending_signature` | `void`

**Campos por tipo:**

| Tipo | Campos |
|------|--------|
| Receita | Catálogo meds (busca), nome/dosagem/qtd/instruções, observações |
| Exame | Catálogo + linhas manuais + notas; salvar no catálogo |
| Atestado | Modelos, body, dias, CID-10; salvar modelo |

`DocumentosListClient` = versão só-leitura mais simples (reimprimir sem download/criar).

## 8.4 Fluxos · Funcionalidades · Dados · Estados · Integrações · UX

**Fluxos:** listar → reimprimir/PDF · criar avulso pick-patient → editar → finalizar · editar rascunho no clínico

**Funcionalidades:** templates · catálogo · preview · print HTML · PDF storage · schema check banner · validação antes de finalizar

**Dados:** `listClinicalDocumentsByType`; HTML/PDF actions; pacientes; appointments

**Estados:** empty states específicos por tipo · só médico cria · avulso vs vinculado

**Integrações:** Contatos · Atendimento clínico · Storage PDF · print window

**UX:** hubs simétricos por tipo; criação avulsa explícita; reimpressão rápida

---

# 9. Contatos e Pacientes

## 9.1 Visão Geral do módulo

Central de relacionamentos: pacientes, profissionais, fornecedores, leads, aniversariantes e visão unificada. Pacientes é a entidade clínica central; leads alimentam CRM; fornecedores alimentam financeiro.

### Navegação do grupo Contatos

Pacientes · Profissionais · Fornecedores (admin/secretária) · Leads (entrada) (admin/secretária) · Todos contatos · Aniversariantes

---

## 9.2 Pacientes — Lista

### Visão Geral

| Campo | Valor |
|--------|--------|
| **Rotas** | `/dashboard/contatos/pacientes` (= `/dashboard/pacientes`) |
| **Objetivo** | CRUD operacional de pacientes + fila de não cadastrados (forms públicos) |
| **Arquivo** | `pacientes-client.tsx` |

### Estrutura de Navegação

Breadcrumb Pacientes. Clique no contato → `/dashboard/contatos/pacientes/[id]`. Query `?new=true` abre cadastro; `?edit={id}` abre edição.

### Conteúdo de Cada Página

- **Banner pós-cadastro:** “Evento criado. Sugestão: agendar…” · botões **Agendar consulta** · fechar (X)
- **Header:** título Pacientes · descrição · **Novo paciente** (só aba Cadastrados)
- **Toolbar:** busca “Buscar por nome, e-mail ou telefone…” · toggle de view (contatos / cards / lista) — persistido em `localStorage`
- **Abas:** Cadastrados (count) · Não Cadastrados (count)
- **Formulário inline** (card, não modal):
  - Nome completo * · Data nascimento · CPF · E-mail · Telefone · Observações
  - Bloco **Informações Adicionais** (campos personalizados: text / number / date / textarea / select)
  - Botões: **Cadastrar/Salvar** · **Cancelar** · X no header
- Se editando: card **Exames do Paciente** (`ExamesClient`)
- Contador “N paciente(s) encontrado(s)”
- Views: agrupamento A–Z + rail alfabético; cards com idade; lista com ações Abrir / Editar / Excluir
- Aba Não Cadastrados: nome, email, telefone, nascimento, “N formulário(s)” · **Cadastrar**
- **ConfirmDialog:** “Excluir cadastro” · Excluir / cancelar

### Fluxos do Usuário

Novo → salva → toast + banner + evento na Central · Editar · Excluir · Registrar não-cadastrado (`registerPatientFromPublicForm`) → move para cadastrados · Busca em tempo real · Abrir perfil · Deep-link new/edit

### Funcionalidades

CRUD · custom fields · três view modes · alphabet rail · conversão de submitter público · exames embutidos na edição · banner pós-cadastro sugerindo agenda

### Dados Utilizados

`full_name`, email, phone, birth_date, cpf, notes, custom_fields, photo_url · non_registered submitters · form counts

### Estados Especiais

loading · error · deletingId · registeringEmail · viewMode · activeLetter · empty state com CTA

### Integrações

Actions pacientes · Central de Eventos · Agenda/Consulta · Exames · Formulários públicos

### Observações de UX

Empty state com CTA; alphabet rail com scroll/intersection; form inline (não modal) para cadastro rápido; banner pós-cadastro empurra próximo passo (agendar).

---

## 9.3 Perfil do paciente `/contatos/pacientes/[id]`

### Visão Geral

Perfil 2 colunas: resumo sticky + abas de histórico clínico/financeiro/consentimento.

### Estrutura de Navegação

Breadcrumb Pacientes → nome · voltar lista · links Agenda / WhatsApp externo / edição lista · consultas / atendimentos / financeiro

### Conteúdo de Cada Página

**Coluna esquerda:** foto (upload câmera se canEdit) · nome · idade/telefone/CPF · badge Paciente · **Enviar mensagem** (WhatsApp) · **Agendar consulta** · **Editar cadastro** · mini KPIs Pago / Pendente / Consultas

**Abas (pill):**

| Aba | Conteúdo |
|-----|----------|
| Informações | Nome, nascimento, e-mail, telefone (+ link WhatsApp), CPF, observações, custom fields, data cadastro, **PatientConsentCard** (finalidades Marketing / Comunicações / Tratamento de dados; registrar/revogar) |
| Linha do tempo | Até 40 eventos (data, título com link, subtítulo) — consulta/pagamento/comanda/evento |
| Prontuário | Consultas (status badge, Abrir) · Fichas · Arquivos e exames |
| Pagamentos | StatCards Total recebido / Em aberto / Total faturado · lista pagamentos · comandas (Ver itens · Cancelar comanda se permitido) |
| Formulários | Nome template, status Pendente/Preenchido/Enviado, Ver atendimento |
| Receitas e meds. | Receita / Pedido de exame · Recomendações de consulta |

**Modais:** Detalhes da comanda (itens, total, pagamentos) · CancelComandaDialog

### Fluxos · Funcionalidades · Dados · Estados · Integrações · UX

Upload foto · abrir/cancelar comanda · links Agenda/WhatsApp/Financeiro · consentimento LGPD.

Estados: activeTab, uploadingPhoto, comandaDetail, cancelComanda.

Integra consent, exames, fichas, encounter-actions, financeiro.

UX: sidebar sticky; abas pill; mini KPIs financeiros no resumo.

---

## 9.4 Campos personalizados `/campos-pacientes` ou Config → Campos

### Visão Geral

Admin only. Tabs: **Campos de paciente** · **Fichas de atendimento** · **Formulários** (atalho CRM).

### Conteúdo UI — Campo paciente

Rótulo*; Tipo (texto curto/longo/número/data/seleção); Opções; ☑ Obrigatório; WhatsApp policy ignore/optional/required; ☑ Form público; CRUD + confirm delete.

### Conteúdo UI — Fichas

Nome; Tipo fields/prescription/exam_request/certificate/notes; Ordem; FormBuilder DnD para tipo fields; campos prescription/exam_request/certificate.

### Dados / Integrações / UX

`patient_field_definitions`, fichas clínicas. Integra WhatsApp intake, forms públicos, atendimento clínico. UX: aba Formulários só linka CRM (não lista local).

---

## 9.5 Profissionais `/contatos/profissionais`

### Visão Geral

Admin: gestão de equipe (`EquipeClient`) + roteamento WhatsApp. Não-admin: lista somente leitura.

### Conteúdo UI (não-admin)

Lista: nome, email, especialidade/CRM · badge Profissional/Secretário(a)/Admin · link perfil · médico: **Meu perfil profissional**

### Perfil `/contatos/profissionais/[id]`

Tabs (médico): Visão geral · Atividade · Procedimentos  
Avatar, role, CRM, especialidade, cores agenda, tolerância atraso, secretárias, mensagem indicação, consultas recentes, procedimentos. Self: **Editar meu perfil**.

---

## 9.6 Fornecedores `/contatos/fornecedores`

### Visão Geral

Cadastro para despesas/contas a pagar. Grid de cards. Médico bloqueado.

### Conteúdo UI

Header + **Novo fornecedor** (se canManage) · busca nome/documento/email/telefone · cards clicáveis

**Modal detalhes:** CNPJ/CPF, e-mail, telefone, observações

**Modal Novo:** Nome * · CNPJ/CPF · E-mail · Telefone · Observações · **Salvar**

Sem edição/exclusão na UI atual (CRUD parcial: criar+ver).

---

## 9.7 Leads — hub `/contatos/leads`

### Visão Geral

Lista operacional de entrada comercial; posto de trabalho = Workspace Jornada. Só admin/secretária.

### Estrutura de Navegação

Header + **Abrir Jornada**. Links por lead: Ver jornada · Abrir conversa WhatsApp · perfil paciente (repescagem)

### Conteúdo de Cada Página

**Abas lifecycle:** Todos · Lead novo · Em qualificação · Qualificado · Oportunidade · Cliente · Perdido · **Repescagem**

**Toolbar:** filtro temperatura (lista/prioridade): Todas / Quente / Morno / Frio · views **Kanban / Prioridade / Lista / Gráficos**

**Kanban/Lista** (`PipelineClient` embutido) — colunas lifecycle:

1. Lead novo  
2. Em qualificação  
3. Qualificado  
4. Oportunidade  
5. Cliente  
6. Perdido  

**Card kanban:** nome, score, email, badge temperatura, fonte (Formulário/Site/WhatsApp/Manual), telefone, N formulários, próxima ação

**Ações por estágio:** Registrar contato · Qualificar · Cadastrar · Agendar

**Lista:** mesma info + nota (ícone) + select mudar lifecycle

**Modais pipeline:** Adicionar Nota (textarea) · Marcar como perdido (motivos: Valor/preço, Horário, Localização, Indecisão, Urgência resolvida, Sem resposta, Motivo não identificado, Desistiu, Concorrência, Faltou, Cancelou, Outro)

**Prioridade:** lista ordenada por temperatura + score + breakdown + Ver jornada / Abrir conversa

**Gráficos:** StatCards Leads novos / Repescagem / Oportunidades / Clientes · barras por etapa · pizza motivos de não conversão

**Repescagem — colunas:** Sugeridos · Ativos · Arquivados  
Card: nome, email, phone, origem (Falta/Cancelamento/Manual/Captação), motivo perda · Perfil · Qualificar · Arquivar

### Fluxos · Funcionalidades · Dados · Estados · Integrações · UX

DnD muda lifecycle; perda exige motivo; cadastrar → paciente; agendar → agenda com email. Temperatura/score derivados. Empty states por view. Integra Jornada, WhatsApp, Agenda, Eventos.

---

## 9.8 Todos contatos `/contatos/todos`

Lista unificada (até ~70vh scroll). Item: nome (link se houver), email · phone, badges tags: Paciente, Lead ativo, Lead, Fornecedor, Profissional. Sem busca/filtro/ações — visão só leitura.

---

## 9.9 Aniversariantes `/contatos/aniversariantes`

“Hoje — N paciente(s)”. Lista nome + phone/email → perfil. Empty: “Nenhum aniversariante hoje”. Sem filtros de período (só hoje).

---

# 10. CRM e Jornada

## 10.1 Visão Geral

| Campo | Valor |
|--------|--------|
| **Objetivo** | Operar cases (pendências humanas) e medir funil; templates de captação |
| **Princípio** | KPIs em Pipeline; posto de trabalho = Jornada; Leads = lista de entrada |
| **Acesso** | admin / secretaria |
| **Layout** | `crm/layout` bloqueia médico |

### Navegação do grupo CRM

Pendências e Fluxo (`/crm/jornada`) · Indicadores (`/crm/pipeline`) · Formulários (`/crm/captacao`)

---

## 10.2 Pipeline (KPIs) `/crm/pipeline`

### Visão Geral

Só métricas e funis — não é posto operacional. CTA **Abrir Pendências**.

### Conteúdo UI

- `CrmPipelineBoardsClient`: faixa “Operação de Cases… Abrir Jornada” (legado)
- `CrmFunnelCharts`: PeriodFilter · KPIs Novos leads / Consultas agendadas / Lead→Consulta / Consulta→Realizada · Funil captação · Funil comparecimento · Tendência
- `/crm/funil` → redirect `pipeline#funis`

### Fluxos / Dados / UX

Mudar período → refresh charts. Dados de leads + appointments. UX: deixa claro “indicadores ≠ operação”.

---

## 10.3 Jornada Board `/crm/jornada`

### Visão Geral

Board operacional de Cases. Redirects: `caseId`, `phone`, `email` → workspace ou mensagem “nenhum atendimento”.

### Conteúdo — Views (botões)

| View | Hint | Layout |
|------|------|--------|
| **Pendências** | O que exige decisão agora? | Grid cards |
| **Fluxo** | Onde cada atendimento está? | Kanban por fases do workflow (labels dinâmicas do DB) + seletor de Workflow |
| **Comparecimento** | Consultas que precisam de ação | Colunas: **Agendada · Confirmada · Realizada · Falta · Cancelada** |
| **Atendimento automático** | Sob responsabilidade da IA | Grid |

**Card Case:** displayName, phaseName, badges owner / nextAction / quote / N pendências → `/crm/jornada/{caseId}`

**Card Comparecimento:** nome, data/hora, médico; DnD muda status

Query: `view`, `workflow`, `caseId`, `phone`, `email`.

Fluxo: DnD case → `requestCasePhaseOverride`. Comparecimento: DnD → `changeAttendanceStatus`.

Centro `/crm/jornada/centro` redireciona para jornada. `/dashboard/pipeline` → jornada pendências.

### Componentes jornada visual (components/crm/)

CaseBoard, CaseWorkspace, JourneyList/Detail/Stepper/PhaseRail/FlowMap/StepCards/ParallelTracks/NextActionCard — fases típicas: Captação → Comercial → Pré-consulta → Consulta → Financeiro → Pós-consulta → Pós-atendimento → Reengajamento.

---

## 10.4 Workspace `/crm/jornada/[caseId]`

### Visão Geral

Posto de trabalho do atendimento. IDs `lead-`/`patient-` redirecionam ao board.

### Conteúdo UI

**Header:** Processo · workflow · displayName · Fase · próxima consulta · badges owner / orçamento / tasks

Bloco **Próxima ação** (label, aguarda, prazo)

**Financeiro · {label}** + **Abrir financeiro**

Toolbar: **Pendências**

### Painéis por fase (códigos de workflow)

| Código fase | Painéis |
|-------------|---------|
| captacao | next_action, chat, lead, tasks, timeline |
| comercial | + financeiro |
| consulta | next_action, agenda, chat, tasks, timeline |
| financeiro | next_action, financeiro, tasks, timeline |
| pos / tratamento / etc. | variações agenda/chat/financeiro |
| perdido | timeline, lead |
| default | next_action, chat, tasks, timeline |

**Ações next_action:** Confirmar consulta · Marcar realizada · Abrir conversa · Abrir agenda · Marcar pendência como feita

**Tasks:** checkboxes · **Timeline:** event_type, actor, data · **Chat / Agenda / Financeiro / Comercial:** atalhos WhatsApp, agenda, contas a receber, leads

### Fluxos / Dados / Integrações / UX

Confirmar/marcar consulta · abrir WhatsApp · completar task · ver timeline · abrir AR. Dados: journey_cases, tasks, timeline events, appointments, quotes. Integra WhatsApp, Agenda, Financeiro, Leads. UX: painéis dinâmicos por fase evitam UI única genérica.

---

## 10.5 Captação / Formulários `/crm/captacao`

### Visão Geral

Templates de formulário para captação e pré-consulta. Espelho conceitual de `/dashboard/formularios`.

### Conteúdo UI

Header **Novo formulário** · grid templates: nome, tipo consulta, badges Público + allowed_contexts, URL pública

**Ações card:** Abrir · Link · Encaminhar · Editar · Excluir

**Modal Link público:** URL + Copiar

**ConfirmDialog** excluir

**EncaminharModal** (pacientes)

Footer: **Ver pipeline de leads**

Rotas novo/editar: `/captacao/novo` e `/captacao/[id]/editar` — FormBuilder DnD (nome, procedimentos, público, médico).

---

## 10.6 Appointment pipeline client (componente reutilizável)

Não é rota CRM principal; usado onde se embute comparecimento.

**Filtros:** Buscar paciente · Todos os profissionais

**Kanban layout:** fluxo horizontal Agendada → Confirmada · seta · desfechos verticais Realizada / Falta / Cancelada

**Card:** paciente, data/hora, médico, badge status, **Abrir consulta**

**Lista:** select de status + Abrir consulta · DnD muda status

---

## 10.7 Mapa rápido de boards (colunas)

| Tela | Colunas |
|------|---------|
| Leads Kanban | Lead novo → Em qualificação → Qualificado → Oportunidade → Cliente → Perdido |
| Repescagem | Sugeridos → Ativos → Arquivados |
| Jornada Comparecimento / Appointment pipeline | Agendada → Confirmada → Realizada / Falta / Cancelada |
| Jornada Fluxo | Fases do workflow da clínica (dinâmicas) |
| Jornada Pendências / IA | Sem colunas — fila em grid |

---

# 11. Central de Eventos

## 11.1 Visão Geral

| Campo | Valor |
|--------|--------|
| **Rota** | `/dashboard/eventos` |
| **Roles** | admin/secretaria |
| **Objetivo** | Inbox de eventos do sistema (cadastro, consulta, formulário, no-show…) com ações recomendadas e envio multi-canal |
| **Arquivo** | `eventos-client.tsx` |
| **Limite lista** | 100 mais recentes |

## 11.2 Estrutura de Navegação

Item topo **Central de Eventos**. Links: jornada, agenda, cadastro paciente, remarcação.

## 11.3 Conteúdo de Cada Página

### Header

Título · **Configurar eventos** (se canManage) · banner plano sem mensageria

### Filtros

Filtrar por paciente (select) · Filtrar por evento (tipo)

### Abas

Todos · Pendentes · Concluídos (counts) · na Pendentes: **Concluir todos**

### Card de evento

Badge status: Pendente / Enviado / Concluído sem envio / Concluído / Ignorado / Falhou  
Categoria · nome · paciente · consulta · ocorreu em · **Ver jornada completa** · ícones canais

### Ações contextuais por `event_code`

| Código | UI |
|--------|-----|
| public_form_completed | Dados submitter + **Cadastrar** ou “Usuário cadastrado” |
| patient_form_completed | “Entrar em contato” |
| appointment_no_show | **Remarcar consulta** |
| appointment_completed | **Agendar retorno** |
| appointment_created | **Vincular formulário** ou “Formulário vinculado” |
| patient_registered | **Nova consulta** ou “Consulta agendada” |
| * + consulta hoje (created/confirmed/rescheduled) | **Realizada / Falta / Cancelada** (+ wizard cancelamento) |

Botões gerais: **Enviar** · **Concluir** · **Detalhes** (expansão canais)

### Modal Enviar mensagem

Evento · Ver preview · checkboxes Email / WhatsApp (com nome template) · Cancelar · Enviar

### Modal Preview

Assunto/corpo email HTML · bolha WhatsApp

### Modal Configurar eventos

Por categoria: Agendamento · Lembretes · Formulários · Pós-Consulta · Outros

Por evento: Switch **Sistema** · Email on/off + Envio Automático/Manual + Template · WhatsApp idem + checkbox “Enviar somente com ticket aberto”

## 11.4 Fluxos · Funcionalidades · Dados · Estados · Integrações · UX

**Fluxos:** filtrar → enviar / concluir / ação contextual · configurar automação · cadastrar de form público · remarcar / retorno / status do dia

**Funcionalidades:** multi-canal · preview · bulk concluir · config por tipo · ações contextuais ricas

**Dados:** eventos do sistema, templates, patients, appointments, plan messaging gates

**Estados:** empty · plano sem mensageria (alert) · limit 100 · status badges

**Integrações:** processEvent, concluir, registerPatientFromPublicForm, updateAppointment, AppointmentCancelWizard, jornada, agenda, mensagens/planos

**UX:** inbox operacional; ações contextuais reduzem “o que fazer com este evento?”; config concentrada em modal admin

---

# 12. Comunicação (WhatsApp e Mensagens)

## 12.0 Visão Geral do módulo Comunicação

| Campo | Valor |
|--------|--------|
| **Objetivo** | Canal WhatsApp operacional + mensageria template/e-mail |
| **Nav** | Conversas · Mensagens enviadas (admin) · Fila de envio · Templates (admin) · E-mail (admin) |
| **Gates** | Plano WhatsApp + integração Meta; templates/e-mail por plano |

---

## 12.1 Conversas `/dashboard/whatsapp`

### Visão Geral

Inbox estilo WhatsApp full-bleed. Arquivos: `whatsapp/page.tsx`, `whatsapp-chat-sidebar.tsx`, `whatsapp-contact-sidebar.tsx`, `ops/case-panel.tsx`.

### Estrutura de Navegação

Menu Comunicação → Conversas. Layout dashboard sem topbar padrão. Links: Workspace (CasePanel), Pacientes, Configurações (se não conectado), Planos (upsell).

### Conteúdo de Cada Página

#### Gate / estados de página

| Estado | UI |
|---|---|
| Sem plano WhatsApp | Ícone, título “Desbloqueie as Conversas…”, CTAs **Ver configurações** / **Ver planos com WhatsApp** |
| Sem integração Meta | “WhatsApp não conectado” → **Ir para Configurações** |
| OK | Layout full-height com `WhatsAppChatSidebar` |

#### Lista de conversas (sidebar esquerda)

**Seções:**

- Cabeçalho **Conversas** + botão **+** (`Nova conversa`)
- Filtros em grid 2 colunas
- Banner de **limite mensal pós-24h** (âmbar / vermelho se bloqueado)
- Explicação da janela Meta 24h
- Abas de status
- Lista scrollável

**Filtros:**

- **Fila:** Todos · Pendências · Com a IA · Aguardando paciente · Sistema (`needs_decision` / `ai` / `patient_waiting` / `system` / `all`)
- **Ordenar:** Mais recentes · Mais antigas · Pendentes por último (persistido em `localStorage`)
- **Abas status:** Na janela (24h) · Fora da janela (24h) · Concluídas (`open` / `closed` / `completed`)

**Item da lista:**

- Avatar (verde se paciente vinculado; amarelo se não)
- Nome (paciente > contact_name > telefone)
- Badge dono: `ops.ownerLabel` ou **IA** / **Humano** (vermelho se SLA estourado)
- Contador não lidas (verde WhatsApp, cap `99+`)
- Telefone secundário
- “Última do paciente: …” (agora / min / h / ontem / dias)

**Estados vazios:** sem conversas / fila filtrada vazia / skeleton 6 linhas

#### Painel do chat

**Header:**

- Voltar (mobile)
- Clique no contato abre sidebar de info
- Subtítulo: responsável (Bot/Headphones) + pendência ops
- Botões: **Workspace** (Briefcase) · **Info** · **Concluir** (Check, se não completed) · **Excluir** (Trash)

**Timeline:**

- Wallpaper estilo WhatsApp
- Skeleton ao abrir; vazio “Nenhuma mensagem ainda”
- Paginação para cima (“Role para cima…” / “Carregando…”)
- Separadores de data: Hoje / Ontem / data longa
- Bolhas inbound/outbound; mídia: image / audio / video / document / “(mídia)”
- Label de remetente outbound: Assistente / Sistema / Equipe / nome
- Hora `HH:mm`

**Composer:**

- Alertas: fora da janela 24h / conversa concluída → template
- Bloqueio se `!canCompose`: texto do condutor + **Assumir atendimento** + “Enviar observação…” (disabled, “Em breve”)
- Input “Digite uma mensagem…” / Enter envia
- Botão Send verde `#00a884`
- Estado empty: “Selecione uma conversa”

**Máquina de chat:** `idle` · `opening` · `ready` · `syncing` · `sending`

#### Modais / painéis laterais

| UI | Conteúdo |
|---|---|
| **Nova conversa** | Busca paciente, lista, campo mensagem, **Enviar** |
| **Excluir conversa** (ConfirmDialog) | Aviso destrutivo permanente |
| **Workspace** (CasePanel) | Ver abaixo |
| **Informações do contato** | Ver abaixo |

#### Sidebar contato

**Com conversa:**

- Atendente: IA / secretária / pool / responsáveis elegíveis
- Select **Encaminhar para…** (IA + secretárias) + **Encaminhar**
- **Memória da IA** → **Limpar contexto da IA** (+ ConfirmDialog)

**Paciente vinculado:** Nome, e-mail, telefone, nascimento, observações, custom fields, **Documentos** (download), **Ver em Pacientes**

**Sem paciente:** aviso + telefone + **Cadastrar paciente**

**Modal Novo paciente:** nome*, nascimento, e-mail, telefone BR, observações, custom fields (text/number/date/textarea/select), **Cadastrar** / **Cancelar**

#### Workspace (CasePanel)

- Badge dono + SLA
- **Próxima ação** (pendência + link contextual + Abrir Workspace)
- **Agenda** (stage, paciente, consulta, links agenda/atendimento)
- **Responsabilidade** (histórico ownership)
- **Notas operacionais** + Salvar
- **Brief atual**
- CTAs: Assumir · Devolver à IA (com brief) · Lembrar amanhã · Enviar observação (em breve)

### Fluxos do Usuário

Selecionar conversa → ler → responder (se janela/canCompose) · Assumir · Encaminhar · Concluir · Excluir · Nova conversa · Cadastrar paciente · Abrir Workspace · Limpar contexto IA · Fora 24h → template

### Funcionalidades

Inbox · handoff humano/IA · janela Meta 24h · mark-viewed · complete/delete · realtime · paginação scroll-up · ops case panel · limite pós-24h · unread badge no menu

### Dados Utilizados

APIs: conversations, messages, send, assign, complete, delete, link-patient, usage-limit, ops/notes, clear-context, claim/reactivate · Realtime Supabase `whatsapp_messages` · patients · journey/ops

### Estados Especiais

Gates plano/integração · empty list/chat · skeleton · fora 24h · completed · !canCompose · SLA vermelho · limite bloqueado · optimistic temps

### Integrações

Meta WhatsApp Cloud · Assistente IA · CRM Case/Ops · Pacientes · Templates (fora 24h)

### Observações de UX

Lista/chat split mobile; composer bloqueado por ops; forte acoplamento Meta 24h + templates; observações internas “Em breve”; avatar amarelo sinaliza contato sem paciente.

---

## 12.2 Mensagens enviadas `/dashboard/mensagens`

### Visão Geral

Log somente leitura dos envios Email/WhatsApp. Role **admin**. Arquivo: `mensagens-client.tsx`.

### Conteúdo UI

Título + Card **Registro de envios** (últimos 20)

**Linha do log:** ícone canal · paciente · badge Email/WhatsApp · data · type · assunto (email) · “Enviado por” (Sistema / Admin / Secretária / Profissional) · olho preview

**Botões:** **Ver tudo** · **Ver preview** · **Tentar novamente** (erro)

**Modais:**

1. **Histórico completo** (até 100)
2. **Mensagem real enviada** — metadados + preview email HTML ou bolha WhatsApp (+ template badge) / JSON metadata fallback

### Fluxos / Dados / UX

Abrir preview · ver histórico · retry erro. Dados: `getRecentMessageLog` / `getMessageLogById`. UX: só leitura; sem filtros na UI.

---

## 12.3 Fila de envio `/mensagens/pendentes`

### Visão Geral

Aprovação manual de mensagens pendentes. Admin/secretaria. Arquivo: `pendentes-client.tsx`.

### Conteúdo UI

**Empty:** “Nenhuma mensagem pendente…”

**Card por mensagem:**

- Badges: canal + evento (`Consulta Agendada`, remarcada, cancelada, lembretes 24h/48h, formulário, realizada, falta…)
- Paciente, consulta+tipo, criada em
- **Aprovar e Enviar** · **Rejeitar** · **Ver Preview** / **Ocultar**
- Preview expandido `processed_body`
- Confirms nativos do browser (`confirm`/`alert`)

### Fluxos / Dados / UX

Approve/reject → `router.refresh()`. UX: confirms nativos (inconsistente com ConfirmDialog do resto do app).

---

## 12.4 Templates `/mensagens/templates`

### Visão Geral

Hub de templates de mensagens. Admin. Gates de plano.

### Conteúdo UI — Hub

- Título + **Novo Template** (wizard) ou disabled + banner plano
- Cards link: **Salvos** · **Sistema** · **Modelos Meta**
- Embaixo: seção Meta aprovados (`mode="metaApproved"`)

### Templates salvos / sistema (`TemplatesListClient`)

**Salvos (cards):** canal, nome, event_code, assunto, snippet · **Visualizar** · **Editar** · **Desativar**

**Sistema:** event_name, canal, preview · **Visualizar** · **Usar e editar** (copia)

**Meta aprovados:**

- **Solicitar templates do sistema** · **Atualizar status**
- Lista status: Consulta, c/ formulário, Formulário, Aviso, Mensagem livre, Confirmação Flow  
  Badges: Approved / Rejected / DISABLED|PAUSED / PENDING
- Templates remotos Meta (nome, id, idioma, status)

### Wizard (`new-template-wizard-modal`)

Passos: base → conteúdo → revisão  
Campos: nome, evento, canal (email/whatsapp/ambos), assunto, editor visual/HTML + variáveis, modelo Meta WhatsApp + campo editável / corpo livre, preview WA  
Navegação: Voltar / Próximo / Salvar

### Meta models — `/mensagens/templates/meta`

Lista drafts + status local/Meta  
**Novo modelo Meta:** nome, idioma (pt_BR/en_US/es_ES), categoria UTILITY/MARKETING/AUTHENTICATION, header/body/footer, variáveis `{{n}}`, botão none/quick_reply/url/phone, preview  
Ações: **Enviar para Meta** · **Excluir**

### Subpáginas

`/templates/salvos`, `/sistema`, `/novo`, `/[id]/editar` — mesmos clients em modes diferentes. Legacy `/dashboard/templates*` → mensagens templates.

### Nota

`EventosConfigModal` existe em `mensagens/eventos-config-modal.tsx` mas **não está ligado** à UI de Mensagens (há cópia usada em `/dashboard/eventos`).

---

## 12.5 E-mail `/mensagens/email`

### Conteúdo UI

1. **Enviar email de teste** → `/api/integrations/email/test` (Gmail)
2. **Cabeçalho e rodapé** (`EmailBrandingCard`) — templates branding + cores modern + salvar

Depende Google Gmail conectado em Integrações.

---

# 13. Financeiro

## 13.1 Visão Geral do módulo

| Campo | Valor |
|--------|--------|
| **Objetivo** | Operar caixa e contas: cobrar, receber, pagar, extrato, competência, DRE |
| **Problema** | Separar lentes (caixa vs competência vs performance) e inbox do dia |
| **Acesso** | admin/secretaria; médico bloqueado |
| **Layout** | Alertas globais no topo de todas as subpáginas (`FinanceAlertsPanel`) |

### Alertas típicos

Atendimentos aguardando comanda · comandas +30d · contas hoje/amanhã · vencidas

### Navegação

Visão geral · Receber · Pagar · Extrato · Competência · Fluxo · Performance · DRE  
Redirects: `fluxo-diario` / `fluxo-mensal` → fluxo-caixa

### Entidades

`comandas`, `patient_payments`, `financial_entries`, `receipts`, `suppliers`, `bank_accounts`, `patient_credits`, `clinic_financial_settings`

---

## 13.2 Visão geral `/financeiro`

### Conteúdo UI

**Briefing “Hoje”:** saudação, counts cobrar/receber, entrou hoje, progress Cobranças e Recebidos

**Minha fila (3 colunas, max 12)**

| Coluna | CTAs | Ver todos |
|---|---|---|
| Cobrar | Emitir / Receber (+ badges Antecipado/No dia/Pós-consulta) | `/atendimento` |
| Receber | Receber + Abrir | `/receber` |
| Recebido | Recibo | `/extrato` |

**Indicadores (links):** Entrou hoje · Ainda falta receber · Contas vencidas · Contas a pagar

**Evolução:** tabs Faturamento / Fluxo · gráfico barras · aging AR se houver saldo

**Botão:** **Lançamento** → `FinancialEntryFormDialog`  
**Modal:** `ComandaPaymentDialog` a partir da fila

### Fluxos / Funcionalidades / Dados / Estados / UX

Operar inbox do dia → emitir/receber/abrir recibo · lançamento manual. Separação clara “hoje” vs relatórios. Empty quando filas vazias.

---

## 13.3 Contas a receber `/financeiro/receber`

### Conteúdo UI

**Pipeline (opcional):** StatCards Agendado/Previsto + funil caixa (Faturado→Recebido)

**Tabela comandas abertas**  
Colunas: Paciente · Consulta · Serviço · Total · Desconto · Pago · Saldo · Dias (risco >30/>60) · **Receber** · **Cancelar**

**Receitas manuais pendentes:** descrição, vencimento, dias · **Marcar como recebida**

**Modais:**

- Marcar recebida: data, método (PIX/Transferência/Dinheiro/Cartão/Outro), conta bancária*
- ComandaPaymentDialog: crédito paciente opcional, valor, data, forma, bandeira/parcelas se cartão, conta*
- CancelComanda: estorno (admin) / crédito / perda + motivo

### Fluxos / Integrações / UX

Receber → gera payment + recibo · cancelar comanda · marcar receita manual. Integra comandas do atendimento. UX: dias de risco destacam aging.

---

## 13.4 Contas a pagar `/financeiro/pagar`

### Conteúdo UI

**Toolbar:** **Nova despesa**

**Grupos:** Vencidas · Vence hoje/amanhã · Próximos 7 dias · Futuras (+ total)

**Colunas:** Fornecedor · Descrição (+ badge Recorrente) · Categoria · Valor · Vencimento · **Marcar como paga** · **Editar**

**Modais:** form lançamento (default despesa) · marcar paga (data/método/conta)

### FinancialEntryFormDialog (shared)

Tipo Receita/Despesa · descrição · valor · vencimento · fornecedor · categoria DRE · linhas estoque (produto/qtd/custo/lote) · recorrência (freq + fim: count/until/never)

### Integrações

Fornecedores · Contas bancárias · Estoque (entrada) · DRE categorias

---

## 13.5 Extrato `/financeiro/extrato`

### Conteúdo UI

**Filtros:** mês URL · Tipo Todos/Entradas/Saídas · Categoria DRE · Buscar · Exportar CSV

**KPIs:** Entradas · Saídas · Saldo

**Linhas:** avatar inicial, contraparte, origem, descrição, data/método/conta, valor ±, saldo, badge categoria, **Detalhes**, **Comprovante**, **Ver comanda**

### Funcionalidades

Ledger unificado (pagamentos + lançamentos) · saldo acumulado · CSV · links recibo/comprovante

---

## 13.6 Competência `/financeiro/competencia`

Funil competência (Agendado→Previsto→Faturado)  
StatCards: Receita faturada · Despesas · Lucro (margem + YoY)  
Gráficos: receita/despesas/lucro · origem receita  
Tabela: Mês · Receita · Despesas · Lucro · Margem

---

## 13.7 Fluxo de caixa `/financeiro/fluxo-caixa`

PeriodFilter range · Exportar CSV · badge contexto  
Tabs granularidade: Diário/Semanal/Mensal · Fluxo/Acumulado  
Gráfico entradas/saídas/líquido ou área acumulado  
Tabela: Data · Tipo · Origem · Detalhe · Descrição · Valor · Saldo

---

## 13.8 Performance `/financeiro/performance`

4 StatCards: Receita MoM % · No-show % (90d) · Tempo médio até receber · Receita do mês  
Empty se sem dados · nota “não mistura caixa com competência”

---

## 13.9 DRE `/financeiro/dre`

Filtro mês · **Configurar provisões** · Exportar CSV  
Lista linhas: Receita Bruta → Deduções → Líquida → CMV → Lucro Bruto → OpEx → EBITDA → Depreciação → PECLD → LAIR → IR/CSLL → Resultado Líquido  
Gráfico % sobre receita bruta  
Modal provisões: PECLD % AR · IR/CSLL % LAIR  
Disclaimer gerencial (não NF-e)

---

## 13.10 Recibo e comprovante

### Recibo `/financeiro/recibo/[id]`

ReceiptBody (clínica, paciente, itens, valores, voided)  
**Baixar PDF** / **Imprimir** / **Reenviar PDF** / abrir versão impressão  
`/imprimir` = layout print-only A4

### Comprovante despesa `/financeiro/comprovante-despesa/[id]`

Print interno: nº, data, fornecedor, descrição, categoria, pagamento, valor · “sem valor fiscal”

## 13.11 Observações de UX do Financeiro

Separação clara caixas vs competência vs DRE; fila operacional “hoje”; PDF recibo regenerável; `canManage` esconde ações de escrita; secretária/admin no nav.

---

# 14. Vendas

## 14.1 Visão Geral do módulo

| Campo | Valor |
|--------|--------|
| **Objetivo** | Analytics de faturamento (comandas emitidas) + orçamentos comerciais |
| **Diferença vs Financeiro** | Vendas = faturamento/comandas; Financeiro = caixa/AR/AP |
| **Acesso** | admin/secretaria; médico bloqueado |
| **Nav** | Visão geral · Relatório · Orçamentos |
| **Stubs** | `/vendas/pacotes` e `/vendas/notas-fiscais` → redirect visão geral |

---

## 14.2 Visão geral `/vendas`

### Conteúdo UI

**Toolbar:** PeriodFilter range · **Relatório detalhado** · badge “comandas emitidas”

**KPIs (5):** Receita faturada · Comandas emitidas · Ticket médio · Taxa de recebimento · Valor em aberto (+ trends vs período anterior)

**Gráficos:**

- Evolução receita (barras) + comandas (linha)
- Mix por status (pizza)
- Top procedimentos · Receita por profissional · Mix serviço/material/outros

### Fluxos / Dados / UX

Mudar período → refresh. Base: comandas emitidas. UX: deixa claro “não é caixa”.

---

## 14.3 Relatório `/vendas/relatorio`

### Conteúdo UI

**Filtros (dialog):** período · Paciente · Status multi (Aberta/Parcial/Paga) · Profissional · Aplicar / Limpar

**Charts:** Por procedimento · Por profissional · Top pacientes

**Tabela:** Data · Paciente · Profissional · Total · Pago · Saldo · Status (badge) · Tags · **Ver cobrança** → `/financeiro/receber`

---

## 14.4 Orçamentos — lista `/vendas/orcamentos`

### Conteúdo UI

**Ações:** **Config. IA** · **Novo orçamento**

**Colunas:** Nº · Destinatário · Total · Validade · Status · Criado em · **Abrir**

**Status:** Rascunho · Enviado · Aceito · Recusado · Expirado

**Empty:** CTA criar

---

## 14.5 Quote editor `/orcamentos/novo` e `/[id]`

### Conteúdo UI — Header actions por status

- Rascunho: Salvar · Marcar enviado · Excluir · Gerar PDF (se já salvo)
- Enviado: Aceito · Recusado · Gerar PDF (read-only campos)
- Outros: só PDF / visualização

### Seções

1. **Destinatário** — tabs Paciente (combobox) / Lead CRM / Avulso (nome/tel/email)
2. **Condições** — profissional, validade, desconto, totais (subtotal / materiais à parte / total)
3. **Itens** — selects catálogo Serviço / Material incluso / Material à parte; seções Serviços · Materiais · Outros; linha: descrição, qtd, unitário, total, trash; **Linha manual**
4. Observações + Condições comerciais (textarea, default terms)

### Fluxos

create → redirect id · update · status machine · PDF via HTML+print window · delete rascunho

---

## 14.6 Config. IA — `?tab=config`

- Validade padrão (dias) · condições padrão · **Salvar padrões globais**
- Regras por procedimento: Geral da clínica vs Por médico · salvar por linha

## 14.7 Observações de UX de Vendas

Pacotes não implementados; orçamentos separados de comandas; relatório aponta cobrança no Financeiro; Config IA no mesmo editor via tab query.

---

# 15. Serviços e Valores

## 15.1 Visão Geral

| Campo | Valor |
|--------|--------|
| **Objetivo** | Catálogo comercial: serviços, dimensões de preço, regras, procedimentos clínicos |
| **Acesso** | Admin; médico se pricing **descentralizado**. Procedimentos: admin only. Secretária: page-access tipicamente não |
| **Modo pricing** | `centralizado` (clínica define) \| `descentralizado` (médico vê/edita suas regras) — preferência do sistema |
| **Rotas** | `/servicos-valores` → redirect `/servicos` · `/servicos-valores/servicos` · `/servicos-valores/procedimentos` · alias `/configuracoes/procedimentos` |

## 15.2 Estrutura de Navegação

Grupo Serviços e Valores → Serviços e valores · Procedimentos (admin). Tab Planos embute planos de tratamento.

## 15.3 Serviços `/servicos-valores/servicos`

### Conteúdo — SegmentedTabs

**Serviços | Dimensões | Valores | Regras | Planos** (admin/secretaria no tab planos). `?tab=planos` abre planos.

#### Aba Serviços

**Novo serviço**; Nome*; Categoria; Cobrança em série: vazio | `per_session` | `treatment_plan`; Salvar / Cancelar; Editar / Excluir (+ ConfirmDialog).

**Tabela:** Nome, Categoria, Recorrência, Ações.

**Dados:** `services` (nome, categoria, recurrence_billing_mode).

#### Aba Dimensões

Nome da dimensão*; Ativo (Switch na edição); Nova dimensão; Editar/Excluir. Dados: `price_dimensions`.

#### Aba Valores por dimensão

Select dimensão ativa; Novo valor; Nome; Cor (color + hex); Ativo (edit); chips por dimensão. Dados: `dimension_values`.

#### Aba Regras de preço

Serviço*; Profissional (opcional; médico força self); Valor (R$)*; Dimensões (checkboxes por dimensão); Regra ativa (edit); Nova regra; Editar/Excluir.

**Tabela:** Serviço, Profissional (hidden se médico), Valor, Dimensões, Ativo.

**Dados:** `service_prices` + `price_rule_dimension_values`. Médico vê só regras dele.

#### Aba Planos

Ver seção 16 (mesmo client).

### Fluxos · Estados · Integrações · UX

CRUD com toast e ConfirmDialog. Empty states. Integra Agenda (preço/serviço), Vendas, Planos. UX: tabs concentradas; dimensões com cor alimentam coloração da Agenda.

---

## 15.4 Procedimentos `/servicos-valores/procedimentos`

### Visão Geral

Catálogo clínico + cobrança + BOM + profissionais + fichas. **Só admin**.

### Conteúdo UI — Formulário

Nome*; Descrição curta; Como realizamos; Preparo/recomendações; Recuperação; Serviço padrão (select); Duração padrão (min 5–480); Insumos BOM (produto + qtd + Remover/Plus); Fichas (toggle pills); Profissionais (toggle); Cancelar / Criar|Salvar.

### Lista

Nome, profissionais, snippet recomendações; Editar / Excluir (confirm).

### Dados / Integrações / UX

`procedures`, `doctor_procedures`, `procedure_products`, fichas clínicas, `services`, `products`.

Integra: Agenda (pré-fill preparo/recomendações), WhatsApp routing por médico, estoque BOM, comanda preços.

UX: recorrência do serviço espelhada em hint; empty state.

---

# 16. Planos de Tratamento

## 16.1 Visão Geral

| Campo | Valor |
|--------|--------|
| **Lista canônica** | Tab Planos em Serviços (`/servicos-valores/servicos?tab=planos`) |
| **Redirect** | `/planos-tratamento` → serviços `?tab=planos` |
| **Detalhe** | `/planos-tratamento/[id]` |
| **Objetivo** | Pacotes multi-sessão + geração de agenda + financeiro do plano |
| **Acesso** | admin/secretária; médico redirect |

## 16.2 Lista embutida — `PlanosTratamentoClient`

### Conteúdo UI

**Lista planos:** Nome, paciente, sessões used/total, recebido/total, status badge, valor, por sessão; **Ver plano**; **Gerar sessões na agenda**.

**Gerar sessões:** Frequência Semanal / Quinzenal / Mensal / Manual; Primeira sessão (date); Horário; Profissional*; Preview datas; Manual: textarea ISO por linha; Cancelar / Confirmar.

**Novo plano:** PatientCombobox*; Serviço (só `treatment_plan`); Procedimento; Nome*; Valor total; Sessões; Política: antecipado / parcelado / por_sessao; **Criar plano**.

### Fluxos / Dados / Estados

`createTreatmentPlan`; preço default × sessões; `generatePlanAppointments` (duração 30 min). Dados: `treatment_plans`, appointments vinculados. Empty; saving/scheduling; toast conflitos não bloqueiam.

---

## 16.3 Detalhe `/planos-tratamento/[id]`

### Conteúdo UI

Badges status/política/Quitado; link paciente; Valor total, Recebido, Saldo, Por sessão; progresso sessões.

**Pagamento** (não `por_sessao`, saldo > 0): Valor; Forma PIX / Dinheiro / Cartão crédito / débito; Conta bancária; **Registrar pagamento**.

**Tabela sessões:** Sessão, Data, Status, Comanda, Rateio; se por_sessao: Paga / Saldo a recolher.

### Dados / UX

`treatment_plans`, `appointments`, `comandas`, `bank_accounts`. Sem editar/excluir na UI de detalhe.

---

# 17. Estoque

## 17.1 Visão Geral

| Campo | Valor |
|--------|--------|
| **Objetivo** | Produtos, saldos, lotes, consumo previsto vs real, entrada via despesa |
| **Acesso** | admin/secretária; médico bloqueado |
| **Layout** | Sidebar de categorias; seed default se vazio |
| **Integrações** | BOM procedimento → consumo no atendimento · Despesa financeira → entrada · Comanda materiais |

## 17.2 Layout + sidebar `/dashboard/estoque/*`

Sidebar: lista **Categorias** → `/estoque/c/{slug}` (contador). Admin: **Adicionar categoria** (dialog Nome* · **Criar categoria**). Páginas irmãs: `/lotes`, `/campos-produto`, overview `/estoque`.

---

## 17.3 Visão geral `/estoque`

### Conteúdo UI

Título “Visão geral do estoque”.  
Cards categoria: nome, N produtos, badge **Baixo estoque** / **Sem alertas**.  
StatCards: Valor em estoque; Estoque baixo; Vencendo em 30d; Movimentações (mês).  
Gráficos: Comprometido real vs predito (taxa no-show 90d); Top 10 consumo; Entradas vs saídas (6 meses).

Somente leitura (SSR metrics). Erro de métricas em texto vermelho.

---

## 17.4 Categoria `/estoque/c/[slug]`

### Conteúdo UI — lista

Colunas: foto, Produto (+SKU), Fornecedor, Em estoque, Comprometido, Custo, Controles (badges Lote/Validade), **+1** / **−1**.

### Novo produto (admin)

Nome*; SKU; Unidade; Custo (R$)*; Preço venda; Fornecedor (select / Nenhum); Qtd inicial; Estoque mínimo; **Imagem** (upload/URL); ☑ Controlar lote; ☑ Controlar validade; Código do lote (se lote); Validade date (se validade); **Cadastrar**.

**ProductImageUpload:** Drag-drop; Selecionar arquivo (JPG/PNG/WebP, ≤5 MB); Usar URL; Trocar; Remover.

### Fluxos / Dados / Estados

Criar → `createProduct`. Ajuste → `adjustStock` (“Entrada/Saída manual”). Dados: `products`, `stock_balances`, `suppliers`, storage `product-images`. EmptyState; form toggle; loading; non-admin sem botão novo. Optimistic qty no ±1.

---

## 17.5 Lotes `/estoque/lotes`

Breadcrumbs: Estoque → Lotes e validade.  
Lista: produto, Lote X, qtd, Val.  
**Cadastrar lote:** ID do produto (UUID)*; Código do lote*; Validade; Quantidade; **Salvar lote**.

**UX gap:** UUID digitado manualmente (sem picker) — fricção alta.

---

## 17.6 Campos de produto `/estoque/campos-produto`

Admin only. Lista: label (slug), field_type.  
**Novo campo:** Slug; Rótulo; Tipo (Texto/Número/Data/Sim-Não); ☑ Obrigatório ao cadastrar lote; **Salvar campo**.

Sem edição inline / delete na UI atual.

### Nota

`estoque-client.tsx` (tabela legada) potencialmente órfão do overview atual.

---

# 18. Configurações

## 18.1 Visão Geral

| Campo | Valor |
|--------|--------|
| **Acesso** | Admin (exceto DSAR também secretaria em Privacidade) |
| **Objetivo** | Configurar clínica, integrações, pricing, site, privacidade, VA |
| **Alias** | `/preferencias` → preferências do sistema |

---

## 18.2 Preferências do sistema `/configuracoes` ou `/preferencias`

### Seções e campos

1. **Modo serviços e valores** — Select: Centralizado | Descentralizado; Salvar.
2. **Taxa de falta (no-show)** — Modo: Desativada | Valor fixo | % do serviço | Serviço UUID; Valor / Percentual / ID serviço; Salvar. (**Gap:** modo serviço pede UUID sem combobox.)
3. **Relatórios: metas** — Meta confirmação %; comparecimento %; no-show %; ocupação %; retorno %; Janela retorno (dias); Início/Fim horário útil (0–23); Salvar.
4. **WhatsApp: custo e janela** — Limite mensal pós-24h; Início/Fim envio auto (time); Fuso (SP/Noronha/Manaus/Cuiabá/Rio Branco); Salvar. Disabled se plano sem WhatsApp.
5. **Compliance** tabs Confirmação | Formulário — Dias antes (0–30 ou vazio = off); Salvar; resumo config atual.

Integrações: gates de plano WhatsApp; limpa query `?integration=whatsapp`.

---

## 18.3 Clínica `/configuracoes/clinica`

### Tabs e campos

| Aba | Campos |
|-----|--------|
| Informações | Nome*; Início/Fim expediente agenda (time); Consultórios simultâneos (2–20 ou vazio) |
| Institucional | Segmento; Descrição curta; Missão; Visão; Valores |
| Localização | Endereço; Google Maps; Estacionamento; Acessibilidade; Pontos de referência; ☑ Mais de uma unidade (+ CRUD locais VA) |
| Horários | Por dia: abre/fecha/almoço; Política de feriados |
| Contato | Telefone; E-mail; Site; WhatsApp link; Instagram; Facebook |
| Logo | LogoUpload (gated por plano custom logo); escala |

Cada aba: **Salvar** → `updateClinicProfile` (+ locations VA).

Dados: `clinics`, `clinic_virtual_assistant_settings`, `clinic_public_site_settings`, `clinic_virtual_assistant_locations`.

---

## 18.4 Salas `/configuracoes/salas`

Nova sala: Nome; **Adicionar**. Lista: badge Ativa/Inativa; Desativar/Ativar.  
**Efeito:** salas ativas → agenda exige consultório e conflito por sala; **também bloqueia** autoagendamento público (`has_active_rooms`).

---

## 18.5 Agendamento `/configuracoes/agendamento`

Redirect → Assistente Virtual. Cliente legado `AgendamentoPolicyClient` ainda existe (radios Ignorar/Opcional/Obrigatório por goal).

---

## 18.6 Site `/configuracoes/site`

**Publicação:** ☑ Publicar site; Abrir site; Copiar link (subdomínio e/ou `/c/{slug}`).

**Autoagendamento:** ☑ Permitir (só se site on); badge prontidão; aviso se salas ativas.

**Conteúdo:** ☑ Equipe; ☑ Serviços/procedimentos; ☑ FAQ; Headline; Subheadline; Título hero; Subtítulo hero; HeroImageUpload; ☑ Formulário contato; Cor primária hex; Preview; Salvar.

**Prontidão:** Stats procedures, without service, services, without price, doctors, links, dimensions empty.

---

## 18.7 Integrações `/configuracoes/integracoes`

**Email (Google):** Conectar / Desconectar; status connected/pending/error; gated por plano.

**WhatsApp (Meta):** Embedded signup FB SDK; Conectar/Desconectar; Phone Number ID; Register PIN; assets WABA/phone; billing Meta; WhatsApp Routing section se conectado.

**WhatsApp Simples:** Legado (UI parcialmente oculta): connect, phone id, discover, register.

**Query:** `?status=connected&integration=…` → toast e limpa URL.

Roteamento WhatsApp típico: first_responder / general_secretary / round_robin / chatbot.

---

## 18.8 Contas bancárias `/configuracoes/contas-bancarias`

**Contas:** Nova/Editar dialog: Nome*; Banco; Agência; Conta; ☑ Padrão; Cancelar/Salvar. Cards: Editar, Desativar, Definir padrão. Inativas listadas.

**Taxas MDR:** Bandeira Visa/MC/Elo/Amex; Parcelas; Taxa %; Adicionar; Remover regra.

---

## 18.9 Assinatura `/configuracoes/assinatura`

Reexporta `/dashboard/plano` (Stripe: checkout, CPF/CNPJ, endereço CEP, invoices, cancel/resume, troca plano, consent).

---

## 18.10 Base de conhecimento `/configuracoes/base-de-conhecimento`

FAQ: Pergunta*; Resposta*; Keywords; Categoria; CRUD dialog; FaqSections display. Fonte da verdade do assistente.

---

## 18.11 Campos personalizados / Catálogo clínico

`/catalogo-clinico` → mesma page que `/campos-personalizados`.  
Tabs: Campos de paciente | Fichas | Formulários (link CRM) — ver §9.4.

---

## 18.12 Privacidade `/configuracoes/privacidade`

Admin: EmailVerificationCard; MFA; DpaAcceptCard; docs DPA/política/subprocessadores.  
Admin+secretária: **DSAR** — Tipo; Nome titular; E-mail; Observações; criar; status open→in_progress→completed/rejected; overdue badge; portal `/privacidade-titular`.

`/seguranca` → `/privacidade#mfa`. MFA: Iniciar; QR; Código verificação; Limpar fator stale; estado enrolled.

---

## 18.13 Matriz rápida de acesso Config

| Área | Admin | Secretária | Médico |
|------|-------|------------|--------|
| Preferências / Clínica / Site / Integrações / Salas / Contas / VA / KB | Sim | — | — |
| Privacidade DSAR | Sim | Sim | — |
| Equipe / Plano | Sim | — | Perfil médico |

---

# 19. Assistente Virtual (IA)

## 19.1 Visão Geral

| Campo | Valor |
|--------|--------|
| **Rota** | `/dashboard/configuracoes/assistente-virtual` |
| **Objetivo** | Governança da IA no WhatsApp: o que pode consultar e quais ações executar |
| **Banner plano** | Sem WhatsApp no plano: políticas editáveis, IA off no canal |

## 19.2 Estrutura de Navegação

Configurações → Assistente virtual. Também destino do redirect de Agendamento.

## 19.3 Conteúdo de Cada Página — Tabs

**Políticas | Fluxos | Avançado** (Pipeline | Ferramentas | Diagnóstico)

### Políticas → Geral

☑ Ativar no WhatsApp; Nome da IA; Tom informal/formal; ☑ Emojis; ☑ Transferir humano; Tempo médio espera; Início/Fim bot; Debounce s (2–30); Coming soon: dias/fuso.

### Políticas → Atendimento

Accordions: Agendamento / Check-in / Cancelamento / Remarcação (+ Pós-consulta em breve).

**Agendamento:** ☑ Agendar/Remarcar/Cancelar; Modo Livre/Assistido/Estrito; goals Ignorar/Opcional/Obrigatório: Nome, CPF, E-mail, Responsável, Médico, Procedimento, Horário, Motivo cancelamento.

**Check-in:** ☑ Permitir; Abrir (h antes); Encerrar (min após); Quando indisponível (2 radios); Após check-in (confirmar paciente; avisar recepção disabled).

### Políticas → Conhecimento

Fontes Clinic/Procedures/Services/KB: ☑ Habilitado + field checkboxes + link Editar.

Clinic fields: endereço, horário, estacionamento, acessibilidade, unidades, telefones, redes, convênios, promoções, pagamentos.  
Proc: listar, desc curta, como, preparo, duração, recuperação, insumos.  
Svc: listar, diferenças, preços, dimensões.

### Políticas → Ações Financeiras

☑ Gerar / Enviar / Calcular orçamento.

### Fluxos

Workflows (ex. consulta): modo; enabled; fases/goals reorder preview; Salvar. Cancelamento / Exame/Teleconsulta (em breve).

### Avançado

Pipeline tool modes; playground de tools (entity pickers, presets, debugger); diagnósticos.

## 19.4 Fluxos · Dados · Integrações · UX

Salvar políticas → afetam handler WhatsApp. Dados: clinic_virtual_assistant_settings, workflows, KB. Integra WhatsApp handler · Base de conhecimento · Políticas de agendamento · Tools (buscar paciente, slots, cancelar, etc.) · Ops/CRM. UX: ACL granular de conhecimento; modos Livre/Assistido/Estrito; playground para debug.

---

# 20. Formulários

## 20.1 Visão Geral

Rotas `/dashboard/formularios` (+ novo/editar) e espelho CRM Captação (`/crm/captacao`). Nav Contatos/CRM aponta Captação; rota formularios ainda existe.

## 20.2 Lista

Novo · badges Público · gerar link · Encaminhar (paciente + consulta → instance link) · Editar · Excluir

## 20.3 Editor

Nome · procedimentos (auto-associação na agenda) · público + médico · FormBuilder DnD

## 20.4 Público

URLs `/f/...` e `/f/public/{clinic}/{form}` — ver §26

## 20.5 Fluxos / Integrações / UX

Criar template → publicar → link público ou encaminhar → instance → Eventos/Leads. Integra Agenda (vínculo), Eventos, Contatos não cadastrados, CRM.

---

# 21. Perfil, Equipe, Plano, Onboarding

## 21.1 Perfil médico `/perfil`

### Conteúdo UI

Link divulgação + mensagem WhatsApp + QR; Minha Logo (doctor); Preferências atraso (h/min → late_threshold_minutes); Cores na agenda por dimensão; DoctorProfessionalCard; templates/catálogo clínico docs (medicamentos/exames/atestados).

### Navegação

Menu utilitário médico: **Meu Perfil**. Também acessível via Contatos → Profissionais → self.

---

## 21.2 Equipe `/equipe` (admin)

### Conteúdo UI

Convidar: E-mail*; Papel Profissional|Secretário(a); Gerar link; Copiar; Cancelar convite (link ~7 dias).  
Lista membros + Remover (`deactivate_profile`).  
Bloco Secretárias↔Médicos (`SecretariasMedicosClient`).  
Roteamento WhatsApp (first_responder / general_secretary / round_robin / chatbot) — também em Contatos profissionais / Integrações.

`/secretarias-medicos` → redirect equipe. Nav Contatos profissionais (admin) pode montar EquipeClient.

---

## 21.3 Plano `/plano` (= Assinatura)

Status assinatura Stripe; upgrade plans; Payment Element; CPF/CNPJ; endereço (CEP); consent; faturas; cancelar fim período / retomar; stats mensagens 30d.

---

## 21.4 Onboarding

1. `/onboarding` — Nome clínica*; Telefone; Email; Nome completo; ☑ DPA; criar clínica (RPC) → `/onboarding/mfa`. Se já tem clinic_id → dashboard.
2. `/onboarding/mfa` — wizard MFA opcional/obrigatório conforme policy.

---

# 22. Auditoria e Privacidade (LGPD)

## 22.1 Auditoria `/auditoria`

Filtros: Usuário; De; Até; Aplicar.  
Log: ação (consulta/paciente/formulário), entidade, ator, resumo, timestamp, old/new values. Até 100 logs. Gate: plano `audit_log_enabled`.

## 22.2 DSAR

Config privacidade + `/privacidade/solicitacoes` · criar solicitação · status · export JSON · eliminação/anonimização · portal público `/privacidade-titular`.

---

# 23. Instruções

## 23.1 Hub `/instrucoes`

Cards de lições (`INSTRUCTION_MODULES`); disponível: jornada CRM (`/instrucoes/jornada-crm`); outros (Agenda/Financeiro/Mensagens) “Em breve”. Layout full-bleed sem max-width.

## 23.2 Lição `/instrucoes/jornada-crm`

Seções narrativas, funil lifecycle, score/temperatura, deep links no app. CTA do SetupChecklist admin aponta aqui.

---

# 24. Admin System

## 24.1 Visão Geral

| Campo | Valor |
|--------|--------|
| **Guard** | `requireSystemAdmin` |
| **Base** | `/admin/system` |
| **Objetivo** | Operar clínicas e planos da plataforma (não da clínica) |

## 24.2 Hub `/admin/system`

H1 “Admin do Sistema”  
KPIs: Total clínicas, Starter, Pro, Planos ativos  
Ações: Gerenciar Planos | Ver Clínicas  
Lista planos (nome, slug, badge Ativo/Inativo, Editar)  
**Troca rápida de plano** (sem Stripe): por clínica select plano + status (active/past_due/canceled/unpaid) + Salvar → `PUT /api/admin/clinics/:id`

## 24.3 Planos `/admin/system/planos`

Lista completa com limites (médicos, secretários, consultas/mês, storage GB, formulários, WhatsApp/E-mail/Logo badges, Stripe price). CTA Novo Plano. Empty state.

### Form novo/editar (`PlanoForm`)

- Básicas: nome, slug (imutável na edição), descrição, ativo
- Limites numéricos (vazio = ilimitado): médicos, secretários, consultas/mês, pacientes, templates, custom fields, storage GB
- Features boolean: WhatsApp, e-mail, logo, suporte prioridade, relatórios (básico/avançado/gerencial), produtividade, indicadores, audit log
- Pricing page: price_display, features (1 por linha), sort_order, show_on_pricing, highlighted, cta_text/href
- Stripe price_id (`price_…`)
- POST/PUT `/api/admin/plans`

## 24.4 Clínicas `/admin/system/clinicas` e `/[id]`

Cards: nome, badges Pro/Starter, slug, data, plano, status assinatura, Stripe IDs, limites custom → Editar.

Form detalhe: plano, status assinatura (aviso Pro active), limites custom médicos/secretários; card read-only cobrança (CPF/CNPJ, endereço, Stripe + link dashboard).

---

# 25. Site Público e Agendamento Online

## 25.1 Visão Geral

| Campo | Valor |
|--------|--------|
| **Rotas** | `/c/[slug]` · `/c/[slug]/agendar` · ou subdomínio `{slug}.{apex}` |
| **Objetivo** | Presença pública da clínica + autoagendamento |
| **Config** | `/dashboard/configuracoes/site` |
| **Middleware** | Subdomínio rewrite; apex redirect canônico; slugs reservados (`www`, `app`, `api`, `admin`, `dashboard`, etc.) |

---

## 25.2 Site `/c/[slug]`

### Visão Geral

Landing premium da clínica (MedicalClinic JSON-LD, SEO, tema por cor primária). Renderiza seções condicionais. Slugs reservados → 404.

### Estrutura de Navegação

**Header fixo** (transparente → blur ao scroll): logo/nome → `#inicio`; Início, Sobre, Especialidades*, Corpo Clínico*, Contato; CTA agendar (se booking pronto); menu mobile.

**Barra inferior mobile:** WhatsApp + CTA agendar.

**Footer escuro:** logo, tagline, Instagram/Facebook, links âncora + Política/Termos FlowMed, telefone/e-mail/endereço, © clínica, “Tecnologia Flowmedi”.

\*Somente se flags e dados existirem.

### Conteúdo completo (ordem)

| Seção | Conteúdo |
|--------|----------|
| **Hero `#inicio`** | Eyebrow por segmento; H1; subtítulo; CTAs Agendar + WhatsApp; imagem hero; overlay “Bem-vindo à {clínica}” com logo |
| **Pilares** | 4 cards fixos: humanizado, segurança, equipe, horários flexíveis; linha opcional `active_promotions` |
| **Sobre `#sobre`** | “Conheça a {nome}”; história; Missão/Visão/Valores; 4 diferenciais genéricos |
| **Especialidades `#especialidades`** | Cards de procedimentos (nome, desc truncada, duração, CTA Agendar/WhatsApp/#contato) |
| **Equipe `#equipe`** | Foto/inicial, nome, especialidade, CRM/UF, bio truncada |
| **FAQ `#faq`** | Accordion (1º aberto) |
| **Contato `#contato`** | Form (se ligado) + infos + horários (hoje destacado) + mapa embed/link |
| **CTA band** | “Agende sua consulta…” + Agendar / WhatsApp |

**Copy por segmento:** clínica / restaurante / loja / outro (ex.: “Agendar consulta” vs “Reservar”).

### Fluxos do Usuário

1. Scroll âncoras / menu mobile  
2. Agendar → `/c/[slug]/agendar` (± `?procedure=`)  
3. WhatsApp externo  
4. Contato: Nome* + E-mail* + Tel + Msg + checkbox privacidade → POST `/api/public/contact/{slug}` → sucesso ou “Enviar outra”  
5. Clique serviço → booking pré-selecionado

### Funcionalidades

Tema CSS; booking readiness; reveal on scroll; logo scale; SEO/OG/Twitter; robots index.

### Dados Utilizados

nome, slug, logo, cores, hero, missão/visão/valores, descrição, telefone, e-mail, endereço, WhatsApp, redes, maps, horários, procedimentos, médicos, FAQ, flags (`show_*`, `self_service_booking`), promoções, `segment`, `has_active_rooms`.

### Estados Especiais

404; seções omitidas; booking indisponível (sem CTA/rota); form sucesso/erro/loading; header scrolled; menu aberto.

### Integrações

Supabase load site; API contact; WhatsApp; Google Maps iframe; Schema.org.

### Observações de UX

Mobile-first + sticky CTAs; trust genérico vs conteúdo custom; formulário exige aceite privacidade; mapa só se URL válida.

---

## 25.3 Agendamento `/c/[slug]/agendar`

### Visão Geral

Wizard multi-step de autoagendamento. 404 se slug inválido ou booking não ready (flag off, salas ativas, sem procedimentos/médicos).

### Estrutura de Navegação

PremiumHeader + PremiumFooter; “Voltar” ao site; sem mobile bar da home.

### Conteúdo — Passos do wizard

Eyebrow “Agendamento online”; H1 = CTA do segmento; subtítulo = nome clínica; wizard max-w-xl; barra de progresso 5 segmentos; erros em banner vermelho.

1. **Procedimento** — lista nome + duração min  
2. **Profissional** — nome + especialidade; filtro por `doctor_ids`  
3. **Horário** — calendário 30 dias; manhã/tarde; slots livres/ocupados  
4. **Paciente** — Nome*, Tel/WhatsApp*, E-mail opcional  
5. **Confirmar** — resumo + “Confirmar agendamento”  
6. **Done** — check, mensagem, “Voltar ao site”

### Fluxos

`GET catalog` → seleção → `GET slots` (dias) → dia → `GET slots?date=` → dados → `POST appointments` → sucesso.

Deep link: `?procedure=` salta para profissional.

### Funcionalidades / Dados / Estados / Integrações / UX

Pré-seleção; filtros cruzados; janela 30 dias; slots past/booked/lunch; loading/submitting.  
Catálogo: doctors, procedures; slot ISO + label; patient; `appointmentId` retorno.  
Loading spinner; lista vazia de dias; dia sem horário; submit disabled sem nome/tel; submitting; erro API; done.  
APIs: `/api/public/booking/{slug}/catalog|slots|appointments`.  
UX: um passo por tela; confirmação antes do POST; sem login; confirmação “pelos canais da clínica”.

### Mapa de prontidão / gating

| Condição | Efeito na UI |
|----------|----------------|
| `self_service_booking_enabled` false | Sem CTAs/rota agendar |
| `has_active_rooms` | Booking bloqueado |
| Sem procedures/doctors | Booking bloqueado |
| `show_services/team/faq/contact_form` | Seções omitidas |

---

# 26. Formulários Públicos

## 26.1 Visão Geral

| Padrão | Uso |
|--------|-----|
| `/f/[token]` (+ segmentos) | Instance link (paciente/consulta); expirado; logos clínica/médico; submit RPC |
| `/f/public/[slug]` (+ formSlug) | Template público em branco (+ custom fields) |
| `/edit/[token]` | Edição de sugestão do site (não clínico) |

---

## 26.2 Instância por token — `/f/[token]`

### Visão Geral

Formulário de instância enviado ao paciente (pré-consulta). Anônimo via RPC. Fundo muted; logo clínica no topo. Sem header FlowMed.

### Conteúdo

- **Expirado:** “Link expirado” + peça novo link  
- **Ativo:** Card com título template; saudação “Olá {primeiroNome}…” ou genérica; bloco read-only Nome/Idade/E-mail/Tel; campos dinâmicos; Enviar; logo médico rodapé  
- **Já respondido:** read-only + “Você já respondeu…”

**Tipos de campo:** short/long text, number (min/max), date, yes/no, single/multiple choice.

### Fluxos / Dados / Estados / Integrações / UX

Load `get_form_by_token` → preencher → `submit_form_by_token` → “enviado com sucesso”.  
definition, responses, patient_*, status, logos, expires.  
404; expired; pendente/editável; respondido; loading; error RPC; success.  
Supabase RPC (SECURITY DEFINER).  
Mobile-friendly max-w-xl; dados do paciente não editáveis; sem checkbox LGPD nesta variante (só na pública).

---

## 26.3 Template público — `/f/public/[slug]` e `/f/public/[clinicSlug]/[formSlug]`

### Visão Geral

Formulário aberto (captação/pré-cadastro). Dois passos: dados básicos → campos do template. Slug UUID = template_id legado; senão slug ou token antigo.

### Conteúdo — Passo 1 (básico)

Título; Nome*, Email*, Tel (máscara BR), Nascimento; campos custom (`include_in_public_form`); checkbox LGPD Art. 11*; Continuar.

### Conteúdo — Passo 2

Campos do template + reconfirmação aviso saúde + Enviar.

### Sucesso

“Obrigado! Entraremos em contato…” + logo médico.

### Fluxos / Dados / Estados / UX

`POST /api/public/form/submit` com notice accepted; rate limit 429.  
submitter_*, responses, custom_fields, template_id, doctor_name/logo.  
basic|form; success; error; 429; botão disabled sem checkbox.  
Dois passos; consentimento saúde obrigatório; telefone formatado BR. Alimenta Não Cadastrados / Eventos / Leads.

---

# 27. Marketing, Legal e Auth

## 27.0 Shell compartilhado (marketing / legal / sugestões)

**Header público (`PublicHeader`):** Logo FlowMed → `/`; Nav desktop: Recursos, Preços, Segurança, Sugestões; CTAs: Entrar, Começar grátis; Mobile: menu hamburger; Variante `minimal`: só logo (usada em `/edit/[token]`).

**Footer público:** Colunas Produto | Recursos | Legal | marca + tagline; Legal: Privacidade, Termos, Exclusão, Direitos do titular, Encarregado, DPA, Cookies, Subprocessadores; Copyright + `privacidade@flowmed.app`.

---

## 27.1 Marketing

### `/` — Home

Landing completa: hero interativo (showcase 3D Desktop: Dashboard/CRM/Chat IA/Reports com parallax; mobile carrossel) + Trust bar (100% nuvem, LGPD nativo, Sem fidelidade, Feito para o Brasil) + Feature explorer (8 features: Agenda, Formulários, Comunicação, Site, Agendamento online, Papéis, Relatórios, Privacidade) + Module spotlights (Chat IA/WhatsApp; Site+agendamento; LGPD) + Personas (Admin / Secretário(a) / Profissional) + Depoimentos (carrossel 3) + Segurança (4 cards) + Integrações (WhatsApp, E-mail, Stripe) + CTA band “Pronto para simplificar…” → criar conta.

### `/recursos`

Hero “Mais de um sistema…”, grid das 8 features, link “Crie sua conta gratuita”, CtaBand.

### `/precos`

Hero planos; TrustStats compact; **cards dinâmicos** de `/api/plans/pricing` (nome, preço, desc, até 10 features, badge “Mais popular”, CTA); trust “Sem fidelidade / Cancele”; nota WhatsApp Meta; PricingFaq (5 Qs); CtaBand primary. Skeleton 4 cards; zero planos → empty + Criar conta.

### `/contato`

Hero “Fale com a gente”; 2 cards: E-mail geral + Encarregado (mailto + link `/encarregado-dados`); FAQ accordion (suporte, LGPD, trial). Sem formulário de contato.

### `/sugestoes`

Hero “Sugestões & Melhorias”; layout 2 colunas: **Nova sugestão** (textarea + contador + cooldown spam + Enviar) · **Feed** (data/hora, texto, ações do autor via localStorage token: editar 5 min countdown, excluir confirm, copiar link secreto). APIs: GET/POST `/api/public-suggestions`; PATCH/DELETE por id ou `/edit/[token]`.

### `/edit/[token]`

Header minimal + footer; carregar sugestão; countdown edição; Salvar / Excluir; inválido → ir a Sugestões.

### `/seguranca`

Hero; 4 highlights (nuvem, proteção, docs, direitos); SecurityTrustSection; card docs (Privacidade, Titular, Subprocessadores) + e-mail DPO; CtaBand LGPD.

---

## 27.2 Legal

Shell típico: Header + eyebrow Legal + H1 + data + card conteúdo + Footer.

| Rota | Função UI | Interação |
|------|-----------|-----------|
| `/politica-de-privacidade` | Política longa (papéis LGPD, inventário, cookies, direitos…) | Só leitura + links internos |
| `/termos-de-servico` | 12 seções (aceitação, serviço, conta, uso, dados, pagamento, IP…) | Leitura |
| `/politica-de-cookies` | Cookies essenciais; sem analytics | Leitura |
| `/acordo-tratamento-dados` | DPA modelo art. 39 | Leitura |
| `/subprocessadores` | Lista subprocessadores / transferências (Supabase, Vercel, Stripe, Meta, Google, OpenAI, ViaProve) | Leitura |
| `/encarregado-dados` | Identificação DPO art. 41 | mailto |
| `/exclusao-de-dados` | Como pedir exclusão + Meta/WhatsApp | Links |
| `/privacidade-titular` | Portal DSAR + form | Ver abaixo |

### Portal titular — formulário

Campos: slug clínica*, tipo (acesso/correção/eliminação/portabilidade/oposição/outro), nome*, e-mail*, tel, notas → `POST /api/public/dsar/submit` → sucesso com prazo estimado.

---

## 27.3 Auth

### Shell Auth (`AuthShell`) — Entrar, Criar, Redefinir, Recuperar

Split: painel esquerdo (logo, tagline, chips Agenda/Formulários/Comunicação/Privacidade, canvas animado) | formulário. Mobile: logo topo. `Esqueci-senha` usa `AuthLayout` mais simples.

### `/entrar`

Título “Bem-vindo de volta”; Google OAuth; divisor “ou”; E-mail*; Senha* (mostrar/ocultar); Entrar; Esqueci senha; link Criar conta.  
**MFA step:** código 6 dígitos TOTP → Verificar; Voltar senha.  
Query: `redirect`, erros oauth/recovery, `code` → callback.  
Pós-login: `resolvePostAuthRedirect` → dashboard/onboarding/admin/MFA wizard.

### `/criar-conta`

Google “Criar conta com Google”; Nome; E-mail*; Senha* + hint política; Confirmar*; checkbox Termos + Privacidade + menção DPA*; Criar.  
Estado: “Confirme seu e-mail” se sem sessão. Prefill `?email=` + `?redirect=`.

### `/esqueci-senha`

E-mail → Enviar link (redirect callback → redefinir); sucesso mensagem; alerta link inválido; Voltar entrar.

### `/auth/recuperar`

Valida `token_hash` OTP recovery → Continuar para nova senha; link inválido / solicitar novo.

### `/redefinir-senha`

Requer sessão; Nova senha + Confirmar + hint; Salvar → dashboard; sem user → esqueci?error=link_invalido.

### `/convite/[token]`

Estados:

1. Inválido/expirado  
2. Logado ativo → auto `accept_invite` → dashboard (retry se erro)  
3. Sem login + e-mail já tem conta → Entrar com redirect  
4. Sem conta → Criar conta (e-mail prefilled) / Já tenho conta  

Roles: Profissional / Secretário(a).

### `/acesso-removido`

Mensagem: acesso removido; dados mantidos; contato admin; Voltar início.

**Post-auth redirect:** system_admin → admin; MFA wizard se policy; senão redirect seguro ou dashboard.

---

# 28. Integrações Transversais e Fluxos Ponta a Ponta

## 28.1 Mapa mental

```
Serviços/Preços/Procedimentos → Agenda
Agenda → Encounter + Consumo Estoque + Comanda
Comanda → Vendas (analytics) + Financeiro (AR)
Pagamentos → Extrato + Recibo
Despesas → AP + Entrada Estoque
Forms públicos → Não cadastrados / Eventos / Leads
Leads → Jornada (case) → WhatsApp / Agenda
WhatsApp ↔ Assistente IA ↔ Ops CasePanel
Site público → Booking → Appointment
Eventos → Mensagens (e-mail/WhatsApp)
Config Clínica/Site/KB → Site público + Assistente
Equipe/Convites → Profiles + secretary_doctors + WA routing
Plano Stripe → Feature gates (WA, email, logo, audit…)
```

## 28.2 Fluxo recepção → clínico → cobrança

1. Criar na Agenda (wizard 4 passos) → evento na grade  
2. Confirmar / compliance / StatusBar  
3. Fila ou Recepção: Iniciar atendimento → encounter `em_andamento`  
4. Tab Clínico: fichas, docs, notas, áudio  
5. Encerrar clínico → baixa estoque → `finalizado_aguardando_cobranca`  
6. Finalizar comanda / Receber → quitada  
7. Appointment pode ir para `realizada` em paralelo  

## 28.3 Fluxo captação → jornada

1. Form público preenchido → evento `public_form_completed` + Não Cadastrado / Lead  
2. Central de Eventos / Leads: Cadastrar / Qualificar / Agendar  
3. Case na Jornada (fase captacao/comercial/consulta…)  
4. WhatsApp conversa vinculada; AgoraStrip mostra próxima ação humana  
5. Consulta → comparecimento / financeiro  

## 28.4 Fluxo site → booking

1. Admin publica site + habilita autoagendamento (sem salas ativas; com procedures/doctors/preços)  
2. Visitante escolhe procedimento → profissional → slot → dados → confirma  
3. Appointment criado → Eventos / Agenda / (possível) Case  

## 28.5 Integrações externas

| Integração | Onde |
|------------|------|
| Meta WhatsApp | Conversas, templates, confirmação, billing, Embedded Signup |
| Google Gmail | Integrações, e-mail automático, teste, branding |
| Stripe | Plano clínica, admin IDs, feature gates, Payment Element |
| OpenAI / LangGraph | Assistente, playground |
| ViaProve | Transcrição de consulta |
| Supabase | Auth, DB, Realtime, Storage, MFA, RPCs públicos |
| Facebook SDK | WhatsApp Embedded Signup |

---

# 29. Observações de UX Transversais

1. **Dualidade Recepção vs Clínico** deixa claro operacional vs clínico.  
2. **Três status** (appointment / encounter / comanda) não devem ser confundidos — qualquer redesign deve preservar ou unificar conscientemente.  
3. **Criação de consulta unificada** na Agenda (lista redireciona).  
4. **Princípio CRM:** Pipeline = números; Jornada = posto; Leads = entrada.  
5. **Financeiro “inbox do dia”** na home; relatórios em páginas próprias.  
6. **Vendas ≠ Financeiro:** Vendas = faturamento (comandas); Financeiro = caixa/AR/AP.  
7. **Plan gates** educacionais (Comunicação Pro, banners amber) em vez de só 403.  
8. **Empty states** com CTA na maioria das listas.  
9. **Mobile:** drawer nav, FAB/ícones na Agenda, WhatsApp split list/chat, site com sticky CTAs.  
10. **Busca do topbar** visualmente presente mas desabilitada.  
11. **Notificações** sino stub (sem painel real).  
12. **Inconsistências / gaps conhecidos:**  
    - Pacotes e NF stubs  
    - SADT redirect  
    - Lotes com UUID manual  
    - Taxa no-show modo serviço com UUID manual  
    - Campos produto sem edit/delete UI  
    - Grip visual sem reorder em alguns campos  
    - Pipeline home secretária só CTA  
    - Preferência Atividades recentes sem feed  
    - EventosConfig em mensagens órfão  
    - Componentes órfãos na recepção (`ConsultaDetalheClient`, etc.)  
    - Campos de preparo do appointment sem UI no wizard  
    - Médico: filtro período não refiltra lista/calendário do dia  
    - Observações internas WhatsApp “Em breve”  
    - Confirms nativos em pendentes de mensagens  

---

# 30. Redirects e Rotas Legadas

| De | Para |
|----|------|
| `/dashboard/pacientes*` | `/dashboard/contatos/pacientes*` |
| `/dashboard/equipe` | Contatos profissionais (nav); página equipe ainda existe para admin |
| `/dashboard/campos-pacientes` | Config campos personalizados (nav) |
| `/dashboard/formularios*` | CRM captacao (nav) |
| `/dashboard/plano` | Config assinatura (nav) |
| `/dashboard/pipeline` | `/crm/jornada?view=pendencias` |
| `/dashboard/crm/funil` | `/crm/pipeline#funis` |
| `/dashboard/crm/jornada/centro` | `/crm/jornada` |
| `/dashboard/atendimentos` | `/dashboard/atendimento` |
| `/dashboard/atendimentos/sadt` | `/dashboard/atendimentos` → fila |
| `/dashboard/planos-tratamento` | Serviços `?tab=planos` |
| `/dashboard/financeiro/fluxo-diario\|mensal` | `/fluxo-caixa` |
| `/dashboard/vendas/pacotes\|notas-fiscais` | `/vendas` |
| `/dashboard/configuracoes/agendamento` | Assistente virtual |
| `/dashboard/configuracoes/seguranca` | Privacidade `#mfa` |
| `/dashboard/secretarias-medicos` | `/equipe` |
| `/dashboard/templates*` | Mensagens templates |
| `/dashboard/privacidade*` | Config privacidade |
| `/dashboard/servicos-valores` | `/servicos-valores/servicos` |
| `/dashboard/configuracoes/procedimentos` | Serviços procedimentos |
| `/dashboard/configuracoes/catalogo-clinico` | Campos personalizados |

---

# 31. Apêndices

## Apêndice A — Labels de lifecycle (Leads/CRM)

| Stage | Label |
|-------|--------|
| `lead_novo` | Lead novo |
| `em_qualificacao` | Em qualificação |
| `qualificado` | Qualificado |
| `oportunidade` | Oportunidade |
| `cliente` | Cliente |
| `perdido` | Perdido |

Temperatura: Frio · Morno · Quente.

## Apêndice B — Event codes conhecidos

`patient_registered` · `appointment_created` · `appointment_confirmed` · `appointment_rescheduled` · `appointment_completed` · `appointment_no_show` · `appointment_canceled` · `form_linked` · `patient_form_completed` · `public_form_completed` · lembretes 24h/48h · `form_link_sent` · `form_reminder`

## Apêndice C — Loss reasons (pipeline)

Valor/preço · Horário · Localização · Indecisão · Urgência resolvida · Sem resposta · Motivo não identificado · Desistiu · Concorrência · Faltou · Cancelou · Outro

## Apêndice D — Status documentados

### Appointment

`agendada` | `confirmada` | `realizada` | `falta` | `cancelada`

### Encounter

`em_andamento` | `finalizado_aguardando_cobranca` | `cobrado`

### Comanda

`provisória` / `aberta` | `parcial` | `paga` | `cancelada`

### Form instance

`pendente` | `respondido` | `incompleto`

### Clinical document

`draft` | `issued_manual` | `signed_digital` | `pending_signature` | `void`

### Quote (orçamento)

`Rascunho` | `Enviado` | `Aceito` | `Recusado` | `Expirado`

### Evento (Central)

Pendente / Enviado / Concluído sem envio / Concluído / Ignorado / Falhou

### WhatsApp conversation UI tabs

Na janela (24h) / Fora da janela / Concluídas

### Políticas de pagamento (appointment)

`antecipado` | `no_dia` | `pos_atendimento`

### Políticas de plano de tratamento

`antecipado` | `parcelado` | `por_sessao`

## Apêndice E — Inventário de CTAs críticos (redesign)

| Superfície | CTAs principais |
|------------|-----------------|
| Home secretária | Nova Consulta, Novo Paciente, Novo Formulário, Ver todas, Abrir leads, Ver pendências |
| Home médico | Ver Agenda Completa, Ver Detalhes, StatusToggle |
| Home admin | Criar demo, Pendências, Fila do dia, Eventos, Lista operacional, Agenda completa, Auditoria |
| Agenda | Nova consulta, Filtros, Indisponibilidades, Fila de espera, Atendimento, Finalizar |
| Recepção | Status, Iniciar atendimento, Encerrar clínico, Gerar/Finalizar comanda, Receber |
| Clínico | Encerrar atendimento clínico, Finalizar comanda, Trazer da consulta anterior |
| WhatsApp | Assumir, Encaminhar, Concluir, Excluir, Workspace, Nova conversa |
| Eventos | Enviar, Concluir, ações contextuais |
| Financeiro | Lançamento, Receber, Marcar paga, Exportar CSV |
| Vendas | Novo orçamento, Config. IA, Aceito/Recusado, Gerar PDF |
| Site clínica | Agendar, WhatsApp, Enviar mensagem |
| Booking | Continuar / Confirmar / Voltar site |
| Auth | Entrar, Criar, Google, MFA, Enviar link |
| Admin system | Salvar plano/clínica, troca rápida |

## Apêndice F — Componentes dashboard-ui compartilhados

PageShell · FilterBar · SegmentedTabs · ViewModeToggle · ContactList/Card · ListPanel · EmptyState · StatCard · ChartCard · KanbanBoard/Column/Card · PeriodFilter · skeletons · ConfirmDialog

## Apêndice G — Papéis × escopo de dados (resumo operacional)

| Papel | Escopo típico de agenda/consultas |
|-------|-----------------------------------|
| admin | Toda a clínica |
| secretaria | Médicos em `secretary_doctors` (se vazio, comportamento pode zerar filas) |
| medico | Próprio `doctor_id` |
| system_admin | Plataforma (sem dados clínicos da clínica no shell) |

---

*Fim do documento. Qualquer proposta de melhoria, redesign ou reimplementação deve partir deste mapa funcional e respeitar os gates de papel/plano, as três camadas de status (appointment/encounter/comanda), a separação entre posto operacional (Jornada/Agenda/Financeiro inbox) e analytics (Pipeline KPIs / Vendas / DRE), e a dualidade Recepção vs Clínico.*
