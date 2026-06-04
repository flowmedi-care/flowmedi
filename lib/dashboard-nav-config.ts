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
  | "settings"
  | "shield-check"
  | "cake"
  | "truck"
  | "contact"
  | "file-edit"
  | "plug";

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
  children: { href: string; label: string; roles?: string[] }[];
};

export const DASHBOARD_TOP_NAV: NavLinkItem[] = [
  { type: "link", href: "/dashboard", label: "Início", icon: "layout-dashboard" },
  { type: "link", href: "/dashboard/agenda", label: "Agenda", icon: "calendar" },
  {
    type: "link",
    href: "/dashboard/consulta",
    label: "Consultas",
    icon: "calendar-days",
    roles: ["admin", "secretaria", "medico"],
  },
  {
    type: "link",
    href: "/dashboard/atendimento",
    label: "Atendimento",
    icon: "clipboard-list",
    roles: ["admin", "secretaria", "medico"],
  },
  { type: "link", href: "/dashboard/eventos", label: "Eventos", icon: "bell", roles: ["admin", "secretaria"] },
  { type: "link", href: "/dashboard/mensagens", label: "Mensagens", icon: "mail", roles: ["admin"] },
  {
    type: "link",
    href: "/dashboard/whatsapp",
    label: "WhatsApp",
    icon: "message-square",
    badgeKey: "whatsapp",
  },
];

export const DASHBOARD_MIDDLE_NAV_GROUPS: NavGroupItem[] = [
  {
    type: "group",
    id: "contatos",
    label: "Contatos",
    icon: "contact",
    prefix: "/dashboard/contatos",
    children: [
      { href: "/dashboard/contatos/pacientes", label: "Pacientes" },
      { href: "/dashboard/contatos/profissionais", label: "Profissionais" },
      { href: "/dashboard/contatos/fornecedores", label: "Fornecedores", roles: ["admin", "secretaria"] },
      { href: "/dashboard/contatos/leads", label: "Leads", roles: ["admin", "secretaria"] },
      { href: "/dashboard/contatos/todos", label: "Todos contatos" },
      { href: "/dashboard/contatos/aniversariantes", label: "Aniversariantes" },
    ],
  },
  {
    type: "group",
    id: "crm",
    label: "CRM",
    icon: "target",
    prefix: "/dashboard/crm",
    roles: ["admin", "secretaria"],
    children: [
      { href: "/dashboard/crm/pipeline", label: "Pipeline" },
      { href: "/dashboard/crm/captacao", label: "Formulários de captação" },
      { href: "/dashboard/crm/funil", label: "Funil de consultas" },
    ],
  },
  {
    type: "group",
    id: "atendimentos",
    label: "Atendimentos",
    icon: "stethoscope",
    prefix: "/dashboard/atendimentos",
    roles: ["admin", "secretaria", "medico"],
    children: [
      { href: "/dashboard/atendimentos", label: "Visão geral" },
      { href: "/dashboard/atendimentos/prescricoes", label: "Prescrições" },
      { href: "/dashboard/atendimentos/pedidos-exame", label: "Pedidos de exame" },
      { href: "/dashboard/atendimentos/atestados", label: "Atestados" },
      { href: "/dashboard/atendimentos/sadt", label: "Guia SP / SADT" },
    ],
  },
  {
    type: "group",
    id: "vendas",
    label: "Vendas",
    icon: "shopping-cart",
    prefix: "/dashboard/vendas",
    roles: ["admin", "secretaria"],
    children: [
      { href: "/dashboard/vendas", label: "Visão geral" },
      { href: "/dashboard/vendas/relatorio", label: "Relatório de vendas" },
      { href: "/dashboard/vendas/pacotes", label: "Relatório de pacotes" },
      { href: "/dashboard/vendas/orcamentos", label: "Orçamentos" },
      { href: "/dashboard/vendas/notas-fiscais", label: "Notas fiscais" },
    ],
  },
  {
    type: "group",
    id: "financeiro",
    label: "Financeiro",
    icon: "wallet",
    prefix: "/dashboard/financeiro",
    roles: ["admin", "secretaria"],
    children: [
      { href: "/dashboard/financeiro", label: "Visão geral" },
      { href: "/dashboard/financeiro/receber", label: "Contas a receber" },
      { href: "/dashboard/financeiro/pagar", label: "Contas a pagar" },
      { href: "/dashboard/financeiro/extrato", label: "Extrato" },
      { href: "/dashboard/financeiro/competencia", label: "Competência" },
      { href: "/dashboard/financeiro/fluxo-diario", label: "Fluxo diário" },
      { href: "/dashboard/financeiro/fluxo-mensal", label: "Fluxo mensal" },
      { href: "/dashboard/financeiro/dre", label: "DRE" },
    ],
  },
];

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
    { href: "/dashboard/configuracoes/integracoes", label: "Integrações" },
    { href: "/dashboard/configuracoes/campos-personalizados", label: "Campos personalizados" },
    { href: "/dashboard/configuracoes/assinatura", label: "Assinatura" },
    { href: "/dashboard/configuracoes/site", label: "Site da clínica" },
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
    href: "/dashboard/estoque",
    label: "Estoque",
    icon: "package",
    roles: ["admin", "secretaria"],
  },
  {
    type: "link",
    href: "/dashboard/servicos-valores",
    label: "Serviços e Valores",
    icon: "circle-dollar-sign",
    roles: ["admin", "medico"],
  },
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

export const LEGACY_PATH_PREFIXES: Record<string, string> = {
  "/dashboard/pacientes": "contatos",
  "/dashboard/equipe": "contatos",
  "/dashboard/campos-pacientes": "configuracoes",
  "/dashboard/formularios": "configuracoes",
  "/dashboard/plano": "configuracoes",
};

export function getActiveNavGroupId(pathname: string): string | null {
  if (
    pathname === DASHBOARD_CONFIG_GROUP.prefix ||
    pathname.startsWith(`${DASHBOARD_CONFIG_GROUP.prefix}/`)
  ) {
    return "configuracoes";
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

export function filterGroupChildren(
  group: NavGroupItem,
  role: string
): NavGroupItem["children"] {
  return group.children.filter((c) => !c.roles || c.roles.includes(role));
}

export function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/atendimento") {
    return (
      pathname === href ||
      pathname.startsWith("/dashboard/agenda/atendimento")
    );
  }
  if (
    href === "/dashboard/financeiro" ||
    href === "/dashboard/vendas" ||
    href === "/dashboard/atendimentos"
  ) {
    return pathname === href;
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
  return DASHBOARD_MIDDLE_NAV_GROUPS.find((g) => g.id === id);
}
