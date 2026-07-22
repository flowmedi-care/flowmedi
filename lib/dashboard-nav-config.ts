export type NavIconName =
  | "layout-dashboard"
  | "calendar"
  | "calendar-days"
  | "clipboard-list"
  | "file-text"
  | "bell"
  | "mail"
  | "message-square"
  | "package"
  | "circle-dollar-sign"
  | "users"
  | "user-plus"
  | "target"
  | "stethoscope"
  | "shopping-cart"
  | "wallet"
  | "receipt"
  | "tags"
  | "landmark"
  | "settings"
  | "shield-check"
  | "cake"
  | "truck"
  | "contact"
  | "file-edit"
  | "plug"
  | "book-open";

export type NavLinkItem = {
  type: "link";
  href: string;
  label: string;
  icon: NavIconName;
  roles?: string[];
  badgeKey?: "whatsapp";
};

export type NavGroupItem = {
  type: "group";
  id: string;
  label: string;
  icon: NavIconName;
  roles?: string[];
  prefix: string;
  badgeKey?: "whatsapp";
  children: { href: string; label: string; roles?: string[] }[];
};

export type NavTopItem = NavLinkItem | NavGroupItem;

export const DASHBOARD_AGENDA_GROUP: NavGroupItem = {
  type: "group",
  id: "agenda",
  label: "Agenda",
  icon: "calendar",
  prefix: "/dashboard/agenda",
  children: [
    { href: "/dashboard/agenda", label: "Calendário" },
    {
      href: "/dashboard/hoje/agendamentos",
      label: "Agendamentos",
      roles: ["admin", "secretaria"],
    },
    {
      href: "/dashboard/hoje/consultas",
      label: "Consultas",
      roles: ["admin", "secretaria"],
    },
    {
      href: "/dashboard/consulta",
      label: "Lista de consultas",
      roles: ["admin", "secretaria", "medico"],
    },
  ],
};

export const DASHBOARD_COMUNICACAO_GROUP: NavGroupItem = {
  type: "group",
  id: "comunicacao",
  label: "Comunicação",
  icon: "message-square",
  prefix: "/dashboard/whatsapp",
  badgeKey: "whatsapp",
  children: [
    { href: "/dashboard/whatsapp", label: "Conversas" },
    { href: "/dashboard/mensagens", label: "Mensagens enviadas", roles: ["admin"] },
    {
      href: "/dashboard/mensagens/pendentes",
      label: "Fila de envio",
      roles: ["admin", "secretaria"],
    },
    { href: "/dashboard/mensagens/templates", label: "Templates", roles: ["admin"] },
    { href: "/dashboard/mensagens/email", label: "E-mail", roles: ["admin"] },
  ],
};

export const DASHBOARD_TOP_NAV: NavTopItem[] = [
  {
    type: "link",
    href: "/dashboard/hoje",
    label: "Hoje",
    icon: "layout-dashboard",
    roles: ["admin", "secretaria"],
  },
  {
    type: "link",
    href: "/dashboard",
    label: "Visão Geral",
    icon: "layout-dashboard",
    roles: ["admin"],
  },
  {
    type: "link",
    href: "/dashboard",
    label: "Início",
    icon: "layout-dashboard",
    roles: ["medico"],
  },
  {
    type: "link",
    href: "/dashboard/pendencias",
    label: "Pendências",
    icon: "clipboard-list",
    roles: ["admin", "secretaria"],
  },
  DASHBOARD_AGENDA_GROUP,
  {
    type: "link",
    href: "/dashboard/eventos",
    label: "Central de Eventos",
    icon: "bell",
    roles: ["admin", "secretaria"],
  },
  DASHBOARD_COMUNICACAO_GROUP,
];

export const DASHBOARD_MIDDLE_NAV_GROUPS: NavGroupItem[] = [
  {
    type: "group",
    id: "contatos",
    label: "Contatos",
    icon: "contact",
    prefix: "/dashboard/contatos",
    children: [
      { href: "/dashboard/contatos/leads", label: "Contatos (entrada)", roles: ["admin", "secretaria"] },
      { href: "/dashboard/contatos/pacientes", label: "Pacientes" },
      {
        href: "/dashboard/hoje/pacientes",
        label: "Jornadas (pós / tratamento / retorno)",
        roles: ["admin", "secretaria"],
      },
      { href: "/dashboard/contatos/profissionais", label: "Profissionais" },
      { href: "/dashboard/contatos/fornecedores", label: "Fornecedores", roles: ["admin", "secretaria"] },
      { href: "/dashboard/contatos/todos", label: "Todos contatos" },
      { href: "/dashboard/contatos/aniversariantes", label: "Aniversariantes" },
    ],
  },
  {
    type: "group",
    id: "crm",
    label: "Indicadores",
    icon: "target",
    prefix: "/dashboard/crm",
    roles: ["admin", "secretaria"],
    children: [
      { href: "/dashboard/hoje", label: "Hoje" },
      { href: "/dashboard/pendencias", label: "Pendências" },
      { href: "/dashboard/crm/pipeline", label: "Indicadores" },
      { href: "/dashboard/crm/captacao", label: "Formulários" },
      { href: "/dashboard/crm/jornada", label: "Jornada (legado)", roles: ["admin"] },
    ],
  },
  {
    type: "group",
    id: "atendimento",
    label: "Atendimento",
    icon: "stethoscope",
    prefix: "/dashboard/atendimento",
    roles: ["admin", "secretaria", "medico"],
    children: [
      { href: "/dashboard/atendimento", label: "Fila operacional" },
      { href: "/dashboard/atendimentos/prescricoes", label: "Prescrições" },
      { href: "/dashboard/atendimentos/pedidos-exame", label: "Pedidos de exame" },
      { href: "/dashboard/atendimentos/atestados", label: "Atestados" },
    ],
  },
  {
    type: "group",
    id: "vendas",
    label: "Vendas",
    icon: "receipt",
    prefix: "/dashboard/vendas",
    roles: ["admin", "secretaria"],
    children: [
      { href: "/dashboard/vendas", label: "Visão geral" },
      { href: "/dashboard/vendas/relatorio", label: "Relatório de vendas" },
      { href: "/dashboard/vendas/orcamentos", label: "Orçamentos" },
    ],
  },
  {
    type: "group",
    id: "financeiro",
    label: "Financeiro",
    icon: "landmark",
    prefix: "/dashboard/financeiro",
    roles: ["admin", "secretaria"],
    children: [
      { href: "/dashboard/financeiro", label: "Visão geral" },
      { href: "/dashboard/financeiro/receber", label: "Contas a receber" },
      { href: "/dashboard/financeiro/pagar", label: "Contas a pagar" },
      { href: "/dashboard/financeiro/extrato", label: "Extrato" },
      { href: "/dashboard/financeiro/competencia", label: "Competência" },
      { href: "/dashboard/financeiro/fluxo-caixa", label: "Fluxo de caixa" },
      { href: "/dashboard/financeiro/performance", label: "Performance" },
      { href: "/dashboard/financeiro/dre", label: "DRE" },
    ],
  },
  {
    type: "group",
    id: "estoque",
    label: "Estoque",
    icon: "package",
    prefix: "/dashboard/estoque",
    roles: ["admin", "secretaria"],
    children: [
      { href: "/dashboard/estoque", label: "Visão geral" },
      { href: "/dashboard/estoque/lotes", label: "Lotes e validade" },
      { href: "/dashboard/estoque/campos-produto", label: "Campos de produto", roles: ["admin"] },
    ],
  },
];

export const DASHBOARD_SERVICOS_VALORES_GROUP: NavGroupItem = {
  type: "group",
  id: "servicos-valores",
  label: "Serviços e Valores",
  icon: "tags",
  prefix: "/dashboard/servicos-valores",
  roles: ["admin", "medico"],
  children: [
    { href: "/dashboard/servicos-valores/servicos", label: "Serviços e valores" },
    { href: "/dashboard/servicos-valores/procedimentos", label: "Procedimentos", roles: ["admin"] },
  ],
};

export const DASHBOARD_INSTRUCOES_GROUP: NavGroupItem = {
  type: "group",
  id: "instrucoes",
  label: "Instruções",
  icon: "book-open",
  prefix: "/dashboard/instrucoes",
  children: [
    { href: "/dashboard/instrucoes", label: "Visão geral" },
    { href: "/dashboard/instrucoes/jornada-crm", label: "Atendimento e Jornada" },
  ],
};

export const DASHBOARD_CONFIG_GROUP: NavGroupItem = {
  type: "group",
  id: "configuracoes",
  label: "Configurações",
  icon: "settings",
  prefix: "/dashboard/configuracoes",
  roles: ["admin"],
  children: [
    { href: "/dashboard/configuracoes/preferencias", label: "Preferências do sistema" },
    { href: "/dashboard/configuracoes/clinica", label: "Dados da clínica" },
    { href: "/dashboard/configuracoes/base-de-conhecimento", label: "Base de conhecimento" },
    { href: "/dashboard/configuracoes/salas", label: "Salas e consultórios" },
    { href: "/dashboard/configuracoes/integracoes", label: "Integrações" },
    { href: "/dashboard/configuracoes/assistente-virtual", label: "Assistente virtual" },
    { href: "/dashboard/configuracoes/campos-personalizados", label: "Campos personalizados" },
    { href: "/dashboard/configuracoes/contas-bancarias", label: "Contas bancárias" },
    { href: "/dashboard/configuracoes/site", label: "Site da clínica" },
    { href: "/dashboard/configuracoes/privacidade", label: "Privacidade e segurança" },
    { href: "/dashboard/configuracoes/assinatura", label: "Assinatura" },
  ],
};

/** @deprecated Use DASHBOARD_MIDDLE_NAV_GROUPS + DASHBOARD_CONFIG_GROUP */
export const DASHBOARD_NAV_GROUPS: NavGroupItem[] = [
  ...DASHBOARD_MIDDLE_NAV_GROUPS,
  DASHBOARD_CONFIG_GROUP,
];

export const DASHBOARD_UTILITY_NAV: NavLinkItem[] = [
  {
    type: "link",
    href: "/dashboard/perfil",
    label: "Meu Perfil",
    icon: "users",
    roles: ["medico"],
  },
  {
    type: "link",
    href: "/dashboard/auditoria",
    label: "Auditoria",
    icon: "shield-check",
    roles: ["admin"],
  },
];

export function canAccessServicosValoresNav(
  role: string,
  servicesPricingMode: "centralizado" | "descentralizado"
) {
  if (role === "medico" && servicesPricingMode !== "descentralizado") return false;
  if (role !== "medico" && role !== "admin") return false;
  return true;
}

export const LEGACY_PATH_PREFIXES: Record<string, string> = {
  "/dashboard/pacientes": "contatos",
  "/dashboard/equipe": "contatos",
  "/dashboard/campos-pacientes": "configuracoes",
  "/dashboard/formularios": "configuracoes",
  "/dashboard/plano": "configuracoes",
};

const TOP_NAV_GROUPS = [DASHBOARD_AGENDA_GROUP, DASHBOARD_COMUNICACAO_GROUP];

function isAgendaGroupPath(pathname: string): boolean {
  if (pathname === "/dashboard/consulta" || pathname.startsWith("/dashboard/consulta/")) {
    return true;
  }
  if (pathname.startsWith("/dashboard/hoje/agendamentos") || pathname.startsWith("/dashboard/hoje/consultas")) {
    return true;
  }
  if (pathname === "/dashboard/agenda" || pathname.startsWith("/dashboard/agenda/")) {
    if (pathname.startsWith("/dashboard/agenda/atendimento")) return false;
    return true;
  }
  return false;
}

function isAtendimentoGroupPath(pathname: string): boolean {
  if (pathname === "/dashboard/atendimento") return true;
  if (pathname.startsWith("/dashboard/atendimentos")) return true;
  if (pathname.startsWith("/dashboard/agenda/atendimento")) return true;
  if (
    pathname === "/dashboard/planos-tratamento" ||
    pathname.startsWith("/dashboard/planos-tratamento/")
  ) {
    return true;
  }
  return false;
}

function isComunicacaoGroupPath(pathname: string): boolean {
  return (
    pathname === "/dashboard/whatsapp" ||
    pathname.startsWith("/dashboard/whatsapp/") ||
    pathname === "/dashboard/mensagens" ||
    pathname.startsWith("/dashboard/mensagens/")
  );
}

export function getActiveNavGroupId(pathname: string): string | null {
  if (
    pathname === DASHBOARD_CONFIG_GROUP.prefix ||
    pathname.startsWith(`${DASHBOARD_CONFIG_GROUP.prefix}/`)
  ) {
    return "configuracoes";
  }
  if (
    pathname === DASHBOARD_SERVICOS_VALORES_GROUP.prefix ||
    pathname.startsWith(`${DASHBOARD_SERVICOS_VALORES_GROUP.prefix}/`)
  ) {
    return "servicos-valores";
  }
  if (
    pathname === DASHBOARD_INSTRUCOES_GROUP.prefix ||
    pathname.startsWith(`${DASHBOARD_INSTRUCOES_GROUP.prefix}/`)
  ) {
    return "instrucoes";
  }
  if (isComunicacaoGroupPath(pathname)) {
    return "comunicacao";
  }
  if (pathname.startsWith("/dashboard/hoje/pacientes")) {
    return "contatos";
  }
  if (isAgendaGroupPath(pathname)) {
    return "agenda";
  }
  if (isAtendimentoGroupPath(pathname)) {
    return "atendimento";
  }
  for (const group of DASHBOARD_MIDDLE_NAV_GROUPS) {
    if (pathname === group.prefix || pathname.startsWith(`${group.prefix}/`)) {
      return group.id;
    }
  }
  for (const [prefix, groupId] of Object.entries(LEGACY_PATH_PREFIXES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return groupId;
    }
  }
  return null;
}

export function filterNavByRole<T extends { roles?: string[] }>(
  items: T[],
  role: string
): T[] {
  return items.filter((item) => !item.roles || item.roles.includes(role));
}

export function filterTopNavByRole(items: NavTopItem[], role: string): NavTopItem[] {
  return items.filter((item) => {
    if (item.type === "link") {
      return !item.roles || item.roles.includes(role);
    }
    if (item.roles && !item.roles.includes(role)) return false;
    return filterGroupChildren(item, role).length > 0;
  });
}

export function filterGroupChildren(
  group: NavGroupItem,
  role: string
): NavGroupItem["children"] {
  return group.children.filter((c) => !c.roles || c.roles.includes(role));
}

export function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/hoje") {
    return pathname === "/dashboard/hoje";
  }
  if (href === "/dashboard/pendencias") {
    return pathname === "/dashboard/pendencias" || pathname.startsWith("/dashboard/pendencias/");
  }
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/atendimento") {
    return (
      pathname === href ||
      pathname.startsWith("/dashboard/agenda/atendimento")
    );
  }
  if (href === "/dashboard/agenda") {
    return pathname === "/dashboard/agenda";
  }
  if (href === "/dashboard/hoje/agendamentos") {
    return pathname.startsWith("/dashboard/hoje/agendamentos");
  }
  if (href === "/dashboard/hoje/consultas") {
    return pathname.startsWith("/dashboard/hoje/consultas");
  }
  if (href === "/dashboard/hoje/pacientes") {
    return pathname.startsWith("/dashboard/hoje/pacientes");
  }
  if (href === "/dashboard/consulta") {
    return (
      pathname === "/dashboard/consulta" ||
      pathname.startsWith("/dashboard/agenda/consulta/")
    );
  }
  if (href === "/dashboard/mensagens") {
    return pathname === "/dashboard/mensagens";
  }
  if (href === "/dashboard/mensagens/pendentes") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (
    href === "/dashboard/financeiro" ||
    href === "/dashboard/vendas" ||
    href === "/dashboard/estoque" ||
    href === "/dashboard/instrucoes"
  ) {
    return pathname === href;
  }
  if (href.startsWith("/dashboard/atendimentos/")) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (href === "/dashboard/configuracoes/campos-personalizados") {
    return (
      pathname === href ||
      pathname.startsWith("/dashboard/formularios") ||
      pathname.startsWith("/dashboard/campos-pacientes")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getNavGroupById(id: string): NavGroupItem | undefined {
  if (id === "configuracoes") return DASHBOARD_CONFIG_GROUP;
  if (id === "instrucoes") return DASHBOARD_INSTRUCOES_GROUP;
  if (id === "servicos-valores") return DASHBOARD_SERVICOS_VALORES_GROUP;
  const topGroup = TOP_NAV_GROUPS.find((g) => g.id === id);
  if (topGroup) return topGroup;
  return DASHBOARD_MIDDLE_NAV_GROUPS.find((g) => g.id === id);
}
