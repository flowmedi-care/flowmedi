"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Search, User } from "lucide-react";

export type PatientOption = {
  id: string;
  full_name: string | null;
  phone?: string;
};

export function PatientCombobox({
  value,
  onChange,
  label = "Paciente",
  placeholder = "Buscar paciente por nome...",
  disabled,
}: {
  value: PatientOption | null;
  onChange: (patient: PatientOption | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value?.full_name ?? "");
  const [options, setOptions] = useState<PatientOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value?.full_name) setQuery(value.full_name);
  }, [value?.id, value?.full_name]);

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
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.trim();
        const res = await fetch(
          `/api/patients/search?all=1${q ? `&q=${encodeURIComponent(q)}` : ""}`
        );
        const json = await res.json();
        if (res.ok) {
          setOptions(
            (json.contacts ?? []).map((c: { id: string; full_name: string | null; phone?: string }) => ({
              id: c.id,
              full_name: c.full_name,
              phone: c.phone,
            }))
          );
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open]);

  return (
    <div ref={containerRef} className="relative space-y-1">
      <Label>{label}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className="pl-9"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value && e.target.value !== value.full_name) {
              onChange(null);
            }
          }}
        />
      </div>
      {value && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <User className="h-3 w-3" />
          Selecionado: {value.full_name ?? "Paciente"}
          {value.phone ? ` · ${value.phone}` : ""}
        </p>
      )}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto"
          )}
        >
          {loading && (
            <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
          )}
          {!loading && options.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
          )}
          {!loading &&
            options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                onClick={() => {
                  onChange(opt);
                  setQuery(opt.full_name ?? "");
                  setOpen(false);
                }}
              >
                <span className="font-medium">{opt.full_name ?? "Sem nome"}</span>
                {opt.phone && (
                  <span className="text-muted-foreground ml-2 text-xs">{opt.phone}</span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
