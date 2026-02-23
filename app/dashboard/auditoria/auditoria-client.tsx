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
  profiles: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
};

type Member = { id: string; full_name: string | null; role: string };

const ACTION_LABEL: Record<string, string> = {
  appointment_created: "Consulta criada",
  appointment_updated: "Consulta atualizada",
  appointment_deleted: "Consulta excluída",
};

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
    return {
      ...log,
      userName: profile?.full_name ?? "Sistema",
      actionLabel: ACTION_LABEL[log.action] ?? log.action,
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
                  {m.full_name ?? m.id.slice(0, 8)} ({m.role})
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
                  <span className="text-muted-foreground">{log.entity_type}</span>
                  {log.entity_id && (
                    <>
                      <span className="text-muted-foreground">#</span>
                      <span className="font-mono text-xs">{log.entity_id.slice(0, 8)}…</span>
                    </>
                  )}
                  <span className="text-muted-foreground">•</span>
                  <span>{log.userName}</span>
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
