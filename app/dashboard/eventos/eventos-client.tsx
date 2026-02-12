"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Mail, MessageSquare, Check, Send, Clock, X } from "lucide-react";
import { processEvent } from "./actions";

// Formatação de data
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

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  whatsapp: <MessageSquare className="h-4 w-4" />,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  sent: "bg-green-100 text-green-800 border-green-300",
  completed_without_send: "bg-blue-100 text-blue-800 border-blue-300",
  ignored: "bg-gray-100 text-gray-800 border-gray-300",
  failed: "bg-red-100 text-red-800 border-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  completed_without_send: "Concluído sem envio",
  ignored: "Ignorado",
  failed: "Falhou",
};

type Event = {
  id: string;
  event_code: string;
  event_name: string;
  event_category: string;
  patient_id: string | null;
  patient_name: string | null;
  appointment_id: string | null;
  appointment_scheduled_at: string | null;
  form_instance_id: string | null;
  status: string;
  origin: string;
  occurred_at: string;
  created_at: string;
  processed_at?: string | null;
  processed_by?: string | null;
  processed_by_name?: string | null;
  channels: string[];
  template_ids: Record<string, string>;
  variables: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

type Patient = {
  id: string;
  full_name: string;
};

type EventType = {
  code: string;
  name: string;
  category: string;
};

export function EventosClient({
  initialPendingEvents,
  initialPastEvents,
  patients,
  eventTypes,
}: {
  initialPendingEvents: Event[];
  initialPastEvents: Event[];
  patients: Patient[];
  eventTypes: EventType[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"pending" | "past">("pending");
  const [pendingEvents, setPendingEvents] = useState<Event[]>(initialPendingEvents);
  const [pastEvents, setPastEvents] = useState<Event[]>(initialPastEvents);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [patientFilter, setPatientFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");

  // Filtrar eventos
  const filteredPending = pendingEvents.filter((e) => {
    if (patientFilter !== "all" && e.patient_id !== patientFilter) return false;
    if (eventFilter !== "all" && e.event_code !== eventFilter) return false;
    return true;
  });

  const filteredPast = pastEvents.filter((e) => {
    if (patientFilter !== "all" && e.patient_id !== patientFilter) return false;
    if (eventFilter !== "all" && e.event_code !== eventFilter) return false;
    return true;
  });

  async function handleProcessEvent(eventId: string, action: "send" | "mark_ok") {
    const actionLabel = action === "send" ? "enviar" : "marcar como ok";
    if (!confirm(`Deseja ${actionLabel} este evento?`)) return;

    setProcessing(eventId);
    const result = await processEvent(eventId, action);
    setProcessing(null);

    if (result.error) {
      alert(`Erro: ${result.error}`);
    } else {
      router.refresh();
    }
  }

  function EventCard({ event }: { event: Event }) {
    const isExpanded = expanded === event.id;
    const isProcessing = processing === event.id;
    const isPending = event.status === "pending";

    return (
      <Card key={event.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className={STATUS_COLORS[event.status] || STATUS_COLORS.pending}
                >
                  {STATUS_LABELS[event.status] || event.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {event.event_category}
                </span>
              </div>
              <CardTitle className="text-lg">{event.event_name}</CardTitle>
              {event.patient_name && (
                <p className="text-sm text-muted-foreground mt-1">
                  Paciente: <strong>{event.patient_name}</strong>
                </p>
              )}
              {event.appointment_scheduled_at && (
                <p className="text-sm text-muted-foreground">
                  Consulta: {formatDate(event.appointment_scheduled_at)}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Ocorreu em: {formatDate(event.occurred_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Ícones de canais */}
              {event.channels && event.channels.length > 0 && (
                <div className="flex gap-1">
                  {event.channels.map((channel) => (
                    <div key={channel} className="text-muted-foreground">
                      {CHANNEL_ICONS[channel]}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {isPending && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleProcessEvent(event.id, "send")}
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Enviar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleProcessEvent(event.id, "mark_ok")}
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Marcar como OK
                  </Button>
                </>
              )}
              {!isPending && event.processed_at && (
                <div className="text-sm text-muted-foreground">
                  Processado em: {formatDate(event.processed_at)}
                  {event.processed_by_name && ` por ${event.processed_by_name}`}
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded(isExpanded ? null : event.id)}
            >
              {isExpanded ? "Ocultar" : "Detalhes"}
            </Button>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t space-y-2 text-sm">
              <div>
                <strong>Origem:</strong> {event.origin}
              </div>
              {event.channels && event.channels.length > 0 && (
                <div>
                  <strong>Canais:</strong> {event.channels.join(", ")}
                </div>
              )}
              {Object.keys(event.variables || {}).length > 0 && (
                <div>
                  <strong>Variáveis:</strong>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                    {JSON.stringify(event.variables, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Central de Eventos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie todos os eventos do sistema: pendentes e passados
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Filtrar por paciente</label>
              <Select value={patientFilter} onValueChange={setPatientFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os pacientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os pacientes</SelectItem>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Filtrar por evento</label>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os eventos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os eventos</SelectItem>
                  {eventTypes.map((et) => (
                    <SelectItem key={et.code} value={et.code}>
                      {et.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2",
            activeTab === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Clock className="h-4 w-4" />
          Pendentes ({filteredPending.length})
        </button>
        <button
          onClick={() => setActiveTab("past")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2",
            activeTab === "past"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Check className="h-4 w-4" />
          Passados ({filteredPast.length})
        </button>
      </div>

      {/* Conteúdo das Tabs */}
      <div className="space-y-4">
        {activeTab === "pending" && (
          <>
            {filteredPending.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  Nenhum evento pendente encontrado.
                </p>
              </Card>
            ) : (
              filteredPending.map((event) => <EventCard key={event.id} event={event} />)
            )}
          </>
        )}

        {activeTab === "past" && (
          <>
            {filteredPast.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  Nenhum evento passado encontrado.
                </p>
              </Card>
            ) : (
              filteredPast.map((event) => <EventCard key={event.id} event={event} />)
            )}
          </>
        )}
      </div>
    </div>
  );
}
