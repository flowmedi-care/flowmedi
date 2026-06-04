// FINANCEIRO FASE 1 — ITEM 8: painel de alertas

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { FinanceAlerts } from "@/lib/financeiro/types";

export function FinanceAlertsPanel({ alerts }: { alerts: FinanceAlerts }) {
  const items: { label: string; count: number; href: string; tone: "default" | "warning" | "danger" }[] = [];

  if (alerts.comandasVencidas > 0) {
    items.push({
      label: "Comandas vencidas (+30 dias)",
      count: alerts.comandasVencidas,
      href: "/dashboard/financeiro/receber",
      tone: "warning",
    });
  }
  if (alerts.contasVencerHojeAmanha > 0) {
    items.push({
      label: "Contas a vencer hoje/amanhã",
      count: alerts.contasVencerHojeAmanha,
      href: "/dashboard/financeiro/pagar",
      tone: "warning",
    });
  }
  if (alerts.contasVencidas > 0) {
    items.push({
      label: "Contas vencidas",
      count: alerts.contasVencidas,
      href: "/dashboard/financeiro/pagar",
      tone: "danger",
    });
  }

  if (items.length === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-900/50">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold text-sm">Alertas financeiros</h3>
        </div>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.href + item.label}>
              <Link
                href={item.href}
                className="flex items-center justify-between text-sm hover:underline"
              >
                <span>{item.label}</span>
                <span
                  className={
                    item.tone === "danger"
                      ? "font-semibold text-destructive"
                      : item.tone === "warning"
                        ? "font-semibold text-amber-700 dark:text-amber-400"
                        : "font-medium"
                  }
                >
                  {item.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
