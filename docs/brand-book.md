# FlowMed — Brand Book & Design System

**Versão:** 1.0  
**Marca oficial:** FlowMed  
**Direção visual:** Warm Stone + Deep Sage  
**Última atualização:** Julho 2026

---

## Índice

1. [Conceito da marca](#1-conceito-da-marca)
2. [Psicologia das cores](#2-psicologia-das-cores)
3. [Paleta principal](#3-paleta-principal)
4. [Escala completa](#4-escala-completa)
5. [Regras de utilização](#5-regras-de-utilização)
6. [Tokens de design](#6-tokens-de-design)
7. [Estados dos componentes](#7-estados-dos-componentes)
8. [Tipografia](#8-tipografia)
9. [Ícones](#9-ícones)
10. [Espaçamentos](#10-espaçamentos)
11. [Bordas](#11-bordas)
12. [Sombras](#12-sombras)
13. [Componentes](#13-componentes)
14. [Motion](#14-motion)
15. [Exemplos práticos](#15-exemplos-práticos)
16. [Crítica e decisões](#16-crítica-e-decisões)

---

## 1. Conceito da marca

### Posicionamento

FlowMed é **a plataforma operacional que dá fluidez à clínica**. Não é um prontuário eletrônico, não é um CRM genérico, não é "mais um sistema médico". É o sistema nervoso da operação clínica — agenda, pacientes, comunicação, financeiro e inteligência artificial em um único fluxo contínuo.

### Personalidade

| Traço | Descrição |
|-------|-----------|
| **Calma** | Interface que reduz ansiedade operacional; nunca grita |
| **Precisa** | Dados corretos, hierarquia clara, zero ambiguidade |
| **Humana** | Tecnologia a serviço do cuidado, não o contrário |
| **Moderna** | Padrão visual de Stripe, Linear, Notion — não de hospital |
| **Discreta** | Elegância sem exageros; cor como recurso escasso |

### Emoções que o usuário deve sentir

- **Confiança operacional** — "Posso confiar neste sistema com dados sensíveis"
- **Clareza mental** — "Sei exatamente o que fazer a seguir"
- **Controle sem fricção** — "Tudo está organizado, nada me trava"
- **Qualidade percebida** — "Isso parece um produto caro, bem feito"

### Percepção de valor

O usuário deve comparar FlowMed a **ferramentas premium de produtividade** (Linear, Notion, Stripe Dashboard), não a sistemas hospitalares legados. A interface comunica tecnologia de ponta, não burocracia médica.

### Arquétipos da marca

| Arquétipo | Peso | Manifestação |
|-----------|------|--------------|
| **O Sábio** | 60% | IA, analytics, decisões informadas, assistente virtual |
| **O Cuidador** | 25% | Paciente no centro, comunicação empática, LGPD |
| **O Governante** | 15% | Controle financeiro, compliance, operação multi-unidade |

---

## 2. Psicologia das cores

### Stone (neutros quentes)

**Por que:** Tons de pedra/parchment transmitem sofisticação, calma e atemporalidade. Diferente do branco clínico (#FFFFFF) que evoca hospital, e do cinza frio que evoca enterprise genérico.

**Emoções:** Estabilidade, confiança silenciosa, calor humano, premium acessível.

**Confiança:** Neutros quentes são associados a marcas como Notion, Airbnb e Aesop — produtos que sentem "caros" sem ser distantes.

**Quando usar:** 90% da interface — backgrounds, texto, bordas, superfícies.

### Sage (verde profundo dessaturado)

**Por que:** Verde comunica crescimento, saúde e equilíbrio — mas apenas quando **dessaturado**. O sage-600 (#3D6F60) evita o clichê de "app de saúde" que o verde esmeralda saturado (#10B981) perpetua.

**Emoções:** Confiança, renovação, inteligência natural, progresso.

**Confiança:** Verde profundo é percebido como estável e maduro (Whole Foods, Starbucks evoluíram para verdes dessaturados). Transmite competência sem agressividade.

**Quando usar:** CTAs primários, links ativos, focus rings, ícones de navegação ativa, indicadores de progresso. Nunca como background dominante.

### Semânticas (success, warning, error, info)

**Por que dessaturadas:** Cores semânticas competem com a marca se forem muito saturadas. Mantemos significado funcional sem quebrar a paleta.

| Cor | Emoção | Uso exclusivo |
|-----|--------|---------------|
| Success `#3D8B6A` | Confirmação, alívio | Status positivo, toast de sucesso |
| Warning `#C4843A` | Atenção, cautela | Alertas não-críticos, vencimentos |
| Error `#C45C5C` | Urgência contida | Erros, exclusões, validação |
| Info `#5B6B7A` | Neutralidade informativa | Dicas, tooltips, badges informativos |

**Info é slate, não azul.** Azul como cor de marca foi rejeitado por ser genérico em health-tech. Info usa slate para diferenciar de ações primárias.

---

## 3. Paleta principal

| Role | HEX | HSL | Uso |
|------|-----|-----|-----|
| **Primary** | `#3D6F60` | `162 29% 34%` | Botões primários, links ativos |
| **Primary Hover** | `#325A4E` | `162 29% 28%` | Hover em elementos primários |
| **Primary Active** | `#2B4A41` | `162 27% 23%` | Pressed state |
| **Secondary** | `#E4EFEA` | `162 20% 94%` | Backgrounds secundários tintados |
| **Accent** | `#4F8A78` | `162 28% 42%` | Links, focus ring, ícones ativos |
| **Success** | `#3D8B6A` | `158 38% 39%` | Confirmações |
| **Warning** | `#C4843A` | `32 55% 50%` | Alertas |
| **Error** | `#C45C5C` | `0 45% 55%` | Erros, destructive |
| **Info** | `#5B6B7A` | `210 14% 42%` | Informação neutra |
| **Background** | `#FAFAF9` | `60 9% 98%` | Página |
| **Foreground** | `#1C1917` | `24 10% 10%` | Texto principal |
| **Card** | `#FFFFFF` | `0 0% 100%` | Superfícies elevadas |
| **Border** | `#E7E5E4` | `20 6% 90%` | Divisores, bordas |
| **Muted** | `#78716C` | `25 5% 45%` | Texto secundário |

---

## 4. Escala completa

### Stone (neutros)

| Token | HEX |
|-------|-----|
| stone-50 | `#FAFAF9` |
| stone-100 | `#F5F5F4` |
| stone-200 | `#E7E5E4` |
| stone-300 | `#D6D3D1` |
| stone-400 | `#A8A29E` |
| stone-500 | `#78716C` |
| stone-600 | `#57534E` |
| stone-700 | `#44403C` |
| stone-800 | `#292524` |
| stone-900 | `#1C1917` |
| stone-950 | `#0C0A09` |

### Sage (marca)

| Token | HEX |
|-------|-----|
| sage-50 | `#F3F8F6` |
| sage-100 | `#E4EFEA` |
| sage-200 | `#C9DED4` |
| sage-300 | `#A3C4B5` |
| sage-400 | `#78A593` |
| sage-500 | `#4F8A78` |
| sage-600 | `#3D6F60` |
| sage-700 | `#325A4E` |
| sage-800 | `#2B4A41` |
| sage-900 | `#253E37` |
| sage-950 | `#142622` |

### Success

| Token | HEX |
|-------|-----|
| success-50 | `#E8F5EF` |
| success-100 | `#D1EBE0` |
| success-200 | `#A3D7C1` |
| success-300 | `#75C3A2` |
| success-400 | `#57A784` |
| success-500 | `#3D8B6A` |
| success-600 | `#2F6E53` |
| success-700 | `#245442` |
| success-800 | `#1A3D30` |
| success-900 | `#102820` |
| success-950 | `#081810` |

### Warning

| Token | HEX |
|-------|-----|
| warning-50 | `#FBF3E8` |
| warning-100 | `#F5E4CC` |
| warning-200 | `#EBC999` |
| warning-300 | `#DFA85E` |
| warning-400 | `#D4934A` |
| warning-500 | `#C4843A` |
| warning-600 | `#A36A2E` |
| warning-700 | `#825224` |
| warning-800 | `#613C1B` |
| warning-900 | `#402812` |
| warning-950 | `#201409` |

### Error

| Token | HEX |
|-------|-----|
| error-50 | `#FAEEEE` |
| error-100 | `#F5D8D8` |
| error-200 | `#EBB1B1` |
| error-300 | `#DF8888` |
| error-400 | `#D07070` |
| error-500 | `#C45C5C` |
| error-600 | `#A84848` |
| error-700 | `#863838` |
| error-800 | `#642A2A` |
| error-900 | `#421C1C` |
| error-950 | `#210E0E` |

### Info (slate)

| Token | HEX |
|-------|-----|
| info-50 | `#EEF1F4` |
| info-100 | `#D8DEE4` |
| info-200 | `#B1BDC9` |
| info-300 | `#8A9CAE` |
| info-400 | `#6D8294` |
| info-500 | `#5B6B7A` |
| info-600 | `#4A5763` |
| info-700 | `#3A444E` |
| info-800 | `#2A3139` |
| info-900 | `#1A1F24` |
| info-950 | `#0D1012` |

### Acessibilidade (WCAG 2.1 AA)

| Combinação | Ratio | Status |
|------------|-------|--------|
| sage-600 sobre stone-50 | 5.8:1 | AA ✓ (texto normal) |
| stone-900 sobre stone-50 | 17.4:1 | AAA ✓ |
| stone-600 sobre stone-50 | 5.5:1 | AA ✓ |
| stone-500 sobre stone-50 | 4.6:1 | AA ✓ (texto grande) |
| sage-400 sobre stone-950 | 7.2:1 | AA ✓ (dark mode) |

---

## 5. Regras de utilização

### Princípios fundamentais

#### 1. Regra 90/8/2
- **90%** neutros (stone)
- **8%** marca (sage)
- **2%** semântico (success/warning/error)

#### 2. Uma cor de ação por tela
Apenas um elemento usa `primary` como fill sólido por viewport. Demais ações são `outline` ou `ghost`.

#### 3. Hierarquia antes de cor
Priorize peso tipográfico, tamanho e espaço antes de adicionar cor. Título em `stone-900` 600 weight > subtítulo em `stone-500` 400 weight.

#### 4. Cor com significado funcional
- Verde = sucesso/confirmação, nunca decoração
- Vermelho = erro/destruição, nunca destaque genérico
- Sage = ação primária/navegação ativa

#### 5. Superfícies sobre sombras
Prefira `border stone-200` + `bg white` a drop-shadows pesados. Sombras são para elevação real (dropdowns, modais).

#### 6. Nunca duas cores saturadas competindo
Se um card tem borda sage, o background é white ou stone-50 — nunca sage-100 + sage-600 simultaneamente em grande área.

#### 7. Comparação A/B em tons da mesma família
Estados comparativos usam variações de sage ou stone, não cores aleatórias.

#### 8. Dark mode é redesign, não inversão
Background `stone-950`, primary `sage-400`, surfaces `stone-900`. Não basta inverter lightness.

### Padrões de referência

| Empresa | Padrão adotado |
|---------|----------------|
| **Apple** | Um accent por contexto; SF Pro hierarchy; blur e translucidez |
| **Stripe** | Dashboard monocromático; cor só em gráficos e CTAs |
| **Linear** | Interface quase toda neutra; roxo só em ações |
| **Notion** | Warm neutrals; cor em ícones e tags apenas |
| **Airbnb** | Fotografia + neutros; cor reservada para CTAs |
| **Arc Browser** | Personalidade sem ruído; gradientes sutis |
| **Revolut** | Densidade alta com hierarquia tipográfica forte |

---

## 6. Tokens de design

Implementação em `app/globals.css` e `lib/design-tokens.ts`.

| Token | Light | Justificativa |
|-------|-------|---------------|
| `--background` | stone-50 | Base quente, não-clínica |
| `--foreground` | stone-900 | Texto principal, alto contraste |
| `--primary` | sage-600 | Ação principal da marca |
| `--primary-hover` | sage-700 | Feedback de interação |
| `--primary-active` | sage-800 | Estado pressed |
| `--primary-foreground` | white | Texto sobre primary |
| `--secondary` | sage-100 | Superfícies tintadas suaves |
| `--secondary-foreground` | sage-900 | Texto sobre secondary |
| `--surface` | white | Superfície base |
| `--surface-elevated` | white + border | Cards com elevação sutil |
| `--surface-muted` | stone-100 | Áreas de agrupamento |
| `--card` | white | Componente card |
| `--border` | stone-200 | Divisores padrão |
| `--divider` | stone-200 | Separadores de seção |
| `--input` | stone-200 | Borda de inputs |
| `--text-primary` | stone-900 | Alias de foreground |
| `--text-secondary` | stone-600 | Subtítulos, metadata |
| `--muted` | stone-100 | Backgrounds desabilitados |
| `--muted-foreground` | stone-500 | Placeholders, hints |
| `--success` | `#3D8B6A` | Confirmações |
| `--warning` | `#C4843A` | Alertas |
| `--destructive` | `#C45C5C` | Erros e exclusões |
| `--info` | `#5B6B7A` | Informação neutra |
| `--overlay` | stone-900/50 | Backdrop de modais |
| `--disabled` | stone-400 | Elementos desabilitados |
| `--focus-ring` | sage-500 | Anel de foco acessível |
| `--skeleton` | stone-100 | Loading placeholders |
| `--ring` | sage-500 | Focus visible ring |
| `--shadow-sm` | Ver tokens | Hover sutil |
| `--shadow-md` | Ver tokens | Dropdowns |
| `--shadow-lg` | Ver tokens | Modais |
| `--shadow-xl` | Ver tokens | Marketing hero |

---

## 7. Estados dos componentes

### Primary (sage)

| Estado | Background | Border | Text |
|--------|------------|--------|------|
| Default | sage-600 | none | white |
| Hover | sage-700 | none | white |
| Pressed/Active | sage-800 | none | white |
| Focus | sage-600 | ring sage-500/30 | white |
| Selected | sage-100 | sage-300 | sage-800 |
| Disabled | stone-100 | stone-200 | stone-400 |
| Loading | sage-600 | none | white + spinner |

### Secondary (outline)

| Estado | Background | Border | Text |
|--------|------------|--------|------|
| Default | white | stone-200 | stone-700 |
| Hover | stone-50 | stone-300 | stone-900 |
| Pressed | stone-100 | stone-300 | stone-900 |
| Focus | white | ring sage-500/30 | stone-700 |
| Disabled | stone-50 | stone-200 | stone-400 |

### Ghost

| Estado | Background | Text |
|--------|------------|------|
| Default | transparent | stone-600 |
| Hover | stone-100 | stone-900 |
| Pressed | stone-200 | stone-900 |
| Focus | transparent | ring sage-500/30 |

### Input

| Estado | Border | Ring |
|--------|--------|------|
| Default | stone-200 | none |
| Hover | stone-300 | none |
| Focus | sage-500 | sage-500/20 |
| Error | error-500 | error-500/20 |
| Disabled | stone-200 | bg stone-50 |
| Success | success-500 | success-500/20 |

### Semantic alerts

| Tipo | Background | Border | Icon/Text |
|------|------------|--------|-----------|
| Success | success-50 | success-200 | success-700 |
| Warning | warning-50 | warning-200 | warning-700 |
| Error | error-50 | error-200 | error-700 |
| Info | info-50 | info-200 | info-700 |

---

## 8. Tipografia

### Família: Plus Jakarta Sans

**Por que:** Geométrica mas calorosa; excelente legibilidade em pt-BR; já integrada no produto; alinhada ao tier de Notion, Stripe e tier-2 SaaS premium. Não é Inter (genérica) nem SF Pro (sistêmica demais).

### Pesos utilizados

| Peso | Uso |
|------|-----|
| 400 (Regular) | Body, parágrafos, tabelas |
| 500 (Medium) | Labels, captions, badges |
| 600 (Semibold) | Subtítulos, card titles, nav items |
| 700 (Bold) | Headings, CTAs, KPIs |

### Escala tipográfica

| Token | Size | Line Height | Weight | Tracking | Uso |
|-------|------|-------------|--------|----------|-----|
| display | 48px / 56px | 1.1 | 700 | -0.02em | Marketing hero |
| h1 | 36px | 1.15 | 700 | -0.02em | Page titles |
| h2 | 28px | 1.2 | 600 | -0.02em | Section headers |
| h3 | 22px | 1.25 | 600 | -0.01em | Card titles |
| h4 | 18px | 1.3 | 600 | 0 | Subsections |
| body | 16px | 1.5 | 400 | 0 | Default text |
| body-sm | 14px | 1.5 | 400 | 0 | Tables, metadata |
| caption | 12px | 1.4 | 500 | 0 | Labels, badges |
| overline | 11px | 1.3 | 600 | 0.06em | Category labels |

### Regras

- Máximo 3 níveis de heading por tela
- Body nunca menor que 14px (acessibilidade mobile)
- Inputs em 16px no mobile (evita zoom iOS)
- Números tabulares (`tabular-nums`) em KPIs e tabelas financeiras

---

## 9. Ícones

### Biblioteca: Lucide React

### Estilo

| Propriedade | Valor |
|-------------|-------|
| Tipo | Outline only |
| Stroke | 1.5px (default), 2px (≤16px) |
| Cap | Round |
| Join | Round |
| Fill | Nunca (exceto status dots e logos) |

### Tamanhos

| Contexto | Size |
|----------|------|
| Inline com body-sm | 16px |
| Botões, nav items | 20px |
| Section headers | 24px |
| Empty states | 32px |
| Marketing | 40px |

### Cores

| Contexto | Cor |
|----------|-----|
| Default | stone-500 |
| Ativo/selecionado | sage-600 |
| Sobre primary | white |
| Semântico | success/warning/error/info respectivos |
| Disabled | stone-300 |

### Consistência

- Migrar `@phosphor-icons` para Lucide onde possível
- Ícones de navegação sempre no grid 20px
- Nunca misturar outline com filled na mesma view

---

## 10. Espaçamentos

### Sistema: 4pt base, 8pt para layout

**Por que 4pt base:** Permite micro-ajustes (4px, 12px) necessários em componentes densos (tabelas, badges). **8pt para layout** alinha seções e grids a múltiplos confortáveis.

### Escala

| Token | Value | Uso |
|-------|-------|-----|
| 1 | 4px | Gap entre ícone e label |
| 2 | 8px | Padding interno de badges |
| 3 | 12px | Gap entre form fields |
| 4 | 16px | Padding de cards, seções |
| 5 | 20px | — |
| 6 | 24px | Padding de modais |
| 8 | 32px | Gap entre seções |
| 10 | 40px | — |
| 12 | 48px | Section padding vertical |
| 16 | 64px | Hero padding |
| 20 | 80px | Marketing sections |
| 24 | 96px | Page margins grandes |

### Regras

- Padding interno de componentes: múltiplos de 4
- Gap entre seções de página: múltiplos de 8
- Nunca usar valores arbitrários (ex: 13px, 27px)

---

## 11. Bordas

### Border radius

| Token | Value | Uso |
|-------|-------|-----|
| sm | 6px | Chips, badges, tags |
| md | 8px | Inputs, buttons |
| lg | 12px | Cards (default `--radius`) |
| xl | 16px | Modais, panels |
| 2xl | 20px | Marketing cards, hero |
| full | 9999px | Avatars, pills, toggles |

### Espessura

| Contexto | Width |
|----------|-------|
| Default | 1px |
| Focus ring | 2px |
| Selected/active | 2px |
| Divider | 1px |

### Quando cantos retos vs arredondados

| Retos (sm/md) | Arredondados (lg/xl/2xl) |
|---------------|--------------------------|
| Tabelas densas | Cards de conteúdo |
| Inputs e forms | Modais e dialogs |
| Toolbar buttons | Marketing sections |
| Data grids | Avatars e pills |

---

## 12. Sombras

### Níveis de elevação

| Token | CSS | Uso |
|-------|-----|-----|
| none | — | Default em dashboard denso |
| sm | `0 1px 2px rgba(28,25,23,0.04), 0 1px 3px rgba(28,25,23,0.06)` | Card hover |
| md | `0 2px 8px rgba(28,25,23,0.06), 0 4px 16px rgba(28,25,23,0.04)` | Dropdowns, popovers |
| lg | `0 4px 16px rgba(28,25,23,0.08), 0 12px 40px rgba(28,25,23,0.06)` | Modais |
| xl | `0 8px 32px rgba(28,25,23,0.10), 0 24px 64px rgba(28,25,23,0.08)` | Marketing hero only |

### Regras

- **Se tem border visível, sombra ≤ sm**
- Dashboard: preferir border sem sombra
- Modais: sombra lg + overlay
- Nunca sombra colorida (exceto primary/25 em CTAs de marketing)
- Dark mode: sombras mais sutis ou substituídas por border

---

## 13. Componentes

### Botões

| Variante | Background | Border | Text | Radius |
|----------|------------|--------|------|--------|
| Primary | sage-600 | none | white | md |
| Secondary | white | stone-200 | stone-700 | md |
| Ghost | transparent | none | stone-600 | md |
| Destructive | error-500 | none | white | md |
| Soft | sage-50 | none | sage-700 | md |

Heights: sm 32px, default 36px, lg 44px. Sem gradientes.

### Inputs

- Background: white
- Border: stone-200, focus sage-500
- Height: 36px (h-9)
- Radius: md
- Placeholder: stone-400
- Font: 16px mobile, 14px desktop

### Selects

- Mesmo visual de input
- Chevron: stone-400
- Dropdown: surface-elevated + shadow-md

### Cards

- Background: white
- Border: stone-200/60
- Radius: lg
- Padding: 24px
- Sem sombra em repouso; shadow-sm no hover (opcional)

### Modais

- Overlay: stone-900/50
- Card: white, radius xl, shadow-lg
- Max-width: sm 400px, md 560px, lg 720px
- Padding: 24px

### Menus / Dropdowns

- Background: white
- Border: stone-200
- Shadow: md
- Item hover: stone-50
- Item selected: sage-50 + sage-600 text
- Radius: lg

### Tabelas

- Header: stone-50 bg, stone-600 text, caption size
- Rows: border-b stone-100
- Hover: stone-50
- Selected: sage-50
- Compact: py-2, default: py-3

### Badges

- Radius: sm (full para pills)
- Padding: 4px 8px
- Variants: default (stone-100), primary (sage-100), success, warning, error
- Font: caption (12px, 500)

### Alerts

- Radius: lg
- Padding: 16px
- Border-left: 4px na cor semântica
- Background: semantic-50
- Icon + text + optional action

### Gráficos

- Paleta monocromática: sage-200 → sage-600
- Grid lines: stone-200
- Labels: stone-500, caption size
- Nunca mais de 6 cores em um chart

### Calendário

- Grid: stone-100 borders
- Today: ring sage-500
- Events: border-left 3px sage-500, bg sage-50
- Não usar cor por profissional (usar iniciais/avatar)

### Navegação / Sidebar

- Background: white ou stone-50
- Active item: sage-50 bg + sage-600 text + sage-200 border-left
- Inactive: stone-600 text
- Hover: stone-50
- Width: 260px expanded, 64px collapsed

### Bottom sheets (mobile)

- Handle: stone-300, 36px × 4px
- Radius: xl top only
- Shadow: lg
- Backdrop: overlay

### Diálogos de confirmação

- Ícone semântico (warning para destrutivo)
- Título: h4
- Mensagem: body-sm, stone-600
- Ações: cancel (secondary) + confirm (primary ou destructive)

---

## 14. Motion

### Princípios

1. **Motion com propósito** — toda animação comunica estado ou transição
2. **Rápido por padrão** — interfaces densas não podem parecer lentas
3. **Respeitar prefers-reduced-motion** — sempre
4. **Spring para hero, ease para UI** — contexto define a curva

### Durações

| Token | Duration | Easing | Uso |
|-------|----------|--------|-----|
| instant | 100ms | ease-out | Toggle, checkbox |
| micro | 150ms | cubic-bezier(0.25, 0.1, 0.25, 1) | Hover, focus |
| standard | 250ms | cubic-bezier(0.22, 1, 0.36, 1) | Page transitions, cards |
| emphasis | 400ms | spring(300, 30) | Hero, modais, canvas 3D |

### Microinterações

| Ação | Feedback |
|------|----------|
| Button click | Scale 0.98 → 1 (100ms) |
| Toggle | Slide + color (150ms) |
| Toast enter | Slide up + fade (250ms) |
| Modal enter | Fade overlay + scale 0.95→1 (250ms) |
| Skeleton | Pulse opacity (1.5s infinite) |
| Loading | Spinner rotate (1s linear infinite) |

### Referências

- **iOS:** spring natural, 300-400ms para transições de tela
- **Linear:** instant feedback, zero delay perceptível
- **Arc Browser:** motion expressiva mas contida em área delimitada

---

## 15. Exemplos práticos

### Dashboard

- Background: stone-50
- KPI cards: white, border stone-200, sem sombra
- 1 KPI destacado com número em sage-600 (o mais importante)
- Gráfico: gradiente sage-200 → sage-600
- Sidebar: white, item ativo sage-50
- Zero decoração colorida

### Login

- Background: stone-50 com gradient-mesh sutil (sage/5%)
- Card central: white, shadow-lg, radius xl
- Logo FlowMed no topo
- CTA: primary sage-600, full width
- Link secundário: sage-600 text, sem underline até hover
- Zero ilustrações genéricas de saúde

### Agendamento

- Grid: stone-100 células
- Horários disponíveis: white, hover sage-50
- Selecionado: sage-50 bg + sage-600 border-left 3px
- Ocupado: stone-200 bg, stone-400 text
- Profissional: avatar + nome, sem cor por profissional

### Chat (WhatsApp / Assistente)

- Thread: stone-50
- Bubble enviada: sage-50 bg, stone-900 text
- Bubble recebida: white bg, border stone-200
- Input fixo bottom: white, border-t stone-200
- Timestamp: caption, stone-400

### Prontuário

- Densidade alta: body-sm
- Seções colapsáveis com accordion
- Status badges semânticos apenas
- Dados críticos em stone-900 600 weight
- Metadata em stone-500 caption
- Zero cor decorativa

### Calendário

- Header: stone-900 h3
- Dias: stone-600 body-sm
- Today: ring-2 sage-500
- Eventos: border-left sage-500, bg sage-50/50
- Hover evento: sage-100 bg
- Vista semanal: grid stone-100

### Perfil

- Avatar: 80px, radius full
- Card único: white, padding 32px
- Dados: label caption stone-500, valor body stone-900
- Ações: ghost buttons, destructive isolado no final

### Configurações

- Lista linear estilo iOS Settings
- Rows: py-3, border-b stone-100
- Toggle: sage-600 quando ativo
- Seções: overline label stone-400
- Ícones: stone-500, 20px

---

## 16. Crítica e decisões

### Por que NÃO "Butter + Green"

| Problema | Impacto |
|----------|---------|
| Butter como accent | Evoca spa, orgânico, wellness — clichê de saúde |
| Duas famílias quentes | Competição visual; viola hierarquia cromática |
| Escalabilidade | Amarelo-creme falha em dark mode, gráficos e tabelas |
| WCAG | Contraste instável entre butter-bg e green-text |

**O que salvamos:** calor dos neutros como stone/parchment, não como cor de destaque.

### Por que NÃO azul de marca

- Azul é o default de health-tech (Epic, Cerner, Doctoralia)
- Hero anterior com `#2563EB` parecia SaaS dev genérico
- Info usa slate — funcional sem ser marca

### Por que NÃO trocar a fonte agora

- Plus Jakarta Sans já integrada e performante
- Excelente em pt-BR
- Trocar fonte é custo alto com retorno marginal
- Futuro: considerar Geist Sans se quiser mais "tech"

### Por que sage dessaturado vs emerald saturado

- Emerald `#10B981` = WhatsApp, iClinic, startup health
- Sage `#3D6F60` = maduro, premium, Stripe-adjacent
- Contraste AA mantido (5.8:1)

### Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Verde ainda parecer "health app" | 90% neutros stone; sage só em ações |
| Regressão visual | Tokens centralizados; nomes CSS mantidos |
| Dark mode incompleto | Tokens dark definidos; toggle futuro |
| Componentes com drift | Migração gradual gray-* → tokens |

---

## Referência técnica

- Tokens CSS: `app/globals.css`
- Tokens JS: `lib/design-tokens.ts`
- Tailwind: `tailwind.config.ts`
- Fonte: `app/layout.tsx` (Plus Jakarta Sans)

---

*Este documento é o padrão oficial de identidade visual do FlowMed. Qualquer designer ou sistema de IA deve seguir estas diretrizes para manter consistência com o nível de qualidade dos melhores produtos do mercado.*
