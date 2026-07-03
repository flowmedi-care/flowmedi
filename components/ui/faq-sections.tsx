"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type FaqSectionItem = {
  id: string;
  question: string;
  answer: string;
};

type FaqSectionsProps = {
  items: FaqSectionItem[];
  variant?: "cards" | "list";
  className?: string;
  /** Index of initially open item, or null for all closed */
  defaultOpenIndex?: number | null;
  emptyMessage?: string;
};

export function FaqSections({
  items,
  variant = "cards",
  className,
  defaultOpenIndex = null,
  emptyMessage = "Nenhuma pergunta cadastrada.",
}: FaqSectionsProps) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(defaultOpenIndex);

  if (items.length === 0) {
    return (
      <p className={cn("rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground", className)}>
        {emptyMessage}
      </p>
    );
  }

  if (variant === "list") {
    return (
      <div className={cn("divide-y divide-border rounded-xl border bg-card", className)}>
        {items.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={faq.id}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50 sm:px-5"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
              >
                <h3 className="text-sm font-medium text-foreground sm:text-base">{faq.question}</h3>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden px-4 transition-all duration-300 ease-in-out sm:px-5",
                  isOpen ? "max-h-[500px] pb-4 opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      {items.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={faq.id} className="flex w-full flex-col items-start">
            <button
              type="button"
              className={cn(
                "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border p-4 text-left transition-colors",
                isOpen
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-gradient-to-r from-primary/[0.04] to-background hover:border-primary/20 hover:bg-primary/[0.06]"
              )}
              onClick={() => setOpenIndex(isOpen ? null : index)}
              aria-expanded={isOpen}
            >
              <h3 className="text-sm font-medium text-foreground">{faq.question}</h3>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-primary transition-transform duration-300",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            <div
              className={cn(
                "w-full overflow-hidden px-1 transition-all duration-300 ease-in-out",
                isOpen ? "max-h-[500px] translate-y-0 pt-3 opacity-100" : "max-h-0 -translate-y-1 opacity-0"
              )}
            >
              <p className="whitespace-pre-wrap px-3 text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
