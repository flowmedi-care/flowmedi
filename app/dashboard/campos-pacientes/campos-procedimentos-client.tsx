"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CamposPacientesClient, type CustomFieldRow } from "./campos-pacientes-client";
import { ClinicalFichasConfigClient } from "./clinical-fichas-config-client";
import type { ClinicalFichaTemplateRow } from "./clinical-fichas-actions";
import { Plus } from "lucide-react";
import Link from "next/link";
import { FormulariosListClient } from "@/app/dashboard/formularios/formularios-list-client";
import { cn } from "@/lib/utils";

type Tab = "paciente" | "fichas" | "formularios";

type FormTemplateRow = {
  id: string;
  name: string;
  appointment_type_name: string | null;
  is_public: boolean;
};

export function CamposProcedimentosClient({
  initialFields,
  fichaTemplates,
  formTemplates,
  formPatients,
  initialTab,
}: {
  initialFields: CustomFieldRow[];
  fichaTemplates: ClinicalFichaTemplateRow[];
  formTemplates?: FormTemplateRow[];
  formPatients?: { id: string; full_name: string }[];
  initialTab?: Tab;
}) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "paciente");

  const tabs: { id: Tab; label: string }[] = [
    { id: "paciente", label: "Campos de paciente" },
    { id: "fichas", label: "Fichas de atendimento" },
    { id: "formularios", label: "Formulários" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Campos personalizados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Campos do paciente, fichas e formulários da clínica. Procedimentos e serviços são configurados em Serviços e valores.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        {activeTab === "paciente" && (
          <CamposPacientesClient initialFields={initialFields} />
        )}
        {activeTab === "fichas" && (
          <ClinicalFichasConfigClient initialTemplates={fichaTemplates} />
        )}
        {activeTab === "formularios" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Formulários de pré-consulta e captação vinculados aos atendimentos.
              </p>
              <Link href="/dashboard/formularios/novo">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo formulário
                </Button>
              </Link>
            </div>
            {formTemplates && formPatients ? (
              <FormulariosListClient
                templates={formTemplates}
                patients={formPatients}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Carregando formulários…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
