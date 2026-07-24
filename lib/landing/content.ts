import {
  BarChart3,
  Bot,
  Calendar,
  FileText,
  Globe,
  Lock,
  Mail,
  MessageCircle,
  MessageSquare,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";

export const PUBLIC_NAV_LINKS = [
  { href: "/recursos", label: "Recursos" },
  { href: "/precos", label: "Preços" },
  { href: "/seguranca", label: "Segurança" },
  { href: "/sugestoes", label: "Sugestões" },
] as const;

export const TRUST_ITEMS = [
  { label: "100% na nuvem", description: "Acesse de qualquer lugar" },
  { label: "LGPD nativo", description: "Privacidade desde o design" },
  { label: "Sem fidelidade", description: "Cancele quando quiser" },
  { label: "Pronto em minutos", description: "Sem instalação complicada" },
] as const;

/** Mini visual used inside feature detail cards */
export type FeatureDetailVisual =
  | "calendar-grid"
  | "status-row"
  | "team-avatars"
  | "form-fields"
  | "checklist"
  | "patient-card"
  | "message-bubbles"
  | "reminder"
  | "whatsapp"
  | "site-preview"
  | "brand-swatch"
  | "search-rank"
  | "booking-steps"
  | "procedure-list"
  | "confirm-check"
  | "role-badges"
  | "permission-toggles"
  | "access-log"
  | "chart-bars"
  | "export-sheet"
  | "kpi-tiles"
  | "lock-shield"
  | "consent"
  | "legal-docs"
  | "rights-inbox";

export interface FeatureDetail {
  title: string;
  description: string;
  visual: FeatureDetailVisual;
}

export interface LandingFeature {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  details: FeatureDetail[];
}

export const LANDING_FEATURES: LandingFeature[] = [
  {
    id: "agenda",
    icon: Calendar,
    title: "Agenda central",
    description:
      "Veja o dia, a semana ou o mês de cada profissional. Acompanhe confirmações, faltas e o status de cada consulta em um só lugar.",
    details: [
      {
        title: "Visão por dia, semana ou mês",
        description: "Troque o período e enxergue a agenda inteira sem planilha.",
        visual: "calendar-grid",
      },
      {
        title: "Status de cada consulta",
        description: "Confirmada, aguardando, em andamento ou faltou — tudo claro.",
        visual: "status-row",
      },
      {
        title: "Vários profissionais",
        description: "Cada médico ou especialista com a própria grade de horários.",
        visual: "team-avatars",
      },
      {
        title: "Visão da equipe",
        description: "A recepção acompanha quem está atendendo e quem está livre.",
        visual: "team-avatars",
      },
    ],
  },
  {
    id: "formularios",
    icon: FileText,
    title: "Formulários clínicos",
    description:
      "Monte questionários do seu jeito e vincule a cada tipo de consulta. O paciente preenche antes e o profissional já vê as respostas no painel.",
    details: [
      {
        title: "Modelos do seu jeito",
        description: "Crie formulários com os campos que a sua clínica precisa.",
        visual: "form-fields",
      },
      {
        title: "Pré-consulta online",
        description: "O paciente responde em casa, pelo celular, antes de chegar.",
        visual: "checklist",
      },
      {
        title: "Histórico do paciente",
        description: "Respostas antigas ficam salvas e fáceis de consultar.",
        visual: "patient-card",
      },
      {
        title: "Ligados à consulta",
        description: "Cada tipo de atendimento pode ter o seu próprio formulário.",
        visual: "form-fields",
      },
    ],
  },
  {
    id: "comunicacao",
    icon: MessageSquare,
    title: "Comunicação",
    description:
      "Envie links de formulário e lembretes sem esforço. No plano Profissional, use WhatsApp e e-mail para falar com o paciente no momento certo.",
    details: [
      {
        title: "Lembretes automáticos",
        description: "Avisos de consulta no horário certo, sem a equipe precisar lembrar.",
        visual: "reminder",
      },
      {
        title: "WhatsApp integrado",
        description: "Mensagens pelo canal que o paciente já usa no dia a dia.",
        visual: "whatsapp",
      },
      {
        title: "E-mails automáticos",
        description: "Confirmações e avisos enviados por e-mail quando precisar.",
        visual: "message-bubbles",
      },
      {
        title: "Links de formulário",
        description: "Mande o questionário em um toque, direto no celular do paciente.",
        visual: "checklist",
      },
    ],
  },
  {
    id: "site-publico",
    icon: Globe,
    title: "Site público da clínica",
    description:
      "Uma página profissional com as cores da clínica, equipe, especialidades e endereço próprio — pronta para receber pacientes online.",
    details: [
      {
        title: "Com a cara da clínica",
        description: "Logo, cores e textos alinhados à sua marca.",
        visual: "brand-swatch",
      },
      {
        title: "Endereço próprio",
        description: "Sua clínica em um link fácil de lembrar, tipo clinica.flowmedi.com.",
        visual: "site-preview",
      },
      {
        title: "Fácil de achar no Google",
        description: "Página pensada para aparecer quando alguém busca a clínica.",
        visual: "search-rank",
      },
      {
        title: "Equipe e especialidades",
        description: "Mostre quem atende e o que a clínica oferece, com clareza.",
        visual: "team-avatars",
      },
    ],
  },
  {
    id: "agendamento",
    icon: Calendar,
    title: "Agendamento online",
    description:
      "O paciente marca a consulta pelo site: escolhe o procedimento, o profissional e o horário livre — sem ligar para a recepção.",
    details: [
      {
        title: "Passo a passo simples",
        description: "O paciente avança em etapas curtas até confirmar o horário.",
        visual: "booking-steps",
      },
      {
        title: "Lista de procedimentos",
        description: "Mostre o que a clínica oferece e deixe a escolha clara.",
        visual: "procedure-list",
      },
      {
        title: "Só horários livres",
        description: "A agenda mostra apenas o que realmente está disponível.",
        visual: "calendar-grid",
      },
      {
        title: "Confirmação na hora",
        description: "Assim que marca, o paciente já recebe a confirmação.",
        visual: "confirm-check",
      },
    ],
  },
  {
    id: "papeis",
    icon: Users,
    title: "Papéis de acesso",
    description:
      "Admin, secretário(a) e profissional com permissões diferentes. Cada pessoa vê só o que precisa para o seu trabalho.",
    details: [
      {
        title: "Perfis prontos",
        description: "Admin, secretaria e profissional — cada um com o seu lugar.",
        visual: "role-badges",
      },
      {
        title: "Permissões por perfil",
        description: "Defina o que cada tipo de usuário pode ver e fazer.",
        visual: "permission-toggles",
      },
      {
        title: "Vários usuários",
        description: "Toda a equipe na mesma clínica, cada um com o próprio login.",
        visual: "team-avatars",
      },
      {
        title: "Registro de quem acessou",
        description: "Saiba quem entrou e o que foi alterado, quando precisar.",
        visual: "access-log",
      },
    ],
  },
  {
    id: "relatorios",
    icon: BarChart3,
    title: "Relatórios",
    description:
      "Acompanhe agenda, desempenho da equipe e números da operação em painéis fáceis de ler — sem complicação.",
    details: [
      {
        title: "Números claros",
        description: "Gráficos e totais que mostram como a clínica está andando.",
        visual: "chart-bars",
      },
      {
        title: "Exportar quando quiser",
        description: "Baixe os dados para usar em planilha ou reunião.",
        visual: "export-sheet",
      },
      {
        title: "Indicadores da clínica",
        description: "Consultas, faltas e ocupação em um olhar rápido.",
        visual: "kpi-tiles",
      },
      {
        title: "Performance da equipe",
        description: "Veja como cada profissional está na agenda e nos atendimentos.",
        visual: "team-avatars",
      },
    ],
  },
  {
    id: "privacidade",
    icon: Shield,
    title: "Privacidade e LGPD",
    description:
      "Consentimento registrado, dados separados por clínica e um canal para o paciente exercer seus direitos — tudo já preparado.",
    details: [
      {
        title: "Dados separados por clínica",
        description: "As informações da sua clínica não se misturam com as de outras.",
        visual: "lock-shield",
      },
      {
        title: "Consentimento registrado",
        description: "Guarde quando o paciente autorizou o uso dos dados.",
        visual: "consent",
      },
      {
        title: "Documentos legais prontos",
        description: "Políticas e termos acessíveis, sem precisar inventar do zero.",
        visual: "legal-docs",
      },
      {
        title: "Canal do paciente",
        description: "Espaço para pedidos de acesso, correção ou exclusão de dados.",
        visual: "rights-inbox",
      },
    ],
  },
];

export interface ModuleSpotlight {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  cta: { label: string; href: string };
  image: string;
  imageAlt: string;
}

export const MODULE_SPOTLIGHTS: ModuleSpotlight[] = [
  {
    id: "chat-ia",
    eyebrow: "Comunicação inteligente",
    title: "Chat IA e WhatsApp integrados",
    description:
      "Automatize respostas frequentes e mantenha o atendimento humanizado. A equipe acompanha conversas e intervém quando necessário.",
    bullets: [
      "Assistente virtual configurável",
      "WhatsApp no plano Profissional",
      "Histórico centralizado",
    ],
    cta: { label: "Conhecer recursos", href: "/recursos#comunicacao" },
    image: "/landing/spotlight-chat.svg",
    imageAlt: "Interface de chat e comunicação FlowMed",
  },
  {
    id: "site-clinica",
    eyebrow: "Presença digital",
    title: "Site premium com agendamento online",
    description:
      "Cada clínica ganha uma página pública profissional com equipe, especialidades, FAQ e agendamento integrado — sem precisar de outro sistema.",
    bullets: [
      "Personalização de cores e logo",
      "Subdomínio slug.flowmedi.com",
      "Agendamento em poucos cliques",
    ],
    cta: { label: "Ver como funciona", href: "/recursos#site-publico" },
    image: "/landing/spotlight-site.svg",
    imageAlt: "Site público de clínica no FlowMed",
  },
  {
    id: "lgpd",
    eyebrow: "Conformidade",
    title: "LGPD pensada para clínicas",
    description:
      "Isolamento de dados por clínica, registro de consentimento e documentação legal completa. Seus pacientes e sua operação protegidos.",
    bullets: [
      "Políticas e termos prontos",
      "Canal do titular de dados",
      "Subprocessadores documentados",
    ],
    cta: { label: "Saiba sobre segurança", href: "/seguranca" },
    image: "/landing/spotlight-security.svg",
    imageAlt: "Segurança e conformidade LGPD",
  },
];

export interface Persona {
  id: string;
  role: string;
  subtitle: string;
  bullets: string[];
}

export const PERSONAS: Persona[] = [
  {
    id: "admin",
    role: "Admin",
    subtitle: "Configura clínica, plano e equipe",
    bullets: ["Gestão de usuários e permissões", "Configuração do site público", "Plano e faturamento"],
  },
  {
    id: "secretario",
    role: "Secretário(a)",
    subtitle: "Agenda, formulários e comunicação",
    bullets: ["Agendamento e confirmações", "Envio de formulários pré-consulta", "Atendimento ao paciente"],
  },
  {
    id: "profissional",
    role: "Profissional",
    subtitle: "Agenda e dados do paciente",
    bullets: ["Visão da própria agenda", "Respostas de formulários clínicos", "Histórico do paciente"],
  },
];

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  clinic: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "1",
    quote:
      "O FlowMed simplificou nossa rotina. Agenda, formulários e comunicação em um só lugar — a equipe adotou em poucos dias.",
    author: "Dra. Ana Costa",
    role: "Dermatologista",
    clinic: "Clínica Derma Vida",
  },
  {
    id: "2",
    quote:
      "O site público com agendamento online reduziu ligações na recepção. Os pacientes agendam sozinhos e chegam com o formulário preenchido.",
    author: "Carlos Mendes",
    role: "Gestor administrativo",
    clinic: "Centro Médico Horizonte",
  },
  {
    id: "3",
    quote:
      "A conformidade com LGPD era nossa maior preocupação. O FlowMed já vem com políticas, consentimento e canal do titular prontos.",
    author: "Dra. Marina Silva",
    role: "Diretora clínica",
    clinic: "Instituto Saúde Integral",
  },
];

export const SECURITY_CARDS = [
  {
    icon: Lock,
    title: "Isolamento por clínica",
    description: "Cada clínica opera em ambiente isolado. Dados de pacientes não se misturam entre contas.",
  },
  {
    icon: Shield,
    title: "Consentimento registrado",
    description: "Registro de consentimento do titular com trilha de auditoria para conformidade.",
  },
  {
    icon: FileText,
    title: "Documentação legal",
    description: "Políticas de privacidade, termos, DPA e subprocessadores documentados e acessíveis.",
  },
  {
    icon: Users,
    title: "Canal do titular",
    description: "Portal para exercício de direitos LGPD com fluxo estruturado de atendimento.",
  },
] as const;

export const INTEGRATIONS = [
  { icon: MessageCircle, name: "WhatsApp", description: "Mensagens com pacientes" },
  { icon: Mail, name: "E-mail", description: "Lembretes e confirmações" },
  { icon: Bot, name: "Chat IA", description: "Atendimento automático no WhatsApp" },
] as const;

export const PRICING_FAQ = [
  {
    id: "card",
    question: "Preciso informar cartão para começar?",
    answer:
      "Não. Você pode criar a conta e explorar a plataforma sem cartão. O cartão só é pedido na hora de assinar um plano.",
  },
  {
    id: "cancel",
    question: "Tem fidelidade?",
    answer:
      "Não. Todos os planos são sem fidelidade. Você pode cancelar a assinatura a qualquer momento pelo painel.",
  },
  {
    id: "upgrade",
    question: "Posso mudar de plano?",
    answer:
      "Sim. Você pode mudar de plano a qualquer momento. A cobrança é ajustada proporcionalmente.",
  },
  {
    id: "data",
    question: "O que acontece com meus dados?",
    answer:
      "Seus dados permanecem disponíveis por um período após o cancelamento para exportação. Consulte nossa política de privacidade para detalhes.",
  },
] as const;

export const HERO_SCREEN_IMAGES = {
  dashboard: "/landing/screen-dashboard.png",
  crm: "/landing/screen-crm.png",
  chat: "/landing/screen-chat.png",
  reports: "/landing/screen-reports.png",
} as const;

export const CONTACT_EMAIL = "privacidade@flowmed.app";
