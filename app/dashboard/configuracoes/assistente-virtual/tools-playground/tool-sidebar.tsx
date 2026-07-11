"use client";

import { AlertTriangle, ChevronRight, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ASSISTANT_TOOL_CATALOG,
  ASSISTANT_TOOL_CATEGORY_LABELS,
  type AssistantToolCategory,
} from "@/lib/virtual-assistant/tools/catalog";
import { cn } from "@/lib/utils";
import { CHATBOT_TOOL_SET, MUTATING_TOOLS } from "./utils";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  categoryFilter: AssistantToolCategory | "all";
  onCategoryChange: (v: AssistantToolCategory | "all") => void;
  selectedTool: string;
  onSelectTool: (name: string) => void;
  executorMode: "production" | "full";
};

export function ToolSidebar({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  selectedTool,
  onSelectTool,
  executorMode,
}: Props) {
  const q = search.trim().toLowerCase();
  const filtered = ASSISTANT_TOOL_CATALOG.filter((tool) => {
    if (categoryFilter !== "all" && tool.category !== categoryFilter) return false;
    if (executorMode === "production" && !CHATBOT_TOOL_SET.has(tool.name)) return false;
    if (!q) return true;
    return (
      tool.name.toLowerCase().includes(q) ||
      tool.label.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q)
    );
  });

  return (
    <Card className="h-fit lg:sticky lg:top-4">
      <CardHeader className="space-y-3 pb-3">
        <CardTitle className="text-base">Ferramentas</CardTitle>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value as AssistantToolCategory | "all")}
        >
          <option value="all">Todas as categorias</option>
          {(Object.keys(ASSISTANT_TOOL_CATEGORY_LABELS) as AssistantToolCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {ASSISTANT_TOOL_CATEGORY_LABELS[cat]}
            </option>
          ))}
        </Select>
      </CardHeader>
      <CardContent className="max-h-[60vh] space-y-1 overflow-y-auto p-2 pt-0">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">Nenhuma ferramenta encontrada.</p>
        ) : (
          filtered.map((tool) => (
            <button
              key={tool.name}
              type="button"
              onClick={() => onSelectTool(tool.name)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                selectedTool === tool.name
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  selectedTool === tool.name ? "opacity-100" : "opacity-40"
                )}
              />
              <span className="min-w-0 flex-1 truncate font-medium">{tool.label}</span>
              {MUTATING_TOOLS.has(tool.name) && (
                <AlertTriangle
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    selectedTool === tool.name ? "text-primary-foreground/80" : "text-amber-600"
                  )}
                />
              )}
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
