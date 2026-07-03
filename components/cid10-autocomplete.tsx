"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchCid10 } from "@/lib/clinical-documents/cid10";
import { cn } from "@/lib/utils";

export function Cid10Autocomplete({
  value,
  onChange,
  id = "cert-cid",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const results = searchCid10(query);

  return (
    <div ref={containerRef} className="relative">
      <Label htmlFor={id}>CID (opcional)</Label>
      <Input
        id={id}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Ex.: J06.9 — busque por código ou descrição"
        className="mt-1"
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul
          className={cn(
            "absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md",
            "text-sm"
          )}
        >
          {results.map((entry) => (
            <li key={entry.code}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted"
                onClick={() => {
                  const v = `${entry.code} — ${entry.description}`;
                  setQuery(v);
                  onChange(v);
                  setOpen(false);
                }}
              >
                <span className="font-mono text-xs text-primary">{entry.code}</span>
                <span className="block text-muted-foreground text-xs mt-0.5">
                  {entry.description}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
