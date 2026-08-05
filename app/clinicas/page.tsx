import type { Metadata } from "next";
import { ClinicasLanding } from "@/components/landing/clinicas/landing";

export const metadata: Metadata = {
  title: "FlowMed para clínicas de estética",
  description:
    "Plataforma que centraliza atendimento, agenda, pacientes e automações para clínicas de estética. Conheça em uma demonstração.",
  openGraph: {
    title: "FlowMed para clínicas de estética",
    description:
      "Centralize atendimento, agenda e pacientes em um único lugar. Criado para clínicas de estética.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function ClinicasPage() {
  return <ClinicasLanding />;
}
