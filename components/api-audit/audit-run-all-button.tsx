"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play } from "lucide-react";
import { useAudit } from "./audit-context";

export function AuditRunAllButton() {
  const { fixtures, setBatchResults, setIsRunning, isRunning } = useAudit();
  const [progress, setProgress] = useState(0);

  async function runAll() {
    setIsRunning(true);
    setProgress(10);
    try {
      const res = await fetch("/api/dev/audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtures }),
      });
      setProgress(90);
      const data = await res.json();
      if (data.results) {
        setBatchResults(data.results);
      }
      setProgress(100);
    } finally {
      setTimeout(() => {
        setIsRunning(false);
        setProgress(0);
      }, 500);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button onClick={runAll} disabled={isRunning} size="lg">
        {isRunning ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        Executar Auditoria
      </Button>
      {isRunning && <Progress value={progress} className="h-2 flex-1" />}
    </div>
  );
}
