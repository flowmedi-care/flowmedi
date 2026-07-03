import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // microphone=(self) necessário para transcrição clínica no atendimento
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/dashboard/pacientes", destination: "/dashboard/contatos/pacientes", permanent: true },
      { source: "/dashboard/pacientes/:path*", destination: "/dashboard/contatos/pacientes/:path*", permanent: true },
      { source: "/dashboard/equipe", destination: "/dashboard/contatos/profissionais", permanent: true },
      {
        source: "/dashboard/campos-pacientes",
        destination: "/dashboard/configuracoes/campos-personalizados",
        permanent: true,
      },
      {
        source: "/dashboard/formularios",
        destination: "/dashboard/crm/captacao",
        permanent: false,
      },
      {
        source: "/dashboard/formularios/novo",
        destination: "/dashboard/crm/captacao/novo",
        permanent: false,
      },
      {
        source: "/dashboard/formularios/:id/editar",
        destination: "/dashboard/crm/captacao/:id/editar",
        permanent: false,
      },
      {
        source: "/dashboard/configuracoes/catalogo-clinico",
        destination: "/dashboard/configuracoes/campos-personalizados",
        permanent: true,
      },
      {
        source: "/dashboard/configuracoes/procedimentos",
        destination: "/dashboard/servicos-valores/procedimentos",
        permanent: true,
      },
      {
        source: "/dashboard/servicos-valores",
        has: [{ type: "query", key: "tab", value: "procedimentos" }],
        destination: "/dashboard/servicos-valores/procedimentos",
        permanent: true,
      },
      { source: "/dashboard/plano", destination: "/dashboard/configuracoes/assinatura", permanent: true },
      { source: "/dashboard/configuracoes", destination: "/dashboard/configuracoes/preferencias", permanent: false },
    ];
  },
};

export default nextConfig;
