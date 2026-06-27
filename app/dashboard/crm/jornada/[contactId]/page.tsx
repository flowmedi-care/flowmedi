import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JourneyFlowMap } from "@/components/crm/journey-flow-map";
import { JourneyNextActionCard } from "@/components/crm/journey-next-action-card";
import { JourneyTimeline } from "@/components/crm/journey-list-client";
import { getJourneyDetail } from "../actions";
import {
  getStepDefinition,
  JOURNEY_PHASE_LABELS,
} from "@/lib/contact-journey";
import { ArrowLeft, ExternalLink } from "lucide-react";

type Props = {
  params: Promise<{ contactId: string }>;
};

export default async function JornadaDetailPage({ params }: Props) {
  const { contactId } = await params;
  const decoded = decodeURIComponent(contactId);

  const { data: journey, error } = await getJourneyDetail(decoded);

  if (error === "Não autorizado.") redirect("/entrar");
  if (!journey) notFound();

  const step = getStepDefinition(journey.currentStep);

  return (
    <PageShell
      header={{
        breadcrumbs: [
          { label: "CRM", href: "/dashboard/crm/pipeline" },
          { label: "Jornada", href: "/dashboard/crm/jornada" },
          { label: journey.displayName },
        ],
        title: journey.displayName,
        description: `${step.label} · ${JOURNEY_PHASE_LABELS[journey.phase]}`,
        actions: (
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm/jornada">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        ),
      }}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mapa da jornada</CardTitle>
            </CardHeader>
            <CardContent>
              <JourneyFlowMap
                currentStep={journey.currentStep}
                completedSteps={journey.completedSteps}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Histórico</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/eventos">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Central de Eventos
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <JourneyTimeline entries={journey.timeline} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {journey.contactType === "lead" ? "Lead" : "Paciente"}
                </Badge>
                <Badge variant="secondary">{JOURNEY_PHASE_LABELS[journey.phase]}</Badge>
              </div>
              {journey.email && (
                <p>
                  <span className="text-muted-foreground">E-mail:</span> {journey.email}
                </p>
              )}
              {journey.phone && (
                <p>
                  <span className="text-muted-foreground">Telefone:</span> {journey.phone}
                </p>
              )}
              {journey.appointmentScheduledAt && (
                <p>
                  <span className="text-muted-foreground">Consulta:</span>{" "}
                  {new Date(journey.appointmentScheduledAt).toLocaleString("pt-BR")}
                </p>
              )}
              {journey.patientId && (
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href={`/dashboard/contatos/pacientes/${journey.patientId}`}>
                    Ver perfil do paciente
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <JourneyNextActionCard journey={journey} />
        </div>
      </div>
    </PageShell>
  );
}
