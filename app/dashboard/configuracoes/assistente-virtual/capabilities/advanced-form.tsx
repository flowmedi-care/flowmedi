"use client";

import type { CapabilityFormProps } from "@/lib/assistant-capabilities/types";
import type { AdvancedSettings } from "@/lib/assistant-capabilities/advanced/types";
import { Button } from "@/components/ui/button";
import { useAssistantNav } from "./nav-context";

export function AdvancedCapabilityForm(_props: CapabilityFormProps<AdvancedSettings>) {
  const { openTopTab } = useAssistantNav();
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Ferramentas técnicas para times que operam o assistente.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => openTopTab("pipeline")}>
          Pipeline
        </Button>
        <Button type="button" variant="outline" onClick={() => openTopTab("ferramentas")}>
          Ferramentas
        </Button>
        <Button type="button" variant="outline" onClick={() => openTopTab("diagnostico")}>
          Diagnóstico
        </Button>
      </div>
    </div>
  );
}
