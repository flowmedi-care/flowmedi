"use client";

import { useEffect, useMemo, useState } from "react";
import { PipelineClient } from "../../pipeline/pipeline-client";
import { FilterBar } from "@/components/dashboard-ui/layout/filter-bar";
import { ViewModeToggle } from "@/components/dashboard-ui/layout/view-mode-toggle";
import { SegmentedTabs } from "@/components/dashboard-ui/layout/segmented-tabs";
import { LayoutGrid, List, BarChart3 } from "lucide-react";
import type { LeadsHubData } from "./actions";
import {
  filterPipelineBySegment,
  LEAD_SEGMENT_LABELS,
  type LeadHubSegment,
} from "@/lib/leads/segments";
import { LeadsCharts } from "./leads-charts";
import { RepescagemView } from "./repescagem-view";

type HubViewMode = "kanban" | "list" | "charts";

const VIEW_MODE_KEY = "leads-hub-view-mode";

export function LeadsHubClient({ data }: { data: LeadsHubData }) {
  const [segment, setSegment] = useState<LeadHubSegment>("captacao");
  const [viewMode, setViewMode] = useState<HubViewMode>("kanban");

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === "kanban" || stored === "list" || stored === "charts") {
      setViewMode(stored);
    }
  }, []);

  function handleViewModeChange(mode: HubViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }

  const segmentTabs = useMemo(
    () =>
      (Object.keys(LEAD_SEGMENT_LABELS) as LeadHubSegment[]).map((id) => ({
        id,
        label: LEAD_SEGMENT_LABELS[id],
        count: data.metrics.bySegment[id],
      })),
    [data.metrics.bySegment]
  );

  const filteredPipeline = useMemo(
    () => filterPipelineBySegment(data.pipeline, segment),
    [data.pipeline, segment]
  );

  const repescagemItems = useMemo(() => {
    if (segment !== "repescagem") return [];
    return data.repescagem;
  }, [data.repescagem, segment]);

  return (
    <div className="space-y-4">
      <SegmentedTabs
        tabs={segmentTabs}
        value={segment}
        onChange={(id) => setSegment(id as LeadHubSegment)}
        variant="underline"
      />

      <FilterBar
        actions={
          <ViewModeToggle
            value={viewMode}
            onChange={handleViewModeChange}
            options={[
              { value: "kanban", icon: LayoutGrid, title: "Kanban" },
              { value: "list", icon: List, title: "Lista" },
              { value: "charts", icon: BarChart3, title: "Gráficos" },
            ]}
          />
        }
      />

      {viewMode === "charts" ? (
        <LeadsCharts metrics={data.metrics} />
      ) : segment === "repescagem" ? (
        <RepescagemView items={repescagemItems} viewMode={viewMode} />
      ) : (
        <PipelineClient
          key={`${segment}-${viewMode}`}
          initialItems={filteredPipeline}
          embedded
          viewMode={viewMode === "kanban" ? "kanban" : "list"}
        />
      )}
    </div>
  );
}
