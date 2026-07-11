"use client";

import { Loader2, User, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PhoneContext } from "./hooks/use-playground-catalog";

type Props = {
  phone: string;
  onPhoneChange: (phone: string) => void;
  conversationId: string;
  onConversationIdChange: (id: string) => void;
  context: PhoneContext | null;
  contextLoading: boolean;
  onUsePatient: () => void;
  onLoadConversationState: () => void;
};

export function ContextPanel({
  phone,
  onPhoneChange,
  conversationId,
  onConversationIdChange,
  context,
  contextLoading,
  onUsePatient,
  onLoadConversationState,
}: Props) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Contexto da conversa</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Telefone</Label>
          <Input
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="5511999999999"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Várias ferramentas usam o telefone para buscar paciente e consultas.
          </p>
        </div>
        <div>
          <Label>ID da conversa (opcional)</Label>
          <Input
            value={conversationId}
            onChange={(e) => onConversationIdChange(e.target.value)}
            placeholder="Auto-cria se vazio"
          />
        </div>
      </div>

      {contextLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Buscando contexto...
        </div>
      )}

      {!contextLoading && context && (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
            {context.patient ? (
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{context.patient.full_name ?? "Paciente"}</p>
                  <p className="text-xs text-muted-foreground">
                    {context.patient.phone ?? context.phone}
                    <span className="ml-2 font-mono text-[10px] opacity-60">
                      {context.patient.id.slice(0, 8)}…
                    </span>
                  </p>
                  {context.appointments.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {context.appointments.length} consulta(s) futura(s)
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserX className="h-4 w-4" />
                Nenhum paciente encontrado para este telefone
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {context.patient && (
                <Button type="button" size="sm" variant="secondary" onClick={onUsePatient}>
                  Usar paciente
                </Button>
              )}
              {context.aiState && (
                <Button type="button" size="sm" variant="outline" onClick={onLoadConversationState}>
                  Carregar estado da conversa
                </Button>
              )}
              {context.conversationId && !conversationId && (
                <Badge variant="outline" className="text-xs">
                  Conversa: {context.conversationId.slice(0, 8)}…
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
