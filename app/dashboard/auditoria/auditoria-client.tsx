"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

type LogEntry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  profiles:
    | { id: string; full_name: string | null; email: string | null }
    | { id: string; full_name: string | null; email: string | null }[]
    | null;
};

type Member = { id: string; full_name: string | null; email: string | null; role: string };

const ACTION_LABEL: Record<string, string> = {
  appointment_created: "Consulta criada",
  appointment_updated: "Consulta atualizada",
  appointment_deleted: "Consulta excluída",
  patient_created: "Paciente cadastrado",
  patient_deleted: "Paciente excluído",
  form_template_created: "Formulário criado",
  form_template_deleted: "Formulário excluído",
};

const ENTITY_LABEL: Record<string, string> = {
  appointment: "Consulta",
  patient: "Paciente",
  form_template: "Formulário",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  medico: "Profissional",
  secretaria: "Secretário(a)",
};

function readString(obj: Record<string, unknown> | null, key: string): string | null {
  const value = obj?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function getEntitySummary(log: LogEntry): string | null {
  if (log.entity_type === "patient") {
    const name = readString(log.new_values, "full_name") ?? readString(log.old_values, "full_name");
    const email = readString(log.new_values, "email") ?? readString(log.old_values, "email");
    if (name && email) return `${name} (${email})`;
    if (name) return name;
    if (email) return email;
  }
  if (log.entity_type === "form_template") {
    const name = readString(log.new_values, "name") ?? readString(log.old_values, "name");
    if (name) return name;
  }
  return null;
}

export function AuditoriaClient({
  initialLogs,
  members,
}: {
  initialLogs: LogEntry[];
  members: Member[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState(searchParams.get("user") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");

  function applyFilters() {
    const p = new URLSearchParams();
    if (userId) p.set("user", userId);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    router.push(`/dashboard/auditoria?${p.toString()}`);
  }

  const logs = initialLogs.map((log) => {
    const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
    const actorName = profile?.full_name?.trim() || null;
    const actorEmail = profile?.email?.trim() || null;
    const actorDisplay = actorName && actorEmail
      ? `${actorName} (${actorEmail})`
      : actorName ?? actorEmail ?? "Sistema";
    const entitySummary = getEntitySummary(log);
    return {
      ...log,
      actorDisplay,
      entitySummary,
      actionLabel: ACTION_LABEL[log.action] ?? log.action,
      entityLabel: ENTITY_LABEL[log.entity_type] ?? log.entity_type,
    };
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <span className="font-semibold">Filtros</span>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="user">Usuário</Label>
            <select
              id="user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="h-9 w-[200px] rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">Todos</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {(m.full_name ?? m.email ?? "Sem nome")} · {ROLE_LABEL[m.role] ?? m.role}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="from">De</Label>
            <Input
              id="from"
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-[200px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">Até</Label>
            <Input
              id="to"
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-[200px]"
            />
          </div>
          <Button onClick={applyFilters}>Filtrar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <span className="font-semibold">Histórico de ações</span>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Nenhum registro no período.</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 text-sm"
                >
                  <span className="font-medium">{log.actionLabel}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{log.entityLabel}</span>
                  {log.entitySummary && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs">{log.entitySummary}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">•</span>
                  <span>{log.actorDisplay}</span>
                  <span className="ml-auto text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
