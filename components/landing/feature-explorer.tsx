"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LANDING_FEATURES,
  type FeatureDetail,
  type FeatureDetailVisual,
} from "@/lib/landing/content";
import { PublicSectionHeader } from "@/components/landing/public-section-header";
import { cn } from "@/lib/utils";

interface FeatureExplorerProps {
  showHeader?: boolean;
  className?: string;
}

function DetailVisual({ type }: { type: FeatureDetailVisual }) {
  const shell = "relative h-14 w-full overflow-hidden rounded-lg bg-muted/70 p-2";

  switch (type) {
    case "calendar-grid":
      return (
        <div className={shell} aria-hidden>
          <div className="grid h-full grid-cols-7 gap-0.5">
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-[2px]",
                  i === 8 || i === 10 ? "bg-primary/70" : "bg-background/80"
                )}
              />
            ))}
          </div>
        </div>
      );
    case "status-row":
      return (
        <div className={cn(shell, "flex flex-col justify-center gap-1.5")} aria-hidden>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="h-1.5 flex-1 rounded-full bg-background/90" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="h-1.5 w-3/4 rounded-full bg-background/70" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            <span className="h-1.5 w-1/2 rounded-full bg-background/60" />
          </div>
        </div>
      );
    case "team-avatars":
      return (
        <div className={cn(shell, "flex items-center justify-center gap-1")} aria-hidden>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary/20 text-[10px] font-bold text-primary"
              style={{ marginLeft: i === 0 ? 0 : -6 }}
            >
              {String.fromCharCode(65 + i)}
            </div>
          ))}
        </div>
      );
    case "form-fields":
      return (
        <div className={cn(shell, "flex flex-col justify-center gap-1.5")} aria-hidden>
          <div className="h-2 w-2/5 rounded-full bg-muted-foreground/25" />
          <div className="h-4 w-full rounded border border-border/80 bg-background/90" />
          <div className="h-2 w-1/3 rounded-full bg-muted-foreground/20" />
          <div className="h-4 w-full rounded border border-border/80 bg-background/90" />
        </div>
      );
    case "checklist":
      return (
        <div className={cn(shell, "flex flex-col justify-center gap-1.5")} aria-hidden>
          {[true, true, false].map((done, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded border text-[8px]",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                )}
              >
                {done ? "✓" : ""}
              </span>
              <span className={cn("h-1.5 rounded-full bg-background/80", i === 2 ? "w-2/5" : "flex-1")} />
            </div>
          ))}
        </div>
      );
    case "patient-card":
      return (
        <div className={cn(shell, "flex items-center gap-2")} aria-hidden>
          <div className="h-8 w-8 shrink-0 rounded-full bg-primary/25" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="h-2 w-3/5 rounded-full bg-foreground/20" />
            <div className="h-1.5 w-full rounded-full bg-background/80" />
            <div className="h-1.5 w-4/5 rounded-full bg-background/60" />
          </div>
        </div>
      );
    case "message-bubbles":
      return (
        <div className={cn(shell, "flex flex-col justify-center gap-1.5")} aria-hidden>
          <div className="ml-auto h-4 w-3/5 rounded-lg rounded-br-sm bg-primary/70" />
          <div className="h-4 w-2/3 rounded-lg rounded-bl-sm bg-background/90" />
          <div className="ml-auto h-4 w-2/5 rounded-lg rounded-br-sm bg-primary/50" />
        </div>
      );
    case "reminder":
      return (
        <div className={cn(shell, "flex items-center gap-2")} aria-hidden>
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/25">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-amber-600/70" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="h-2 w-4/5 rounded-full bg-foreground/20" />
            <div className="h-1.5 w-1/2 rounded-full bg-background/70" />
          </div>
        </div>
      );
    case "whatsapp":
      return (
        <div className={cn(shell, "flex items-center justify-center gap-2")} aria-hidden>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/90 text-sm font-bold text-white">
            W
          </div>
          <div className="space-y-1">
            <div className="h-2 w-16 rounded-full bg-background/90" />
            <div className="h-1.5 w-12 rounded-full bg-background/60" />
          </div>
        </div>
      );
    case "site-preview":
      return (
        <div className={cn(shell, "flex flex-col gap-1")} aria-hidden>
          <div className="flex items-center gap-1 rounded bg-background/80 px-1.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            <span className="h-1 flex-1 rounded-full bg-muted-foreground/20" />
          </div>
          <div className="flex-1 rounded bg-primary/15" />
        </div>
      );
    case "brand-swatch":
      return (
        <div className={cn(shell, "flex items-center justify-center gap-2")} aria-hidden>
          {["bg-primary", "bg-primary/60", "bg-primary/30", "bg-muted-foreground/30"].map((c) => (
            <div key={c} className={cn("h-7 w-7 rounded-full border border-background shadow-sm", c)} />
          ))}
        </div>
      );
    case "search-rank":
      return (
        <div className={cn(shell, "flex flex-col justify-center gap-1")} aria-hidden>
          <div className="h-3 w-full rounded bg-background/90 px-1 flex items-center">
            <span className="h-1.5 w-1/2 rounded-full bg-muted-foreground/25" />
          </div>
          <div className="space-y-0.5 pl-1">
            <div className="h-1.5 w-3/5 rounded-full bg-primary/50" />
            <div className="h-1 w-4/5 rounded-full bg-background/70" />
            <div className="h-1 w-2/3 rounded-full bg-background/50" />
          </div>
        </div>
      );
    case "booking-steps":
      return (
        <div className={cn(shell, "flex items-center justify-center gap-1")} aria-hidden>
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                  n === 1 ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                )}
              >
                {n}
              </div>
              {n < 3 && <div className="h-0.5 w-3 bg-border" />}
            </div>
          ))}
        </div>
      );
    case "procedure-list":
      return (
        <div className={cn(shell, "flex flex-col justify-center gap-1")} aria-hidden>
          {[1, 0.75, 0.55].map((w, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded border border-border/70 bg-background/80 px-1.5 py-1"
            >
              <span className="h-2 w-2 rounded-sm bg-primary/50" />
              <span className="h-1.5 rounded-full bg-muted-foreground/25" style={{ width: `${w * 100}%` }} />
            </div>
          ))}
        </div>
      );
    case "confirm-check":
      return (
        <div className={cn(shell, "flex items-center justify-center")} aria-hidden>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 text-sm font-bold">
            ✓
          </div>
        </div>
      );
    case "role-badges":
      return (
        <div className={cn(shell, "flex flex-wrap items-center justify-center gap-1")} aria-hidden>
          {["Admin", "Sec.", "Prof."].map((label) => (
            <span
              key={label}
              className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary"
            >
              {label}
            </span>
          ))}
        </div>
      );
    case "permission-toggles":
      return (
        <div className={cn(shell, "flex flex-col justify-center gap-1.5")} aria-hidden>
          {[true, true, false].map((on, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="h-1.5 flex-1 rounded-full bg-background/80" />
              <span
                className={cn(
                  "relative h-3.5 w-6 rounded-full",
                  on ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white",
                    on ? "right-0.5" : "left-0.5"
                  )}
                />
              </span>
            </div>
          ))}
        </div>
      );
    case "access-log":
      return (
        <div className={cn(shell, "flex flex-col justify-center gap-1 font-mono")} aria-hidden>
          {["12:04 · login", "12:11 · edição", "12:18 · export"].map((line) => (
            <div key={line} className="truncate text-[9px] text-muted-foreground">
              {line}
            </div>
          ))}
        </div>
      );
    case "chart-bars":
      return (
        <div className={cn(shell, "flex items-end justify-center gap-1 px-3 pb-1")} aria-hidden>
          {[40, 65, 45, 80, 55, 70].map((h, i) => (
            <div
              key={i}
              className="w-2 rounded-t bg-primary/70"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      );
    case "export-sheet":
      return (
        <div className={cn(shell, "flex items-center justify-center")} aria-hidden>
          <div className="flex h-10 w-8 flex-col overflow-hidden rounded border border-border bg-background shadow-sm">
            <div className="h-2 bg-primary/40" />
            <div className="flex-1 space-y-0.5 p-1">
              <div className="h-0.5 w-full bg-muted-foreground/20" />
              <div className="h-0.5 w-4/5 bg-muted-foreground/15" />
              <div className="h-0.5 w-full bg-muted-foreground/20" />
            </div>
          </div>
        </div>
      );
    case "kpi-tiles":
      return (
        <div className={cn(shell, "grid grid-cols-2 gap-1")} aria-hidden>
          {["84%", "32", "12", "96%"].map((v) => (
            <div
              key={v}
              className="flex items-center justify-center rounded bg-background/80 text-[10px] font-bold text-primary"
            >
              {v}
            </div>
          ))}
        </div>
      );
    case "lock-shield":
      return (
        <div className={cn(shell, "flex items-center justify-center")} aria-hidden>
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <span className="h-4 w-3.5 rounded-sm border-2 border-primary/70" />
            <span className="absolute top-[11px] h-2 w-2 rounded-full border-2 border-primary/70 bg-transparent" />
          </div>
        </div>
      );
    case "consent":
      return (
        <div className={cn(shell, "flex items-center gap-2")} aria-hidden>
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-primary bg-primary/20 text-[10px] text-primary">
            ✓
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="h-1.5 w-full rounded-full bg-background/90" />
            <div className="h-1.5 w-3/5 rounded-full bg-background/60" />
          </div>
        </div>
      );
    case "legal-docs":
      return (
        <div className={cn(shell, "flex items-end justify-center gap-1 pt-1")} aria-hidden>
          {[10, 12, 9].map((h, i) => (
            <div
              key={i}
              className="w-5 rounded-t border border-border bg-background shadow-sm"
              style={{ height: `${h * 3}px` }}
            >
              <div className="m-0.5 space-y-0.5">
                <div className="h-0.5 w-full bg-muted-foreground/25" />
                <div className="h-0.5 w-3/4 bg-muted-foreground/15" />
              </div>
            </div>
          ))}
        </div>
      );
    case "rights-inbox":
      return (
        <div className={cn(shell, "flex flex-col justify-center gap-1")} aria-hidden>
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded border border-border/70 bg-background/80 px-1.5 py-1"
            >
              <span className="h-2 w-2 rounded-full bg-primary/60" />
              <span className="h-1.5 flex-1 rounded-full bg-muted-foreground/20" />
            </div>
          ))}
        </div>
      );
    default:
      return <div className={shell} aria-hidden />;
  }
}

function FeatureDetailCard({ detail }: { detail: FeatureDetail }) {
  return (
    <article className="flex flex-col rounded-xl border border-border bg-card/80 p-4 transition-colors hover:border-primary/25 hover:bg-card">
      <DetailVisual type={detail.visual} />
      <h4 className="mt-3 text-sm font-semibold text-foreground">{detail.title}</h4>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail.description}</p>
    </article>
  );
}

export function FeatureExplorer({ showHeader = true, className }: FeatureExplorerProps) {
  const [activeId, setActiveId] = useState(LANDING_FEATURES[0].id);
  const active = LANDING_FEATURES.find((f) => f.id === activeId) ?? LANDING_FEATURES[0];
  const ActiveIcon = active.icon;

  return (
    <section className={cn("py-20 md:py-28", className)} id="recursos">
      <div className="container mx-auto px-4">
        {showHeader && (
          <PublicSectionHeader
            eyebrow="Plataforma"
            title="Tudo que sua clínica precisa"
            description="Módulos que trabalham juntos para organizar agenda, pacientes, comunicação e o dia a dia da clínica — de forma simples."
            className="mb-14"
          />
        )}

        <div className="mx-auto max-w-6xl grid gap-8 lg:grid-cols-[280px_1fr] lg:gap-10">
          <nav
            className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
            aria-label="Recursos da plataforma"
          >
            {LANDING_FEATURES.map((feature) => {
              const Icon = feature.icon;
              const isActive = feature.id === activeId;
              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => setActiveId(feature.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all duration-200 lg:items-start",
                    isActive
                      ? "bg-primary/10 border border-primary/20 shadow-sm"
                      : "border border-transparent hover:bg-muted/60"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "font-semibold text-sm whitespace-nowrap lg:whitespace-normal",
                        isActive ? "text-foreground" : "text-foreground/80"
                      )}
                    >
                      {feature.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>

          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="min-w-0"
            >
              <div className="mb-6 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ActiveIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-2xl font-bold text-foreground">{active.title}</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{active.description}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {active.details.map((detail) => (
                  <FeatureDetailCard key={detail.title} detail={detail} />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto", className)}>
      {LANDING_FEATURES.map((feature) => {
        const Icon = feature.icon;
        return (
          <article
            key={feature.id}
            id={feature.id}
            className="group surface-elevated p-6 transition-all hover:border-primary/30 hover:shadow-elevated-lg scroll-mt-24"
          >
            <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-lg">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            <ul className="mt-4 space-y-2">
              {feature.details.map((detail) => (
                <li key={detail.title} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>
                    <span className="font-medium text-foreground/80">{detail.title}</span>
                    {" — "}
                    {detail.description}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
