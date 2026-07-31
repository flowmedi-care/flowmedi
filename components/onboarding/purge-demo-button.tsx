"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { purgeOnboardingDemoAction } from "@/lib/onboarding/actions";

export function PurgeDemoButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm("Apagar todos os dados de demonstração (Maria, consulta demo, etc.)?")) {
          return;
        }
        startTransition(async () => {
          await purgeOnboardingDemoAction();
          window.location.reload();
        });
      }}
    >
      {pending ? "Apagando…" : "Apagar dados demo"}
    </Button>
  );
}
