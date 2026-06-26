"use client";

import { DataTable } from "@/components/dashboard-ui/data-table";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import { AppPageHeader } from "@/components/app-page-header";

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
    <div className="space-y-6">
      <AppPageHeader
        breadcrumbs={[{ label: title }]}
        title={title}
        description={subtitle}
      />
      <div className="surface-elevated p-4 sm:p-6">
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
      </div>
    </div>
  );
}
