"use client";

import { Copy, Play, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ASSISTANT_TOOL_CATALOG,
} from "@/lib/virtual-assistant/tools/catalog";
import {
  formatRelativeTime,
  type PlaygroundHistoryEntry,
} from "./hooks/use-playground-history";
import { copyToClipboard, formatJson, MUTATING_TOOLS } from "./utils";

type Props = {
  history: PlaygroundHistoryEntry[];
  onRerun: (entry: PlaygroundHistoryEntry) => void;
  onDuplicate: (entry: PlaygroundHistoryEntry) => void;
  onClear: () => void;
};

export function ExecutionHistory({ history, onRerun, onDuplicate, onClear }: Props) {
  if (!history.length) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Histórico de execuções</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Limpar
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {history.map((entry) => {
          const label =
            ASSISTANT_TOOL_CATALOG.find((t) => t.name === entry.toolName)?.label ??
            entry.toolName;
          const resultStatus =
            entry.result && typeof entry.result === "object"
              ? (entry.result as { status?: string }).status
              : undefined;

          return (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(entry.at)} · {entry.durationMs}ms
                  {entry.executorMode === "production" && " · produção"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {resultStatus && (
                  <Badge variant="outline" className="text-[10px]">
                    {resultStatus}
                  </Badge>
                )}
                {MUTATING_TOOLS.has(entry.toolName) && (
                  <Badge variant="warning" className="text-[10px]">
                    mutating
                  </Badge>
                )}
                <Button type="button" size="sm" variant="secondary" className="h-7" onClick={() => onRerun(entry)}>
                  <Play className="mr-1 h-3 w-3" />
                  Reexecutar
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => onDuplicate(entry)}>
                  <Files className="mr-1 h-3 w-3" />
                  Duplicar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => copyToClipboard(formatJson(entry))}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
