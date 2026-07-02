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
  listDataSubjectRequests,
  updateDataSubjectRequestStatus,
  type DsarRequestType,
} from "../dsar-actions";
import { Badge } from "@/components/ui/badge";

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
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                    {r.requester_email ? ` · ${r.requester_email}` : ""}
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
