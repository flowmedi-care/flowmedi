"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  COMMITMENT,
  FULL_AHA_BEATS,
  FULL_AHA_MODULES,
  POST_AHA_CTAS,
} from "@/lib/onboarding/copy";
import {
  markAhaDoneAction,
  purgeOnboardingDemoAction,
  trackActivationEventAction,
} from "@/lib/onboarding/actions";
import { PartyPopper, Check } from "lucide-react";

export function FullAhaScreen({
  onClose,
}: {
  onClose?: () => void;
}) {
  const [beat, setBeat] = useState(0);
  const [pending, startTransition] = useTransition();
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    if (beat >= FULL_AHA_BEATS.length - 1) return;
    const t = setTimeout(() => setBeat((b) => b + 1), 1600);
    return () => clearTimeout(t);
  }, [beat]);

  function handleCta(id: string, href: string) {
    startTransition(async () => {
      await trackActivationEventAction("post_aha_cta_clicked", { cta: id });
      await markAhaDoneAction();
      window.location.href = href;
    });
  }

  function handleDone() {
    startTransition(async () => {
      await markAhaDoneAction();
      onClose?.();
      window.location.href = "/dashboard";
    });
  }

  async function handlePurge() {
    setPurging(true);
    await purgeOnboardingDemoAction();
    await markAhaDoneAction();
    setPurging(false);
    window.location.href = "/dashboard";
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-background/90 p-4 backdrop-blur-md">
      <div className="my-8 w-full max-w-lg space-y-6 rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <PartyPopper className="h-7 w-7" />
        </div>

        <div className="min-h-[4.5rem] space-y-2">
          {FULL_AHA_BEATS.slice(0, beat + 1).map((text, i) => (
            <p
              key={text}
              className={
                i === 0
                  ? "text-xl font-semibold tracking-tight text-foreground"
                  : "text-sm text-muted-foreground"
              }
            >
              {text}
            </p>
          ))}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Você acabou de usar
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {FULL_AHA_MODULES.map((m) => (
              <li
                key={m}
                className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-sm font-medium"
              >
                <Check className="h-4 w-4 text-emerald-600" />
                {m}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1 border-t border-border pt-4">
          <h3 className="text-base font-semibold">{COMMITMENT.title}</h3>
          <p className="text-sm text-muted-foreground">{COMMITMENT.body}</p>
        </div>

        <div className="flex flex-col gap-2">
          {POST_AHA_CTAS.map((cta) => (
            <Button
              key={cta.id}
              variant={cta.id === "equipe" ? "default" : "outline"}
              disabled={pending}
              onClick={() => handleCta(cta.id, cta.href)}
            >
              {cta.label}
            </Button>
          ))}
          <Button variant="ghost" disabled={pending} onClick={handleDone} asChild={false}>
            Ir para a Visão Geral
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            disabled={purging || pending}
            onClick={handlePurge}
          >
            {purging ? "Apagando…" : "Apagar dados demo"}
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            Tudo na demonstração é reversível.{" "}
            <Link href="/dashboard/configuracoes" className="underline-offset-2 hover:underline">
              Configurações
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
