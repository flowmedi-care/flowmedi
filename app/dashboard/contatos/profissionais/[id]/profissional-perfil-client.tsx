"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { SegmentedTabs } from "@/components/dashboard-ui/layout/segmented-tabs";
import { ListPanel, ListPanelItem } from "@/components/dashboard-ui/list-panel";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import type { ProfessionalProfileBundle } from "../profile-types";
import { useState } from "react";
import { Pencil } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  medico: "Profissional",
  secretaria: "Secretário(a)",
  admin: "Administrador",
};

const STATUS_LABELS: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  falta: "Falta",
  cancelada: "Cancelada",
};

export function ProfissionalPerfilClient({
  bundle,
  currentUserId,
}: {
  bundle: ProfessionalProfileBundle;
  currentUserId: string;
}) {
  const [tab, setTab] = useState<"overview" | "activity" | "procedures">("overview");
  const { professional, procedures, secretaries, recentAppointments, referralMessage, agendaColorCount } =
    bundle;
  const isSelf = professional.id === currentUserId;
  const isDoctor = professional.role === "medico";

  return (
    <PageShell
      variant="split"
      header={{
        breadcrumbs: [
          { label: "Profissionais", href: "/dashboard/contatos/profissionais" },
          { label: professional.full_name ?? "Perfil" },
        ],
        title: professional.full_name ?? "Profissional",
        description: professional.email ?? undefined,
        actions: isSelf ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/perfil">
              <Pencil className="h-4 w-4 mr-2" />
              Editar meu perfil
            </Link>
          </Button>
        ) : undefined,
      }}
      tabs={
        isDoctor ? (
          <SegmentedTabs
            tabs={[
              { id: "overview", label: "Visão geral" },
              { id: "activity", label: "Atividade" },
              { id: "procedures", label: "Procedimentos" },
            ]}
            value={tab}
            onChange={(id) => setTab(id as typeof tab)}
            variant="underline"
          />
        ) : undefined
      }
    >
      <div className="flex flex-col sm:flex-row gap-6 mb-6">
        <Avatar
          name={professional.full_name}
          src={professional.logo_url}
          size="lg"
          className="h-20 w-20 text-xl"
        />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{ROLE_LABELS[professional.role] ?? professional.role}</Badge>
            {professional.active === false && <Badge variant="secondary">Inativo</Badge>}
          </div>
          {isDoctor && (professional.specialty || professional.crm) && (
            <p className="text-sm text-muted-foreground">
              {[
                professional.specialty,
                professional.crm && professional.crm_uf
                  ? `CRM ${professional.crm}/${professional.crm_uf}`
                  : professional.crm,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {professional.created_at && (
            <p className="text-xs text-muted-foreground">
              Na clínica desde{" "}
              {new Date(professional.created_at).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      </div>

      {!isDoctor ? (
        <dl className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="font-medium">{professional.email ?? "—"}</dd>
          </div>
          {professional.cpf && (
            <div>
              <dt className="text-muted-foreground">CPF</dt>
              <dd className="font-medium">{professional.cpf}</dd>
            </div>
          )}
        </dl>
      ) : tab === "overview" ? (
        <div className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-2 text-sm">
            {professional.cpf && (
              <div>
                <dt className="text-muted-foreground">CPF</dt>
                <dd className="font-medium">{professional.cpf}</dd>
              </div>
            )}
            {professional.specialty && (
              <div>
                <dt className="text-muted-foreground">Especialidade</dt>
                <dd className="font-medium">{professional.specialty}</dd>
              </div>
            )}
            {(professional.crm || professional.crm_uf) && (
              <div>
                <dt className="text-muted-foreground">CRM</dt>
                <dd className="font-medium">
                  {professional.crm}
                  {professional.crm_uf ? `/${professional.crm_uf}` : ""}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Cores personalizadas na agenda</dt>
              <dd className="font-medium">{agendaColorCount}</dd>
            </div>
            {(professional.preferences?.doctor as { late_threshold_minutes?: number })
              ?.late_threshold_minutes != null && (
              <div>
                <dt className="text-muted-foreground">Tolerância de atraso</dt>
                <dd className="font-medium">
                  {
                    (professional.preferences?.doctor as { late_threshold_minutes: number })
                      .late_threshold_minutes
                  }{" "}
                  min
                </dd>
              </div>
            )}
          </dl>

          {secretaries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Secretárias vinculadas</h3>
              <ListPanel>
                {secretaries.map((s) => (
                  <ListPanelItem key={s.id}>
                    <p className="font-medium">{s.full_name ?? "—"}</p>
                    <p className="text-sm text-muted-foreground">{s.email}</p>
                  </ListPanelItem>
                ))}
              </ListPanel>
            </div>
          )}

          {referralMessage && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Mensagem de indicação</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{referralMessage}</p>
            </div>
          )}
        </div>
      ) : tab === "activity" ? (
        recentAppointments.length === 0 ? (
          <EmptyState title="Nenhuma consulta recente" />
        ) : (
          <ListPanel>
            {recentAppointments.map((a) => (
              <ListPanelItem key={a.id}>
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.patient_name ?? "Paciente"}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(a.scheduled_at).toLocaleString("pt-BR")}
                      {a.procedure_name ? ` · ${a.procedure_name}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline">{STATUS_LABELS[a.status] ?? a.status}</Badge>
                </div>
              </ListPanelItem>
            ))}
          </ListPanel>
        )
      ) : procedures.length === 0 ? (
        <EmptyState title="Nenhum procedimento vinculado" />
      ) : (
        <ListPanel>
          {procedures.map((p) => (
            <ListPanelItem key={p.id}>
              <p className="font-medium">{p.name}</p>
            </ListPanelItem>
          ))}
        </ListPanel>
      )}
    </PageShell>
  );
}
