import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
        destination: "/dashboard/configuracoes/campos-personalizados?tab=formularios",
        permanent: false,
      },
      {
        source: "/dashboard/configuracoes/catalogo-clinico",
        destination: "/dashboard/configuracoes/campos-personalizados",
        permanent: true,
      },
      {
        source: "/dashboard/configuracoes/procedimentos",
        destination: "/dashboard/servicos-valores?tab=procedimentos",
        permanent: true,
      },
      { source: "/dashboard/plano", destination: "/dashboard/configuracoes/assinatura", permanent: true },
      { source: "/dashboard/configuracoes", destination: "/dashboard/configuracoes/preferencias", permanent: false },
    ];
  },
};

export default nextConfig;
