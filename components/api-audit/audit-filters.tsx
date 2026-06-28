"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiCategory, AuditRiskLevel, HttpMethod } from "@/lib/api-audit/types";

export type TestStatusFilter = "all" | "untested" | "aprovado" | "atencao" | "critico";

export interface AuditFilterState {
  search: string;
  method: HttpMethod | "all";
  category: ApiCategory | "all";
  risk: AuditRiskLevel | "all";
  testStatus: TestStatusFilter;
}

interface AuditFiltersProps {
  filters: AuditFilterState;
  onChange: (next: AuditFilterState) => void;
}

const METHODS: (HttpMethod | "all")[] = ["all", "GET", "POST", "PUT", "PATCH", "DELETE"];
const CATEGORIES: (ApiCategory | "all")[] = [
  "all",
  "publico",
  "autenticado",
  "administrador",
  "sistema",
  "webhook",
  "cron",
];
const RISKS: (AuditRiskLevel | "all")[] = [
  "all",
  "critico",
  "alto",
  "medio",
  "baixo",
  "informativo",
];
const STATUSES: TestStatusFilter[] = ["all", "untested", "aprovado", "atencao", "critico"];

export function AuditFilters({ filters, onChange }: AuditFiltersProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <div className="lg:col-span-2 space-y-1">
        <Label htmlFor="audit-search">Buscar</Label>
        <Input
          id="audit-search"
          placeholder="Endpoint, URL ou arquivo…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
      <FilterSelect
        label="Método"
        value={filters.method}
        options={METHODS}
        onChange={(method) => onChange({ ...filters, method: method as HttpMethod | "all" })}
      />
      <FilterSelect
        label="Categoria"
        value={filters.category}
        options={CATEGORIES}
        onChange={(category) =>
          onChange({ ...filters, category: category as ApiCategory | "all" })
        }
      />
      <FilterSelect
        label="Risco"
        value={filters.risk}
        options={RISKS}
        onChange={(risk) => onChange({ ...filters, risk: risk as AuditRiskLevel | "all" })}
      />
      <FilterSelect
        label="Status teste"
        value={filters.testStatus}
        options={STATUSES}
        onChange={(testStatus) =>
          onChange({ ...filters, testStatus: testStatus as TestStatusFilter })
        }
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "all" ? "Todos" : o}
          </option>
        ))}
      </select>
    </div>
  );
}
