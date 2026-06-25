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
      <div className={cn("divide-y divide-[#f0f5f3]", className)}>{children}</div>
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
          "flex w-full items-center justify-between gap-4 px-5 sm:px-6 py-4 text-left text-[#1a2e28] font-medium hover:bg-[#f7faf9] transition-colors",
          isOpen && "bg-[#f7faf9]"
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
        <div className="px-5 sm:px-6 pb-5 text-[#5c6f68] leading-relaxed whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </div>
  );
}
