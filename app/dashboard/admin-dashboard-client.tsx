"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Stethoscope, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { SecretariaDashboardClient } from "./secretaria-dashboard-client";
import { MedicoDashboardClient } from "./medico-dashboard-client";
import type { PipelineItem } from "./pipeline/actions";
import type { DashboardPreferences } from "./preferences/actions";
import type { DoctorOption } from "./admin-dashboard";
import type { MedicoDashboardData } from "./medico-dashboard-actions";

type SecretariaData = {
  complianceAppointments: Array<{
    id: string;
    scheduled_at: string;
    patient: { full_name: string };
    doctor: { full_name: string | null };
  }>;
  complianceDays: number | null;
  metrics: {
    appointmentsToday: number;
    pipelineCount: number;
    pendingForms: number;
    complianceCount: number;
  } | null;
  upcomingAppointments: Array<{
    id: string;
    scheduled_at: string;
    patient: { full_name: string };
    doctor: { full_name: string | null };
    status: string;
  }>;
  pipelineItems: PipelineItem[];
  preferences: DashboardPreferences;
};

export function AdminDashboardClient({
  activeView,
  doctors,
  selectedDoctorId,
  secretariaData,
  medicoData,
  clinicId,
}: {
  activeView: "secretaria" | "medico";
  doctors: DoctorOption[];
  selectedDoctorId: string | null;
  secretariaData: SecretariaData;
  medicoData: MedicoDashboardData | null;
  clinicId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setView(view: "secretaria" | "medico", doctorId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    if (view === "medico" && doctorId) {
      params.set("doctorId", doctorId);
    } else if (view === "secretaria") {
      params.delete("doctorId");
    }
    router.push(`/dashboard?${params.toString()}`);
  }

  function setDoctor(doctorId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "medico");
    params.set("doctorId", doctorId);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex rounded-lg border border-border p-1 bg-muted/50">
          <Button
            variant={activeView === "secretaria" ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "gap-2",
              activeView === "secretaria" && "bg-background shadow-sm"
            )}
            onClick={() => setView("secretaria")}
          >
            <ClipboardList className="h-4 w-4" />
            Visão Secretaria
          </Button>
          <Button
            variant={activeView === "medico" ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "gap-2",
              activeView === "medico" && "bg-background shadow-sm"
            )}
            onClick={() => setView("medico", doctors[0]?.id)}
          >
            <Stethoscope className="h-4 w-4" />
            Visão Médico
          </Button>
        </div>
        {activeView === "medico" && doctors.length > 1 && (
          <select
            value={selectedDoctorId || ""}
            onChange={(e) => setDoctor(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                Dr(a). {d.full_name || "Sem nome"}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Conteúdo */}
      {activeView === "secretaria" && (
        <SecretariaDashboardClient
          complianceAppointments={secretariaData.complianceAppointments}
          complianceDays={secretariaData.complianceDays}
          metrics={secretariaData.metrics}
          upcomingAppointments={secretariaData.upcomingAppointments}
          pipelineItems={secretariaData.pipelineItems}
          preferences={secretariaData.preferences}
        />
      )}

      {activeView === "medico" && selectedDoctorId && medicoData && (
        <MedicoDashboardClient
          appointments={medicoData.appointments}
          pendingForms={medicoData.pendingForms}
          metrics={{
            totalToday: medicoData.metrics.totalToday,
            total: medicoData.metrics.totalToday,
            completed: medicoData.metrics.completed,
            remaining: medicoData.metrics.remaining,
            pendingForms: medicoData.metrics.pendingForms,
          }}
          nextAppointment={medicoData.nextAppointment}
          doctorId={selectedDoctorId}
          clinicId={clinicId}
        />
      )}

      {activeView === "medico" && doctors.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          <p className="font-medium">Nenhum médico cadastrado</p>
          <p className="text-sm mt-1">
            Convide um médico na aba Equipe para visualizar o dashboard de médico.
          </p>
        </div>
      )}

      {activeView === "medico" &&
        doctors.length > 0 &&
        selectedDoctorId &&
        !medicoData && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            <p>Carregando dados do médico...</p>
          </div>
        )}
    </div>
  );
}
