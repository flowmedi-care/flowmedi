"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
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
      <div className={cn("divide-y divide-border", className)}>{children}</div>
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
        className={cn(
          "flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-foreground transition-colors duration-micro hover:bg-muted sm:px-6",
          isOpen && "bg-muted"
        )}
        onClick={() => ctx.toggle(id)}
        aria-expanded={isOpen}
      >
        <span>{question}</span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-primary transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <div className="whitespace-pre-wrap px-5 pb-5 leading-relaxed text-muted-foreground sm:px-6">
          {answer}
        </div>
      )}
    </div>
  );
}
