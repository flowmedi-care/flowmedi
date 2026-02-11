"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Check, X, Eye } from "lucide-react";
import {
  approvePendingMessage,
  rejectPendingMessage,
} from "../actions";
// Formatação de data simples sem date-fns
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  whatsapp: <MessageSquare className="h-4 w-4" />,
};

const EVENT_LABELS: Record<string, string> = {
  appointment_created: "Consulta Agendada",
  appointment_rescheduled: "Consulta Remarcada",
  appointment_canceled: "Consulta Cancelada",
  appointment_reminder_24h: "Lembrete 24h",
  appointment_reminder_48h: "Lembrete 48h",
  form_link_sent: "Link do Formulário",
  form_reminder: "Lembrete Formulário",
  appointment_completed: "Consulta Realizada",
  appointment_no_show: "Falta Registrada",
};

type PendingMessage = {
  id: string;
  patient: { full_name: string };
  appointment: {
    scheduled_at: string;
    appointment_type: { name: string } | null;
  } | null;
  event_code: string;
  channel: string;
  status: string;
  created_at: string;
  processed_body?: string;
};

export function PendentesClient({ messages }: { messages: PendingMessage[] }) {
  const router = useRouter();
  const [processing, setProcessing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function handleApprove(id: string) {
    if (!confirm("Deseja aprovar e enviar esta mensagem?")) return;

    setProcessing(id);
    const result = await approvePendingMessage(id);
    setProcessing(null);

    if (result.error) {
      alert(`Erro: ${result.error}`);
    } else {
      router.refresh();
    }
  }

  async function handleReject(id: string) {
    if (!confirm("Deseja rejeitar esta mensagem?")) return;

    setProcessing(id);
    const result = await rejectPendingMessage(id);
    setProcessing(null);

    if (result.error) {
      alert(`Erro: ${result.error}`);
    } else {
      router.refresh();
    }
  }

  if (messages.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">
          Mensagens Pendentes
        </h1>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Nenhuma mensagem pendente de aprovação.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Mensagens Pendentes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {messages.length} mensagem{messages.length !== 1 ? "s" : ""}{" "}
            aguardando aprovação
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {messages.map((message) => {
          const isExpanded = expanded === message.id;
          const isProcessing = processing === message.id;

          return (
            <Card key={message.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">
                        {CHANNEL_ICONS[message.channel]}
                        <span className="ml-1">
                          {CHANNEL_LABELS[message.channel]}
                        </span>
                      </Badge>
                      <Badge variant="secondary">
                        {EVENT_LABELS[message.event_code] || message.event_code}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-foreground">
                      {message.patient.full_name}
                    </h3>
                    {message.appointment && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Consulta:{" "}
                        {formatDate(message.appointment.scheduled_at)}
                        {message.appointment.appointment_type && (
                          <> • {message.appointment.appointment_type.name}</>
                        )}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Criada em:{" "}
                      {formatDate(message.created_at)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleApprove(message.id)}
                    disabled={isProcessing}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Aprovar e Enviar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReject(message.id)}
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Rejeitar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpanded(isExpanded ? null : message.id)
                    }
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {isExpanded ? "Ocultar" : "Ver Preview"}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="mt-4 p-4 bg-muted rounded-md">
                    <p className="text-sm font-medium mb-2">Preview da Mensagem:</p>
                    <div className="text-sm whitespace-pre-wrap">
                      {message.processed_body || "Preview não disponível"}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
