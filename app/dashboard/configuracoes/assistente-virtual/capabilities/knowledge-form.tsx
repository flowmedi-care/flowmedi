"use client";

import type { CapabilityFormProps } from "@/lib/assistant-capabilities/types";
import type { KnowledgeSettings } from "@/lib/assistant-capabilities/knowledge/types";
import { Button } from "@/components/ui/button";
import { useAssistantNav } from "./nav-context";

export function KnowledgeCapabilityForm(_props: CapabilityFormProps<KnowledgeSettings>) {
  const { openTopTab } = useAssistantNav();
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Perguntas frequentes, documentos e protocolos usados nas respostas do assistente.
      </p>
      <Button type="button" variant="outline" onClick={() => openTopTab("faq")}>
        Abrir FAQ
      </Button>
      <p className="text-xs text-muted-foreground">
        Uploads de PDFs e base ampliada chegam em breve nesta mesma área.
      </p>
    </div>
  );
}
