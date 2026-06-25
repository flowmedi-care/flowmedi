"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type AccordionContextValue = {
  openId: string | null;
  toggle: (id: string) => void;
};

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

export function Accordion({
  children,
  className,
  defaultOpenId,
}: {
  children: React.ReactNode;
  className?: string;
  defaultOpenId?: string | null;
}) {
  const [openId, setOpenId] = React.useState<string | null>(defaultOpenId ?? null);

  const toggle = React.useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <AccordionContext.Provider value={{ openId, toggle }}>
      <div className={cn("divide-y divide-border rounded-lg border", className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  id,
  question,
  answer,
}: {
  id: string;
  question: string;
  answer: string;
}) {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) return null;

  const isOpen = ctx.openId === id;

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => ctx.toggle(id)}
        aria-expanded={isOpen}
      >
        <span>{question}</span>
        <span className="text-muted-foreground shrink-0">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-wrap">{answer}</div>
      )}
    </div>
  );
}
