"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConsultaDetalheClient } from "./consulta-detalhe-client";
import { ExamesClient } from "../../../exames/exames-client";
import { cn } from "@/lib/utils";
import type { FormInstanceItem } from "./page";

type Tab = "consulta" | "paciente" | "formularios" | "exames";

export function ConsultaTabsClient({
  appointmentId,
  appointmentStatus,
  appointmentScheduledAt,
  patientId,
  patientData,
  formInstances,
  baseUrl,
  canEdit,
}: {
  appointmentId: string;
  appointmentStatus: string;
  appointmentScheduledAt: string;
  patientId: string;
  patientData: {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    birth_date?: string | null;
  };
  formInstances: FormInstanceItem[];
  baseUrl: string;
  canEdit: boolean;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("consulta");

  const tabs: { id: Tab; label: string }[] = [
    { id: "consulta", label: "Consulta" },
    { id: "paciente", label: "Paciente" },
    { id: "formularios", label: "Formulários" },
    { id: "exames", label: "Exames" },
  ];

  return (
    <div className="space-y-4">
      {/* Abas */}
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

      {/* Conteúdo das Abas */}
      <div className="min-h-[400px]">
        {activeTab === "consulta" && (
          <ConsultaDetalheClient
            appointmentId={appointmentId}
            appointmentStatus={appointmentStatus}
            appointmentScheduledAt={appointmentScheduledAt}
            formInstances={formInstances}
            baseUrl={baseUrl}
            canEdit={canEdit}
          />
        )}

        {activeTab === "paciente" && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome completo</p>
                <p className="font-medium text-lg">{patientData.full_name}</p>
              </div>
              {patientData.email && (
                <div>
                  <p className="text-sm text-muted-foreground">E-mail</p>
                  <p className="font-medium">{patientData.email}</p>
                </div>
              )}
              {patientData.phone && (
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{patientData.phone}</p>
                </div>
              )}
              {patientData.birth_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Data de nascimento</p>
                  <p className="font-medium">
                    {new Date(patientData.birth_date).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                  {(() => {
                    const birthDate = new Date(patientData.birth_date);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                      age--;
                    }
                    return (
                      <p className="text-sm text-muted-foreground mt-1">
                        Idade: {age} {age === 1 ? "ano" : "anos"}
                      </p>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "formularios" && (
          <div className="space-y-4">
            <h2 className="font-semibold">Formulários</h2>
            {formInstances.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhum formulário vinculado a esta consulta.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {formInstances.map((fi) => {
                  const isExpanded = true; // Sempre expandido na aba
                  return (
                    <Card key={fi.id}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{fi.template_name}</h3>
                          <Badge
                            variant={
                              fi.status === "respondido"
                                ? "success"
                                : fi.status === "incompleto"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {fi.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-3 border-t border-border">
                        {fi.definition.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">
                            Sem campos definidos.
                          </p>
                        ) : (
                          fi.definition.map((field) => (
                            <div key={field.id}>
                              <p className="text-sm text-muted-foreground">
                                {field.label}
                              </p>
                              <p className="font-medium">
                                {(() => {
                                  const value = fi.responses[field.id];
                                  if (value == null || value === "") return "—";
                                  if (field.type === "multiple_choice" && Array.isArray(value)) {
                                    return value.join(", ");
                                  }
                                  if (field.type === "date" && typeof value === "string") {
                                    try {
                                      return new Date(value).toLocaleDateString("pt-BR");
                                    } catch {
                                      return value;
                                    }
                                  }
                                  return String(value);
                                })()}
                              </p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "exames" && (
          <ExamesClient
            patientId={patientId}
            appointmentId={appointmentId}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}
