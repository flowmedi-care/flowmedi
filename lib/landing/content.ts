import {
  BarChart3,
  Calendar,
  CreditCard,
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
  { label: "Feito para o Brasil", description: "Clínicas e consultórios" },
] as const;

export interface LandingFeature {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  bullets?: string[];
}

export const LANDING_FEATURES: LandingFeature[] = [
  {
    id: "agenda",
    icon: Calendar,
    title: "Agenda central",
    description:
      "Visualização diária, semanal e mensal por profissional. Status de consulta, confirmações e controle de faltas.",
    bullets: ["Multi-profissional", "Status em tempo real", "Visão da equipe"],
  },
  {
    id: "formularios",
    icon: FileText,
    title: "Formulários clínicos",
    description:
      "Construtor de formulários personalizados vinculados a tipos de consulta. Respostas acessíveis no painel do profissional.",
    bullets: ["Templates customizáveis", "Pré-consulta online", "Histórico do paciente"],
  },
  {
    id: "comunicacao",
    icon: MessageSquare,
    title: "Comunicação",
    description:
      "Envio de links de formulário e lembretes. WhatsApp e e-mail transacionais no plano Profissional.",
    bullets: ["Lembretes automáticos", "WhatsApp integrado", "E-mail transacional"],
  },
  {
    id: "site-publico",
    icon: Globe,
    title: "Site público da clínica",
    description:
      "Landing premium personalizável com cores, equipe, especialidades e domínio próprio via subdomínio.",
    bullets: ["Marca da clínica", "Subdomínio dedicado", "SEO otimizado"],
  },
  {
    id: "agendamento",
    icon: Calendar,
    title: "Agendamento online",
    description:
      "Pacientes agendam consultas pelo site público, escolhendo procedimento, profissional e horário disponível.",
    bullets: ["Wizard de agendamento", "Catálogo de procedimentos", "Confirmação automática"],
  },
  {
    id: "papeis",
    icon: Users,
    title: "Papéis de acesso",
    description:
      "Admin, Secretário(a) e Profissional com permissões distintas. Cada perfil vê apenas o que precisa.",
    bullets: ["Controle granular", "Multiusuário", "Auditoria de acesso"],
  },
  {
    id: "relatorios",
    icon: BarChart3,
    title: "Relatórios",
    description:
      "Acompanhe agenda, performance da equipe e indicadores operacionais em dashboards claros.",
    bullets: ["Visão analítica", "Exportação", "Métricas da clínica"],
  },
  {
    id: "privacidade",
    icon: Shield,
    title: "Privacidade e LGPD",
    description:
      "Registro de consentimento, isolamento de dados por clínica e canal para solicitações de titulares.",
    bullets: ["Isolamento por clínica", "Canal do titular", "Documentação legal"],
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
  { icon: MessageCircle, name: "WhatsApp", description: "Comunicação transacional" },
  { icon: Mail, name: "E-mail", description: "Lembretes e notificações" },
  { icon: CreditCard, name: "Stripe", description: "Pagamentos e assinaturas" },
] as const;

export const PRICING_FAQ = [
  {
    id: "trial",
    question: "Posso testar antes de pagar?",
    answer:
      "Sim. Você pode criar uma conta gratuita e explorar a plataforma. Não é necessário cartão de crédito para começar.",
  },
  {
    id: "cancel",
    question: "Tem fidelidade ou multa de cancelamento?",
    answer:
      "Não. Todos os planos são sem fidelidade. Você pode cancelar a assinatura a qualquer momento pelo painel.",
  },
  {
    id: "upgrade",
    question: "Posso mudar de plano depois?",
    answer:
      "Sim. Você pode fazer upgrade ou downgrade do plano a qualquer momento. A cobrança é ajustada proporcionalmente.",
  },
  {
    id: "data",
    question: "O que acontece com meus dados se eu cancelar?",
    answer:
      "Seus dados permanecem disponíveis por um período após o cancelamento para exportação. Consulte nossa política de privacidade para detalhes.",
  },
  {
    id: "support",
    question: "Como funciona o suporte?",
    answer:
      "O suporte está disponível por e-mail. Planos superiores incluem suporte prioritário conforme descrito em cada plano.",
  },
] as const;

export const HERO_SCREEN_IMAGES = {
  dashboard: "/landing/screen-dashboard.png",
  crm: "/landing/screen-crm.png",
  chat: "/landing/screen-chat.png",
  reports: "/landing/screen-reports.png",
} as const;

export const CONTACT_EMAIL = "privacidade@flowmed.app";
