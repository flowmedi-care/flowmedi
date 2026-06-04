"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FinanceiroReportClient({
  title,
  subtitle,
  rows,
  columns,
}: {
  title: string;
  subtitle?: string;
  rows: Record<string, string | number>[];
  columns: { key: string; label: string; format?: "currency" }[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <Card>
        <CardHeader>
          <p className="text-sm font-medium">{rows.length} registro(s)</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sem dados no período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {columns.map((c) => (
                    <th key={c.key} className="py-2 pr-4 font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {columns.map((c) => (
                      <td key={c.key} className="py-2 pr-4">
                        {c.format === "currency"
                          ? fmt(Number(row[c.key]))
                          : String(row[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
