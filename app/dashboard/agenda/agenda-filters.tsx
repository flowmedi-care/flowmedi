"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, X, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  falta: "Falta",
  cancelada: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  agendada: "border-border",
  confirmada: "border-primary",
  realizada: "border-green-500",
  falta: "border-yellow-500",
  cancelada: "border-red-500",
};

type StatusFilterProps = {
  selectedStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
};

function StatusFilter({ selectedStatuses, onStatusChange }: StatusFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleStatus = (status: string) => {
    const newStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status];
    onStatusChange(newStatuses);
  };

  const selectAll = () => {
    onStatusChange(Object.keys(STATUS_LABEL));
  };

  const clearAll = () => {
    onStatusChange([]);
  };

  const allSelected = selectedStatuses.length === Object.keys(STATUS_LABEL).length;
  const noneSelected = selectedStatuses.length === 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-8 gap-2",
          selectedStatuses.length > 0 && "border-primary bg-primary/5"
        )}
      >
        <Filter className="h-3.5 w-3.5" />
        <span className="text-xs">Status</span>
        {selectedStatuses.length > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {selectedStatuses.length}
          </Badge>
        )}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <Card className="absolute top-full left-0 mt-1 z-50 w-64 shadow-lg border border-border" style={{ backgroundColor: 'hsl(var(--background))', opacity: 1 }}>
          <CardContent className="p-2" style={{ backgroundColor: 'hsl(var(--background))', opacity: 1 }}>
            <div className="space-y-1" style={{ backgroundColor: 'hsl(var(--background))', opacity: 1 }}>
              {/* Header com ações */}
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-border" style={{ backgroundColor: 'hsl(var(--background))', opacity: 1 }}>
                <span className="text-xs font-medium text-muted-foreground">Status</span>
                <div className="flex items-center gap-1">
                  {!allSelected && (
                    <button
                      onClick={selectAll}
                      className="text-xs text-primary hover:underline px-1"
                    >
                      Todos
                    </button>
                  )}
                  {!noneSelected && (
                    <button
                      onClick={clearAll}
                      className="text-xs text-muted-foreground hover:underline px-1"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de checkboxes */}
              <div className="max-h-64 overflow-y-auto" style={{ backgroundColor: 'hsl(var(--background))', opacity: 1 }}>
                {Object.entries(STATUS_LABEL).map(([value, label]) => {
                  const isChecked = selectedStatuses.includes(value);
                  return (
                    <label
                      key={value}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/50 transition-colors",
                        isChecked && "bg-primary/5"
                      )}
                      style={{ backgroundColor: isChecked ? 'hsl(var(--primary) / 0.05)' : 'hsl(var(--background))', opacity: 1 }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleStatus(value)}
                        className="sr-only"
                      />
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                          STATUS_COLORS[value],
                          isChecked && "bg-primary border-primary"
                        )}
                      >
                        {isChecked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                      </div>
                      <span className="text-sm flex-1">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type FormFilterProps = {
  selectedFilter: "confirmados_sem_formulario" | "confirmados_com_formulario" | null;
  onFilterChange: (filter: "confirmados_sem_formulario" | "confirmados_com_formulario" | null) => void;
};

function FormFilter({ selectedFilter, onFilterChange }: FormFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const options = [
    { value: null, label: "Todos os formulários" },
    { value: "confirmados_sem_formulario" as const, label: "Confirmados sem formulário" },
    { value: "confirmados_com_formulario" as const, label: "Confirmados com formulário" },
  ];

  const selectedLabel = options.find((opt) => opt.value === selectedFilter)?.label || "Formulários";

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-8 gap-2",
          selectedFilter && "border-primary bg-primary/5"
        )}
      >
        <Filter className="h-3.5 w-3.5" />
        <span className="text-xs">{selectedFilter ? selectedLabel : "Formulários"}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <Card className="absolute top-full left-0 mt-1 z-50 w-64 shadow-lg border border-border" style={{ backgroundColor: 'hsl(var(--background))', opacity: 1 }}>
          <CardContent className="p-2" style={{ backgroundColor: 'hsl(var(--background))', opacity: 1 }}>
            <div className="space-y-1" style={{ backgroundColor: 'hsl(var(--background))', opacity: 1 }}>
              <div className="px-2 py-1.5 border-b border-border" style={{ backgroundColor: 'hsl(var(--background))', opacity: 1 }}>
                <span className="text-xs font-medium text-muted-foreground">Formulários</span>
              </div>
              <div style={{ backgroundColor: 'hsl(var(--background))', opacity: 1 }}>
                {options.map((option) => {
                  const isSelected = option.value === selectedFilter;
                  return (
                    <label
                      key={option.value || "all"}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/50 transition-colors",
                        isSelected && "bg-primary/5"
                      )}
                      style={{ backgroundColor: isSelected ? 'hsl(var(--primary) / 0.05)' : 'hsl(var(--background))', opacity: 1 }}
                      onClick={() => {
                        onFilterChange(option.value);
                        setIsOpen(false);
                      }}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                          isSelected ? "bg-primary border-primary" : "border-border"
                        )}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                      </div>
                      <span className="text-sm flex-1">{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type AgendaFiltersProps = {
  statusFilter: string[];
  formFilter: "confirmados_sem_formulario" | "confirmados_com_formulario" | null;
  onStatusChange: (statuses: string[]) => void;
  onFormChange: (filter: "confirmados_sem_formulario" | "confirmados_com_formulario" | null) => void;
};

export function AgendaFilters({
  statusFilter,
  formFilter,
  onStatusChange,
  onFormChange,
}: AgendaFiltersProps) {
  const hasActiveFilters = statusFilter.length > 0 || formFilter !== null;

  const clearAll = () => {
    onStatusChange([]);
    onFormChange(null);
  };

  return (
    <div className="flex items-center gap-2">
      <StatusFilter selectedStatuses={statusFilter} onStatusChange={onStatusChange} />
      <FormFilter selectedFilter={formFilter} onFilterChange={onFormChange} />
      
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="h-8 text-xs gap-1"
          title="Limpar todos os filtros"
        >
          <X className="h-3.5 w-3.5" />
          Limpar
        </Button>
      )}
    </div>
  );
}
