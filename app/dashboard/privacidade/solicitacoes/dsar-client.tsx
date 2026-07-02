"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  createDataSubjectRequest,
  exportPatientDataForDsar,
  listDataSubjectRequests,
  processPatientDeletionRequest,
  updateDataSubjectRequestStatus,
  type DsarRequestType,
} from "../dsar-actions";
import { Badge } from "@/components/ui/badge";
import { formatDsarDueAt, isDsarOverdue } from "@/lib/compliance/dsar-sla";

const TYPE_LABELS: Record<DsarRequestType, string> = {
  access: "Acesso",
  correction: "Correção",
  deletion: "Eliminação",
  portability: "Portabilidade",
  opposition: "Oposição",
  other: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Aberta",
  in_progress: "Em andamento",
  completed: "Concluída",
  rejected: "Rejeitada",
};

type RequestRow = {
  id: string;
  request_type: string;
  status: string;
  requester_name: string | null;
  requester_email: string | null;
  created_at: string;
  notes: string | null;
  due_at: string | null;
  source: string | null;
  patient_id: string | null;
};

export function DsarClient({
  initialRequests,
  isAdmin,
}: {
  initialRequests: RequestRow[];
  isAdmin: boolean;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [pending, startTransition] = useTransition();
  const [requestType, setRequestType] = useState<DsarRequestType>("access");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [notes, setNotes] = useState("");

  function refresh() {
    startTransition(async () => {
      const res = await listDataSubjectRequests();
      if (res.data) setRequests(res.data as RequestRow[]);
    });
  }

  async function handleCreate() {
    if (!requesterName.trim()) {
      toast("Informe o nome do solicitante.", "error");
      return;
    }
    const res = await createDataSubjectRequest({
      requestType,
      requesterName,
      requesterEmail,
      notes,
    });
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    toast("Solicitação registrada.", "success");
    setRequesterName("");
    setRequesterEmail("");
    setNotes("");
    refresh();
  }

  async function handleStatus(id: string, status: "in_progress" | "completed" | "rejected") {
    const res = await updateDataSubjectRequestStatus(id, status);
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    toast("Status atualizado.", "success");
    refresh();
  }

  async function handleExport(patientId: string) {
    const res = await exportPatientDataForDsar(patientId);
    if (res.error || !res.data) {
      toast(res.error ?? "Erro ao exportar.", "error");
      return;
    }
    const blob = new Blob([JSON.stringify(res.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paciente-${patientId}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Exportação concluída.", "success");
  }

  async function handleDeletionProcess(request: RequestRow) {
    if (!request.patient_id) {
      toast("Vincule um paciente à solicitação antes de processar eliminação.", "error");
      return;
    }
    const res = await processPatientDeletionRequest(request.patient_id, request.id);
    if (res.error) {
      toast(res.error, "error");
      return;
    }
    toast(
      res.action === "anonymized"
        ? "Paciente anonimizado (prontuário retido conforme CFM)."
        : "Paciente excluído.",
      "success"
    );
    refresh();
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova solicitação (DSAR)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as DsarRequestType)}
                >
                  {(Object.keys(TYPE_LABELS) as DsarRequestType[]).map((k) => (
                    <option key={k} value={k}>
                      {TYPE_LABELS[k]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome do titular</Label>
                <Input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
            <Button type="button" disabled={pending} onClick={handleCreate}>
              Registrar solicitação
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solicitações registradas</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação ainda.</p>
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li key={r.id} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{r.requester_name}</span>
                    <Badge variant="outline">{TYPE_LABELS[r.request_type as DsarRequestType] ?? r.request_type}</Badge>
                    <Badge>{STATUS_LABELS[r.status] ?? r.status}</Badge>
                    {r.source === "public_portal" && (
                      <Badge variant="secondary">Portal público</Badge>
                    )}
                    {isDsarOverdue(r.due_at, r.status) && (
                      <Badge variant="destructive">Prazo vencido</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                    {r.requester_email ? ` · ${r.requester_email}` : ""}
                    {r.due_at ? ` · Prazo: ${formatDsarDueAt(r.due_at)}` : ""}
                  </p>
                  {r.notes && <p className="text-sm text-muted-foreground">{r.notes}</p>}
                  {isAdmin && r.status !== "completed" && r.status !== "rejected" && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {r.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => handleStatus(r.id, "in_progress")}
                        >
                          Iniciar
                        </Button>
                      )}
                      {r.request_type === "portability" && r.patient_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => handleExport(r.patient_id!)}
                        >
                          Exportar JSON
                        </Button>
                      )}
                      {r.request_type === "deletion" && r.patient_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => handleDeletionProcess(r)}
                        >
                          Processar eliminação
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => handleStatus(r.id, "completed")}
                      >
                        Concluir
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => handleStatus(r.id, "rejected")}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
