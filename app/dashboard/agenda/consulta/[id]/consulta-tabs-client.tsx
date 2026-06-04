"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConsultaDetalheClient } from "./consulta-detalhe-client";
import { ExamesClient } from "../../../exames/exames-client";
import { FormulariosConsultaClient } from "./formularios-consulta-client";
import { AtendimentoClient } from "./atendimento-client";
import { CheckInPaymentPolicy } from "./check-in-payment-policy";
import { formatPhoneBr } from "@/lib/format-phone";
import { cn } from "@/lib/utils";
import type { FormInstanceItem } from "./page";

type Tab = "operacional" | "consulta" | "paciente" | "formularios" | "exames";

export function ConsultaTabsClient({
  appointmentId,
  appointmentValor,
  appointmentStatus,
  appointmentScheduledAt,
  startedAt,
  completedAt,
  durationMinutes,
  doctorId,
  patientId,
  patientData,
  formInstances,
  baseUrl,
  canEdit,
  canEditOperacional,
  isDoctor,
  currentUserId,
}: {
  appointmentId: string;
  appointmentValor: number | null;
  appointmentStatus: string;
  appointmentScheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  doctorId: string | null;
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
  canEditOperacional: boolean;
  isDoctor: boolean;
  currentUserId: string | null;
}) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("consulta");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (
      tab === "operacional" ||
      tab === "formularios" ||
      tab === "paciente" ||
      tab === "exames" ||
      tab === "consulta"
    ) {
      setActiveTab(tab as Tab);
    }
  }, [searchParams]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "operacional", label: "Operacional" },
    { id: "consulta", label: "Consulta" },
    { id: "paciente", label: "Paciente" },
    { id: "formularios", label: "Formulários" },
    { id: "exames", label: "Arquivos" },
  ];

  return (
    <div className="space-y-4">
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

      <div className="min-h-[400px]">
        {activeTab === "operacional" && (
          <div className="space-y-4">
            <CheckInPaymentPolicy
              appointmentId={appointmentId}
              canEdit={canEdit && !isDoctor}
            />
            <AtendimentoClient
              appointmentId={appointmentId}
              appointmentValor={appointmentValor}
              canEdit={canEditOperacional}
              autoFinalize={searchParams.get("operacional") === "1"}
              mode="full"
            />
          </div>
        )}

        {activeTab !== "operacional" && (
          <div className="mb-4 rounded-lg border bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              Anamnese, evolução, receita e pedidos de exame estão na página de{" "}
              <strong>Atendimento</strong> clínico.
            </p>
            <Button size="sm" asChild>
              <Link href={`/dashboard/agenda/atendimento/${appointmentId}`}>
                Ir para Atendimento clínico
              </Link>
            </Button>
          </div>
        )}

        {activeTab === "consulta" && (
          <ConsultaDetalheClient
            appointmentId={appointmentId}
            appointmentStatus={appointmentStatus}
            appointmentScheduledAt={appointmentScheduledAt}
            startedAt={startedAt}
            completedAt={completedAt}
            durationMinutes={durationMinutes}
            doctorId={doctorId}
            formInstances={formInstances}
            baseUrl={baseUrl}
            canEdit={canEdit}
            isDoctor={isDoctor}
            currentUserId={currentUserId}
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
                  <p className="font-medium">{formatPhoneBr(patientData.phone)}</p>
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
                    if (
                      monthDiff < 0 ||
                      (monthDiff === 0 && today.getDate() < birthDate.getDate())
                    ) {
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
          <FormulariosConsultaClient
            appointmentId={appointmentId}
            formInstances={formInstances}
            isDoctor={isDoctor}
            canEdit={canEdit}
          />
        )}

        {activeTab === "exames" && (
          <ExamesClient patientId={patientId} appointmentId={appointmentId} canEdit={canEdit} />
        )}
      </div>
    </div>
  );
}
