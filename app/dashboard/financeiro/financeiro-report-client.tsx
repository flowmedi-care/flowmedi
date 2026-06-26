"use client";

import { DataTable } from "@/components/dashboard-ui/data-table";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";

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
    <PageShell
      header={{
        breadcrumbs: [{ label: title }],
        title,
        description: subtitle,
      }}
    >
      <p className="text-sm font-medium text-muted-foreground mb-4">
        {rows.length} registro(s)
      </p>
      {rows.length === 0 ? (
        <EmptyState title="Sem dados no período" />
      ) : (
        <DataTable<Record<string, string | number>>
          columns={columns.map((c) => ({
            key: c.key,
            header: c.label,
            cell: (row) =>
              c.format === "currency" ? fmt(Number(row[c.key])) : String(row[c.key] ?? "—"),
          }))}
          data={rows}
          getRowKey={(row) => columns.map((c) => String(row[c.key] ?? "")).join("|")}
        />
      )}
    </PageShell>
  );
}
