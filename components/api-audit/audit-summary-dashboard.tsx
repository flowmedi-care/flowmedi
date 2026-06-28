"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAudit } from "./audit-context";
import { useMemo } from "react";

export function AuditSummaryDashboard() {
  const { endpoints, results, getLatestResult } = useAudit();

  const stats = useMemo(() => {
    const publicCount = endpoints.filter((e) => e.category === "publico").length;
    const adminCount = endpoints.filter(
      (e) => e.category === "administrador" || e.category === "sistema"
    ).length;
    const privateCount = endpoints.filter(
      (e) => e.requiresAuth && e.category !== "cron" && e.category !== "webhook"
    ).length;

    const testedIds = new Set<string>();
    let approved = 0;
    let failed = 0;

    for (const ep of endpoints) {
      const latest = getLatestResult(ep.id);
      if (latest && !latest.skipped) {
        testedIds.add(ep.id);
        if (latest.classification === "aprovado") approved++;
        else failed++;
      }
    }

    return {
      total: endpoints.length,
      publicCount,
      privateCount,
      adminCount,
      tested: testedIds.size,
      approved,
      failed,
      untested: endpoints.length - testedIds.size,
    };
  }, [endpoints, getLatestResult, results]);

  const cards = [
    { label: "Total endpoints", value: stats.total },
    { label: "Públicos", value: stats.publicCount },
    { label: "Privados", value: stats.privateCount },
    { label: "Administrativos", value: stats.adminCount },
    { label: "Testados", value: stats.tested },
    { label: "Aprovados", value: stats.approved },
    { label: "Falharam / Atenção", value: stats.failed },
    { label: "Não testados", value: stats.untested },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {c.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
