"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultGoalRegistry } from "@/lib/attendance-flow/goal-registry";
import type { ConversationFlowState } from "@/lib/attendance-flow/types";

type FlowDebuggerProps = {
  conversationFlow?: ConversationFlowState | null;
  workflowLabel?: string;
  intentLabel?: string;
  lastExtractorSummary?: string;
};

export function FlowDebuggerPanel({
  conversationFlow,
  workflowLabel = "Consulta",
  intentLabel,
  lastExtractorSummary,
}: FlowDebuggerProps) {
  if (!conversationFlow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Progresso do fluxo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Nenhum fluxo ativo no aiState. Execute uma ferramenta ou simule uma mensagem em modo produção.
        </CardContent>
      </Card>
    );
  }

  const allGoalIds = [
    ...conversationFlow.satisfied,
    ...conversationFlow.pending,
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Progresso do fluxo</CardTitle>
        <p className="text-xs text-muted-foreground">
          Workflow: {workflowLabel} ({conversationFlow.mode})
          {intentLabel ? ` · Intent: ${intentLabel}` : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="space-y-1">
          {allGoalIds.map((id) => {
            const done = conversationFlow.satisfied.includes(id);
            const isFocus = conversationFlow.focus_goal_id === id;
            const goal = defaultGoalRegistry.get(id);
            return (
              <li
                key={id}
                className={
                  isFocus ? "font-medium text-primary" : done ? "text-muted-foreground" : ""
                }
              >
                {done ? "✔" : "○"} {goal?.label ?? id}
                {isFocus && !done ? " ← foco" : ""}
              </li>
            );
          })}
        </ul>
        {lastExtractorSummary && (
          <div className="text-xs border-t pt-2 text-muted-foreground">
            <p className="font-medium text-foreground">Último turno</p>
            <p>{lastExtractorSummary}</p>
          </div>
        )}
        {Object.keys(conversationFlow.collected ?? {}).length > 0 && (
          <div className="text-xs">
            <p className="font-medium">Coletados</p>
            <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-auto">
              {JSON.stringify(conversationFlow.collected, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
