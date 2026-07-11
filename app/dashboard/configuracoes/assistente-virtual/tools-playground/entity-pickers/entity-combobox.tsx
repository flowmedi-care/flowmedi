"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export type EntityOption = {
  id: string;
  label: string;
  sublabel?: string;
  meta?: string;
};

export function EntityCombobox({
  value,
  onChange,
  options,
  onSearch,
  label,
  placeholder = "Buscar...",
  disabled,
  loading: externalLoading,
}: {
  value: EntityOption | null;
  onChange: (option: EntityOption | null) => void;
  options: EntityOption[];
  onSearch?: (query: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const loading = externalLoading ?? internalLoading;

  useEffect(() => {
    if (value?.label) setQuery(value.label);
  }, [value?.id, value?.label]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!onSearch || !open) return;
    setInternalLoading(true);
    const timer = setTimeout(() => {
      onSearch(query.trim());
      setInternalLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open, onSearch]);

  const filtered = onSearch
    ? options
    : options.filter((o) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          o.label.toLowerCase().includes(q) ||
          o.sublabel?.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
        );
      });

  return (
    <div ref={containerRef} className="relative space-y-1">
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className="pl-9"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value && e.target.value !== value.label) onChange(null);
          }}
        />
      </div>
      {value && (
        <p className="text-xs text-muted-foreground">
          Selecionado: <span className="font-medium">{value.label}</span>
          <span className="ml-1 font-mono text-[10px] opacity-60">{value.id.slice(0, 8)}…</span>
        </p>
      )}
      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {loading && <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>}
          {!loading && filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado.</p>
          )}
          {!loading &&
            filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors",
                  value?.id === opt.id && "bg-muted/70"
                )}
                onClick={() => {
                  onChange(opt);
                  setQuery(opt.label);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{opt.label}</span>
                {opt.sublabel && (
                  <span className="ml-2 text-xs text-muted-foreground">{opt.sublabel}</span>
                )}
                {opt.meta && <span className="block text-[10px] text-muted-foreground/70">{opt.meta}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
