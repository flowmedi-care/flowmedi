import * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function AlphabetIndex({
  letters,
  activeLetter,
  availableLetters,
  onLetterClick,
  className,
}: {
  letters: string[];
  activeLetter?: string | null;
  availableLetters?: Set<string>;
  onLetterClick: (letter: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground",
        className
      )}
    >
      {letters.map((letter) => {
        const isAvailable = !availableLetters || availableLetters.has(letter);
        return (
          <button
            key={letter}
            type="button"
            disabled={!isAvailable}
            onClick={() => isAvailable && onLetterClick(letter)}
            className={cn(
              "h-4 w-4 rounded flex items-center justify-center",
              isAvailable
                ? "hover:text-primary hover:bg-primary/10 cursor-pointer"
                : "opacity-30 cursor-default",
              activeLetter === letter && isAvailable && "text-primary bg-primary/10"
            )}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}

export function ContactListItem({
  name,
  subtitle,
  avatarSrc,
  onClick,
  actions,
  className,
}: {
  name: string;
  subtitle?: string | null;
  avatarSrc?: string | null;
  onClick?: () => void;
  actions?: React.ReactNode;
  className?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
        onClick && "cursor-pointer",
        className
      )}
    >
      <Avatar name={name} src={avatarSrc} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{name}</p>
        {subtitle && (
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-1">{actions}</div>}
    </Comp>
  );
}

export function ContactListSection({
  letter,
  children,
  sectionRef,
}: {
  letter: string;
  children: React.ReactNode;
  sectionRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div ref={sectionRef} data-letter={letter} className="space-y-1">
      <p className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {letter}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function ContactList({
  children,
  className,
  sideRail,
  scrollRef,
}: {
  children: React.ReactNode;
  className?: string;
  sideRail?: React.ReactNode;
  scrollRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      className={cn("flex gap-2 min-h-0", className)}
      style={{ minHeight: "min(70vh, calc(100dvh - 18rem))" }}
    >
      <div
        ref={scrollRef}
        className="flex-1 min-w-0 min-h-0 overflow-y-auto space-y-4 pr-1"
      >
        {children}
      </div>
      {sideRail && (
        <div className="hidden sm:flex flex-col shrink-0 self-stretch border-l border-border/40 pl-1 overflow-y-auto min-h-0">
          {sideRail}
        </div>
      )}
    </div>
  );
}
