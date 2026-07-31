"use client";

import { Button } from "@/components/ui/button";
import { MINI_AHA } from "@/lib/onboarding/copy";
import { CheckCircle2 } from "lucide-react";

export function MiniAhaBeat({
  onContinue,
  onLater,
  pending,
}: {
  onContinue: () => void;
  onLater: () => void;
  pending?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{MINI_AHA.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{MINI_AHA.body}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={onContinue} disabled={pending}>
            {MINI_AHA.continueLabel}
          </Button>
          <Button className="flex-1" variant="outline" onClick={onLater} disabled={pending}>
            {MINI_AHA.laterLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
