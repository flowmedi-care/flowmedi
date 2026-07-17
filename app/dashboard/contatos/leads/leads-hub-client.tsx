"use client";

import { useEffect, useMemo, useState } from "react";
import { PipelineClient } from "../../pipeline/pipeline-client";
import { FilterBar } from "@/components/dashboard-ui/layout/filter-bar";
import { ViewModeToggle } from "@/components/dashboard-ui/layout/view-mode-toggle";
import { SegmentedTabs } from "@/components/dashboard-ui/layout/segmented-tabs";
import { LayoutGrid, List, BarChart3, Flame } from "lucide-react";
import type { LeadsHubData } from "./actions";
import {
  filterPipelineByLifecycle,
  getEffectiveLifecycleStage,
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGES,
  type LifecycleStage,
} from "@/lib/leads/lifecycle";
import {
  computePipelineItemScore,
  sortByEffectiveTemperature,
  TEMPERATURE_LABELS,
  type LeadTemperature,
} from "@/lib/leads/scoring";
import { LeadsCharts } from "./leads-charts";
import { RepescagemView } from "./repescagem-view";
import { Badge } from "@/components/ui/badge";
import { ListPanel, ListPanelItem } from "@/components/dashboard-ui/list-panel";
import { EmptyState } from "@/components/dashboard-ui/empty-state";
import type { PipelineItem } from "../../pipeline/actions";
import { formatPhoneBr } from "@/lib/format-phone";
import { LEAD_SOURCE_LABELS } from "@/lib/leads/lifecycle";
import Link from "next/link";

type HubViewMode = "kanban" | "list" | "charts" | "priority";

const VIEW_MODE_KEY = "leads-hub-view-mode";

export function LeadsHubClient({ data }: { data: LeadsHubData }) {
  const [lifecycle, setLifecycle] = useState<LifecycleStage | "todos" | "repescagem">("todos");
  const [viewMode, setViewMode] = useState<HubViewMode>("kanban");
  const [temperatureFilter, setTemperatureFilter] = useState<LeadTemperature | "all">("all");

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (
      stored === "kanban" ||
      stored === "list" ||
      stored === "charts" ||
      stored === "priority"
    ) {
      setViewMode(stored);
    }
  }, []);

  function handleViewModeChange(mode: HubViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }

  const lifecycleTabs = useMemo(() => {
    const tabs = [
      {
        id: "todos",
        label: "Todos",
        count: data.pipeline.length,
      },
      ...LIFECYCLE_STAGES.map((id) => ({
        id,
        label: LIFECYCLE_STAGE_LABELS[id],
        count: data.metrics.byLifecycle[id] ?? 0,
      })),
      {
        id: "repescagem",
        label: "Repescagem",
        count: data.metrics.repescagemCount,
      },
    ];
    return tabs;
  }, [data.pipeline.length, data.metrics]);

  const filteredPipeline = useMemo(() => {
    let items =
      lifecycle === "todos"
        ? data.pipeline
        : lifecycle === "repescagem"
          ? []
          : filterPipelineByLifecycle(data.pipeline, lifecycle);

    if (temperatureFilter !== "all") {
      items = items.filter(
        (item) => computePipelineItemScore(item).effectiveTemperature === temperatureFilter
      );
    }

    if (viewMode === "priority") {
      return sortByEffectiveTemperature(items);
    }

    return items;
  }, [data.pipeline, lifecycle, temperatureFilter, viewMode]);

  const repescagemItems = useMemo(() => {
    if (lifecycle !== "repescagem") return [];
    return data.repescagem;
  }, [data.repescagem, lifecycle]);

  return (
    <div className="space-y-4">
      <SegmentedTabs
        tabs={lifecycleTabs}
        value={lifecycle}
        onChange={(id) => setLifecycle(id as LifecycleStage | "todos" | "repescagem")}
        variant="underline"
      />

      <FilterBar
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {(viewMode === "list" || viewMode === "priority") && (
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={temperatureFilter}
                onChange={(e) =>
                  setTemperatureFilter(e.target.value as LeadTemperature | "all")
                }
              >
                <option value="all">Todas temperaturas</option>
                <option value="quente">Quente</option>
                <option value="morno">Morno</option>
                <option value="frio">Frio</option>
              </select>
            )}
            <ViewModeToggle
              value={viewMode}
              onChange={handleViewModeChange}
              options={[
                { value: "kanban", icon: LayoutGrid, title: "Kanban" },
                { value: "priority", icon: Flame, title: "Prioridade" },
                { value: "list", icon: List, title: "Lista" },
                { value: "charts", icon: BarChart3, title: "Gráficos" },
              ]}
            />
          </div>
        }
      />

      {viewMode === "charts" ? (
        <LeadsCharts metrics={data.metrics} />
      ) : lifecycle === "repescagem" ? (
        <RepescagemView
          items={repescagemItems}
          viewMode={viewMode === "kanban" ? "kanban" : "list"}
        />
      ) : viewMode === "priority" ? (
        <PriorityList items={filteredPipeline} />
      ) : (
        <PipelineClient
          key={`${lifecycle}-${viewMode}`}
          initialItems={filteredPipeline}
          embedded
          viewMode={viewMode === "kanban" ? "kanban" : "list"}
        />
      )}
    </div>
  );
}

function PriorityList({ items }: { items: PipelineItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhum lead na lista"
        description="Ajuste os filtros ou aguarde novos contatos."
      />
    );
  }

  return (
    <ListPanel>
      {items.map((item) => {
        const lifecycle = getEffectiveLifecycleStage(item);
        const score = computePipelineItemScore(item);
        return (
          <ListPanelItem key={item.id}>
            <div className="flex w-full items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-medium">{item.name || item.email}</p>
                  <Badge variant="outline">{score.score} pts</Badge>
                  <Badge variant="secondary">
                    {TEMPERATURE_LABELS[score.effectiveTemperature]}
                  </Badge>
                  <Badge variant="outline">{LIFECYCLE_STAGE_LABELS[lifecycle]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{item.email}</p>
                {item.phone && (
                  <p className="text-xs text-muted-foreground">{formatPhoneBr(item.phone)}</p>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {score.breakdown.slice(0, 3).map((b) => (
                    <span key={b.label} className="text-[10px] text-muted-foreground">
                      {b.label} ({b.points > 0 ? "+" : ""}
                      {b.points})
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0 space-y-1">
                {item.source && (
                  <p className="text-[10px] text-muted-foreground">
                    {LEAD_SOURCE_LABELS[item.source] ?? item.source}
                  </p>
                )}
                {item.next_action && (
                  <p className="text-xs text-muted-foreground max-w-[160px] truncate">
                    {item.next_action}
                  </p>
                )}
                <div className="flex flex-col items-end gap-1">
                  <Link
                    href={`/dashboard/crm/jornada?email=${encodeURIComponent(item.email)}`}
                    className="text-xs text-primary hover:underline"
                  >
                    Ver jornada
                  </Link>
                  {item.phone && (
                    <Link
                      href={`/dashboard/whatsapp?phone=${encodeURIComponent(
                        String(item.phone).replace(/\D/g, "")
                      )}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Abrir em Operações
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </ListPanelItem>
        );
      })}
    </ListPanel>
  );
}
