"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  CalendarCheck,
  FileText,
  MessageSquare,
  Plus,
  UserCheck,
  ArrowRight,
} from "lucide-react";
import { registerPatientFromPublicForm } from "@/app/dashboard/pacientes/actions";
import { updateAppointment } from "@/app/dashboard/agenda/actions";
import { toast } from "@/components/ui/toast";
import type { ContactJourney, SuggestedAction } from "@/lib/contact-journey";

type JourneyNextActionCardProps = {
  journey: ContactJourney;
  onRegisterComplete?: () => void;
};

function actionIcon(kind: SuggestedAction["kind"]) {
  switch (kind) {
    case "register_patient":
      return UserCheck;
    case "schedule_appointment":
    case "schedule_return":
      return CalendarCheck;
    case "link_form":
      return FileText;
    case "reschedule_appointment":
      return Calendar;
    case "contact_lead":
    case "send_form_reminder":
    case "view_event":
      return MessageSquare;
    default:
      return ArrowRight;
  }
}

export function JourneyNextActionCard({ journey, onRegisterComplete }: JourneyNextActionCardProps) {
  const router = useRouter();
  const action = journey.suggestedAction;

  if (!action) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Próximo passo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma ação pendente no momento. A jornada está em dia.
          </p>
        </CardContent>
      </Card>
    );
  }

  const Icon = actionIcon(action.kind);

  async function handleRegister() {
    const eventId = action?.eventId;
    const meta = action?.metadata ?? {};
    if (!eventId) return;
    const email = (meta.public_submitter_email as string) || journey.email;
    if (!email) return;

    const res = await registerPatientFromPublicForm(
      email,
      {
        full_name: (meta.public_submitter_name as string) || journey.displayName,
        phone: (meta.public_submitter_phone as string) || journey.phone || null,
        birth_date: (meta.public_submitter_birth_date as string) || null,
        custom_fields: (meta.public_submitter_custom_fields as Record<string, unknown>) || undefined,
      },
      eventId
    );
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    toast("Paciente cadastrado.", "success");
    onRegisterComplete?.();
    router.refresh();
  }

  async function handleMarkStatus(status: "realizada" | "falta" | "cancelada") {
    if (!action?.appointmentId) return;
    const res = await updateAppointment(action.appointmentId, { status });
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    toast("Status atualizado.", "success");
    router.refresh();
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          Próximo passo sugerido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-medium">{action.label}</p>
          {action.description && (
            <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
          )}
        </div>

        {action.kind === "register_patient" && action.eventId && (
          <Button size="sm" onClick={handleRegister}>
            <UserCheck className="h-4 w-4 mr-2" />
            Cadastrar paciente
          </Button>
        )}

        {action.kind === "mark_appointment_done" && action.appointmentId && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => handleMarkStatus("realizada")}>
              Marcar realizada
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleMarkStatus("falta")}>
              Marcar falta
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleMarkStatus("cancelada")}>
              Cancelar
            </Button>
          </div>
        )}

        {action.href &&
          action.kind !== "register_patient" &&
          action.kind !== "mark_appointment_done" && (
            <Button asChild size="sm">
              <Link href={action.href}>
                {action.kind === "schedule_appointment" && <Plus className="h-4 w-4 mr-2" />}
                {action.kind === "link_form" && <FileText className="h-4 w-4 mr-2" />}
                {(action.kind === "schedule_return" || action.kind === "reschedule_appointment") && (
                  <CalendarCheck className="h-4 w-4 mr-2" />
                )}
                {action.label}
              </Link>
            </Button>
          )}

        {journey.pendingEvents.length > 0 && (
          <Link
            href="/dashboard/eventos"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            Ver {journey.pendingEvents.length} evento(s) pendente(s)
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
