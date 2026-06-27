"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/dashboard-ui/data-table";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_VARIANTS,
  type QuoteListItem,
  type QuoteStatus,
} from "@/lib/quotes/types";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function OrcamentosListClient({ quotes }: { quotes: QuoteListItem[] }) {
  const router = useRouter();

  return (
    <PageShell
      header={{
        breadcrumbs: [{ label: "Vendas", href: "/dashboard/vendas" }, { label: "Orçamentos" }],
        title: "Orçamentos",
        description:
          "Propostas comerciais para pacientes, leads ou contatos avulsos. Gere PDF organizado para envio ao cliente.",
        actions: (
          <Link href="/dashboard/vendas/orcamentos/novo">
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Novo orçamento
            </Button>
          </Link>
        ),
      }}
    >
      {quotes.length === 0 ? (
        <EmptyState
          title="Nenhum orçamento ainda"
          description="Crie uma proposta com serviços, materiais e condições comerciais."
          action={{ label: "Criar orçamento", href: "/dashboard/vendas/orcamentos/novo" }}
        />
      ) : (
        <DataTable
          columns={[
            {
              key: "numero",
              header: "Nº",
              cell: (row) => `#${String(row.quote_number).padStart(4, "0")}`,
            },
            {
              key: "destinatario",
              header: "Destinatário",
              cell: (row) => row.recipient_display,
            },
            {
              key: "total",
              header: "Total",
              cell: (row) => fmt(row.total_amount),
            },
            {
              key: "validade",
              header: "Validade",
              cell: (row) =>
                row.valid_until
                  ? new Date(`${row.valid_until}T12:00:00`).toLocaleDateString("pt-BR")
                  : "—",
            },
            {
              key: "status",
              header: "Status",
              cell: (row) => (
                <Badge variant={QUOTE_STATUS_VARIANTS[row.status as QuoteStatus] ?? "secondary"}>
                  {QUOTE_STATUS_LABELS[row.status as QuoteStatus]}
                </Badge>
              ),
            },
            {
              key: "criado",
              header: "Criado em",
              cell: (row) => new Date(row.created_at).toLocaleDateString("pt-BR"),
            },
            {
              key: "acao",
              header: "",
              cell: (row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => router.push(`/dashboard/vendas/orcamentos/${row.id}`)}
                >
                  Abrir
                </Button>
              ),
            },
          ]}
          data={quotes}
          getRowKey={(row) => row.id}
        />
      )}
    </PageShell>
  );
}
