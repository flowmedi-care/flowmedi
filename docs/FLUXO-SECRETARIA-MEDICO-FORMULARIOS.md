# FlowMedi — Fluxo Secretária, Médico e Formulários

Documento para organizar o que implementar: fluxos por papel e desenho do construtor de formulários (secretária escolhe tipo de input por campo).

---

## 1. Fluxo da Secretária (visão geral)

A secretária é quem **opera o dia a dia**: garante paciente cadastrado, consulta agendada, formulário vinculado e, quando fizer sentido, comunicação (link, lembrete).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FLUXO TÍPICO DA SECRETÁRIA                           │
└─────────────────────────────────────────────────────────────────────────┘

  1. Cadastrar paciente (se não existir)
        │
  2. Agendar consulta (paciente + médico + tipo + data/hora)
        │
  3. Sistema associa formulários ao tipo → instâncias por consulta
        │
  4. (Opcional) Enviar link do formulário / lembrete (respeitando LGPD)
        │
  5. Acompanhar: status da consulta, formulário pendente/respondido
        │
  6. Remarcar, cancelar, marcar falta quando necessário
```

### 1.1 O que a secretária faz (lista objetiva)

| Ação | Onde vive na app | Observação |
|------|------------------|------------|
| **Cadastrar paciente** | Pacientes → Novo paciente | Nome, contato, data nasc., observações. Busca para não duplicar. |
| **Listar/buscar pacientes** | Pacientes | Ver histórico de consultas do paciente. |
| **Agendar consulta** | Agenda (ou “Nova consulta”) | Escolhe: paciente, médico, tipo de consulta, data/hora. Ao salvar, o sistema cria as instâncias de formulário ligadas ao tipo. |
| **Editar/remarcar consulta** | Agenda → clicar na consulta | Alterar data/hora, tipo, notas. |
| **Cancelar / marcar falta** | Agenda → consulta | Status: cancelada, falta. |
| **Ver status dos formulários** | Agenda ou lista de consultas | Pendente / respondido / incompleto por consulta. |
| **Enviar/reenviar link do formulário** | Na consulta ou na lista | Botão “Enviar link” (manual); depois lembrete/confirmação (sempre com confirmação da secretária). |
| **Ver indicadores do dia** | Dashboard / Agenda | Ex.: “X não confirmadas”, “Y formulários pendentes”. |

**Observação:** Quem **cria os formulários (templates)** e **tipos de consulta** é o **Admin** (ou, se você quiser, pode liberar para secretária com permissão). A secretária **usa** os formulários já vinculados ao tipo ao agendar; ela não define a estrutura do formulário, só dispara o link e acompanha o status.

Se a sua ideia é a **secretária montar o formulário** (escolher tipo de input por campo), isso seria o **construtor de formulários** — que pode ser acessado por Admin ou por Secretária, conforme você definir. O importante: o **template** tem campos com tipo escolhido (texto, data, múltipla escolha, etc.); a **instância** é uma cópia para uma consulta específica, que o paciente preenche.

---

## 2. Fluxo do Médico (visão geral)

O médico **não agenda** nem **não envia mensagens**. Ele usa a agenda e os dados do paciente para a consulta.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FLUXO TÍPICO DO MÉDICO                               │
└─────────────────────────────────────────────────────────────────────────┘

  1. Abre a Agenda (dia atual ou escolhe o dia)
        │
  2. Vê lista de consultas: horário, paciente, tipo, status
        │
  3. Clica em uma consulta (ou no paciente)
        │
  4. Vê resumo do paciente + formulários daquela consulta (preenchidos ou não)
        │
  5. Lê as respostas do formulário (anamnese, preparo, alergias, etc.)
        │
  6. (Futuro) Bloquear horários na própria agenda
```

### 2.1 O que o médico vê (lista objetiva)

| Tela / Bloco | Conteúdo |
|--------------|----------|
| **Agenda do dia** | Lista (ou grade horária): horário, nome do paciente, tipo de consulta, status (agendada, confirmada, etc.). Destaques: “formulário pendente”, “não confirmada”. |
| **Ao abrir a consulta** | Cabeçalho: paciente (nome, idade, contato rápido). Aba ou seção: **Formulários** — um por template vinculado ao tipo; cada um mostra status e, se respondido, as **respostas** renderizadas (pergunta → valor), com destaque para alertas (alergias, preparo). |
| **Histórico do paciente** | (Opcional na primeira versão) Lista de consultas anteriores na clínica. |

Ou seja: **agenda do dia** → **clicar no paciente/consulta** → **formulário(s)** com campos no formato “pergunta → resposta”, com tipo de input só influenciando **como** a resposta é exibida (texto, data, lista de opções marcadas, etc.).

---

## 3. Formulários: secretária (ou admin) escolhe o tipo de input

Sua ideia: a **secretária** (ou o admin) monta o formulário **escolhendo o tipo de input** de cada campo. Isso combina com o schema atual: `form_templates.definition` em JSON.

### 3.1 Estrutura sugerida do `definition` (JSON)

Cada item do array é um **campo** do formulário. Exemplo:

```json
[
  {
    "id": "campo-uuid-1",
    "type": "short_text",
    "label": "Nome completo",
    "required": true,
    "placeholder": "Ex.: Maria Silva"
  },
  {
    "id": "campo-uuid-2",
    "type": "long_text",
    "label": "Queixa principal",
    "required": true,
    "placeholder": "Descreva em poucas linhas"
  },
  {
    "id": "campo-uuid-3",
    "type": "single_choice",
    "label": "Já fez este procedimento antes?",
    "required": true,
    "options": ["Sim", "Não"]
  },
  {
    "id": "campo-uuid-4",
    "type": "multiple_choice",
    "label": "Alergias conhecidas (marque todas)",
    "required": false,
    "options": ["Penicilina", "Dipirona", "Látex", "Nenhuma", "Outra"]
  },
  {
    "id": "campo-uuid-5",
    "type": "date",
    "label": "Data do último exame",
    "required": false
  },
  {
    "id": "campo-uuid-6",
    "type": "number",
    "label": "Peso (kg)",
    "required": false,
    "min": 0,
    "max": 300
  },
  {
    "id": "campo-uuid-7",
    "type": "yes_no",
    "label": "Está em jejum?",
    "required": true
  }
]
```

As **respostas** ficam em `form_instances.responses` como chave = `id` do campo, valor = resposta. Ex.:

```json
{
  "campo-uuid-1": "Maria Silva",
  "campo-uuid-2": "Dor abdominal há 2 dias.",
  "campo-uuid-3": "Não",
  "campo-uuid-4": ["Dipirona"],
  "campo-uuid-5": "2024-01-15",
  "campo-uuid-6": 72,
  "campo-uuid-7": "yes"
}
```

### 3.2 Tipos de input sugeridos (para a secretária escolher)

| Tipo no sistema | Nome amigável (UI) | Uso | Opções no JSON |
|-----------------|--------------------|-----|----------------|
| `short_text` | Texto curto | Nome, medicamento, uma linha | `placeholder` |
| `long_text` | Texto longo (parágrafo) | Queixa, observações | `placeholder` |
| `number` | Número | Peso, altura, idade | `min`, `max`, `placeholder` |
| `date` | Data | Nascimento, último exame | — |
| `single_choice` | Escolha única (dropdown ou radio) | Sim/Não, lista de opções | `options` (array de strings) |
| `multiple_choice` | Múltipla escolha (checkboxes) | Alergias, sintomas | `options` |
| `yes_no` | Sim / Não | Perguntas binárias rápidas | — |

Você pode adicionar depois: `email`, `phone`, `scale` (escala 1–10), etc. O importante é que cada tipo tenha um **componente de exibição** no preenchimento (paciente) e um **componente de leitura** no painel do médico (e, se quiser, na tela da secretária ao ver a resposta).

### 3.3 Quem faz o quê

- **Construtor (criar/editar template):**  
  - Tela “Formulários” (ou “Templates de formulário”): lista de templates; “Novo” / “Editar”.  
  - Na edição: arrastar ou adicionar campos; para cada campo, **escolher tipo** (dropdown: “Texto curto”, “Data”, “Escolha única”, etc.), label, obrigatório, e para single/multiple choice preencher as opções.  
  - Salvar = atualizar `form_templates.definition` (JSON).  
  - Pode vincular o template a um **tipo de consulta** (`appointment_type_id`), para ao agendar já criarem as instâncias.

- **Preenchimento (paciente):**  
  - Página pública (ou com token): lê `definition`, renderiza um input por tipo (input text, textarea, select, radio, checkbox, date, number).  
  - Ao enviar, grava em `form_instances.responses` (e status `respondido` ou `incompleto`).

- **Leitura (médico / secretária):**  
  - Ao abrir a consulta, para cada `form_instances` daquela consulta: carregar `form_template.definition` + `form_instances.responses`.  
  - Renderizar em modo só-leitura: label → valor (formatado conforme o tipo: data em pt-BR, múltipla escolha como lista, etc.).

---

## 4. Onde fica cada coisa na aplicação (sugestão de rotas)

| Área | Rota sugerida | Quem acessa |
|------|----------------|-------------|
| Dashboard geral | `/dashboard` | Todos (conteúdo muda por role) |
| Pacientes | `/dashboard/pacientes` | Secretária, Admin (médico só leitura ou só na ficha da consulta) |
| Agenda | `/dashboard/agenda` | Secretária (criar/editar), Médico (ver + abrir paciente) |
| Formulários (templates) | `/dashboard/formularios` | Admin (ou Secretária se você der permissão) |
| Editar template | `/dashboard/formularios/[id]` | Idem |
| Preenchimento pelo paciente | `/f/[token]` (ou `/formulario/[token]`) | Público (link único) |
| Configurações / Tipos de consulta | `/dashboard/configuracoes` | Admin |
| Equipe | `/dashboard/equipe` | Admin |

Na **agenda**, ao clicar em uma consulta: modal ou página `/dashboard/agenda/consulta/[id]` com abas/seções: **Dados da consulta**, **Paciente**, **Formulários** (com respostas). O médico usa a mesma “abertura de consulta” para ver os formulários.

---

## 5. Ordem sugerida para implementar

1. **Pacientes**  
   - CRUD básico (listar, criar, editar, buscar).  
   - Sem formulários ainda; só deixar a lista e o formulário de cadastro prontos.

2. **Tipos de consulta**  
   - CRUD em configurações (admin): nome, duração.  
   - Necessário para agendar “tipo” e para vincular formulários.

3. **Construtor de formulários**  
   - Listar templates; criar/editar com `definition` em JSON.  
   - UI: adicionar campo → escolher tipo (short_text, long_text, date, number, single_choice, multiple_choice, yes_no); preencher label, required, options quando couber.  
   - Salvar em `form_templates`; opcionalmente vincular a um `appointment_type_id`.

4. **Agenda (consultas)**  
   - Criar/editar consulta: paciente, médico, tipo, data/hora, status.  
   - Ao criar consulta: para o tipo de consulta, buscar templates vinculados e criar um `form_instances` por template (status `pendente`, gerar `link_token`).

5. **Página pública de preenchimento**  
   - Rota `/f/[token]`: busca `form_instances` pelo token; carrega template; renderiza campos por tipo; ao submeter, grava `responses` e atualiza status.

6. **Visão médico (e secretária) da consulta**  
   - Ao abrir consulta: carregar paciente + form_instances; para cada um, mostrar definition + responses em modo leitura (label → valor formatado).  
   - Destaques para alergias / preparo se você tiver campos específicos ou tags.

7. **Indicadores e envio de link**  
   - Na lista da agenda: status do formulário (pendente/respondido); botão “Enviar link” (copiar ou integração e-mail/WhatsApp depois).  
   - Consentimento LGPD antes de enviar mensagens (conforme doc de visão).

---

## 6. Resumo

- **Secretária:** cadastra paciente → agenda consulta (paciente + médico + tipo + data) → sistema cria instâncias de formulário → secretária envia link / vê status → remarca, cancela, marca falta.
- **Médico:** vê agenda do dia → abre consulta → vê paciente e **formulários** (respostas renderizadas por tipo de campo).
- **Formulário:** template = lista de campos; cada campo tem **tipo** (short_text, long_text, date, number, single_choice, multiple_choice, yes_no) escolhido no construtor; respostas em JSON por `id` do campo; na abertura da consulta, mostrar em modo só-leitura com formatação por tipo.

Se quiser, no próximo passo podemos detalhar a UI do construtor (um componente por tipo de campo + como persistir o `definition`) ou a estrutura da página “Abrir consulta” para o médico.
