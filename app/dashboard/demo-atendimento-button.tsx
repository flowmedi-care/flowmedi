"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createDemoAtendimentoAction } from "@/app/dashboard/demo-atendimento-action";

export function DemoAtendimentoButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await createDemoAtendimentoAction();
          if (res.caseId) {
            router.push(`/dashboard/crm/jornada/${res.caseId}`);
          } else if (res.error) {
            alert(res.error);
          }
        });
      }}
    >
      {pending ? "Criando…" : "Criar atendimento demo"}
    </Button>
  );
}
