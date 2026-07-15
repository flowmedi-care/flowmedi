"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import { AssistenteVirtualDiagnostics } from "./assistente-virtual-diagnostics";
import { AssistenteVirtualToolsPlayground } from "./assistente-virtual-tools-playground";
import { AssistenteVirtualPipelineTab } from "./assistente-virtual-pipeline-tab";
import { AssistenteVirtualFlowsTab } from "./assistente-virtual-flows-tab";
import { AssistenteVirtualPoliticasIaTab } from "./assistente-virtual-politicas-ia-tab";
import { AssistantNavProvider } from "./capabilities/nav-context";
import type { ToolDefinition } from "@/lib/virtual-assistant/openai-client";
import type { AppointmentPolicy, ConversationFlowsConfig } from "@/lib/attendance-flow/types";
import { mergeConversationFlows } from "@/lib/attendance-flow/defaults";
import { PageShell } from "@/components/dashboard-ui/layout/page-shell";
import { SegmentedTabs } from "@/components/dashboard-ui/layout/segmented-tabs";

type TabId = "politicas" | "fluxos" | "avancado";
type AdvancedSubId = "pipeline" | "ferramentas" | "diagnostico";

interface Props {
  canUse: boolean;
  initialSettings: Partial<VirtualAssistantSettings> | null;
  toolDefinitions: ToolDefinition[];
  initialConversationFlows?: ConversationFlowsConfig;
  initialAppointmentPolicy: AppointmentPolicy;
  clinic: {
    auto_message_send_start: string | null;
    auto_message_send_end: string | null;
  } | null;
}

export function AssistenteVirtualClient({
  canUse,
  initialSettings,
  toolDefinitions,
  initialConversationFlows,
  initialAppointmentPolicy,
}: Props) {
  const [tab, setTab] = useState<TabId>("politicas");
  const [advancedSub, setAdvancedSub] = useState<AdvancedSubId>("pipeline");

  const tabs: { id: TabId; label: string }[] = [
    { id: "politicas", label: "Políticas" },
    { id: "fluxos", label: "Fluxos" },
    { id: "avancado", label: "Avançado" },
  ];

  const advancedTabs: { id: AdvancedSubId; label: string }[] = [
    { id: "pipeline", label: "Pipeline" },
    { id: "ferramentas", label: "Ferramentas" },
    { id: "diagnostico", label: "Diagnóstico" },
  ];

  return (
    <AssistantNavProvider
      openTopTab={(id) => {
        if (id === "fluxos") setTab("fluxos");
        else if (id === "pipeline" || id === "ferramentas" || id === "diagnostico") {
          setTab("avancado");
          setAdvancedSub(id);
        } else {
          setTab("politicas");
        }
      }}
    >
      <PageShell
        header={{
          breadcrumbs: [{ label: "Assistente virtual" }],
          title: "Assistente virtual",
          description:
            "Governança da IA: o que ela pode consultar e quais ações pode executar. Conteúdo vive nos módulos de origem.",
        }}
        tabs={
          <SegmentedTabs
            tabs={tabs}
            value={tab}
            onChange={(id) => setTab(id as TabId)}
            variant="underline"
          />
        }
      >
        {!canUse && (
          <Card className="mb-4 border-amber-200 bg-amber-50">
            <CardContent className="pt-4 text-sm text-amber-900">
              O assistente virtual está disponível em planos com WhatsApp ativo.
            </CardContent>
          </Card>
        )}

        <Card className="mb-4 border-muted">
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Dados da clínica, procedimentos, serviços e{" "}
            <Link
              href="/dashboard/configuracoes/base-de-conhecimento"
              className="text-primary hover:underline"
            >
              Base de conhecimento
            </Link>{" "}
            são editados nos módulos de origem. Aqui só as políticas de acesso.
          </CardContent>
        </Card>

        {tab === "politicas" && (
          <AssistenteVirtualPoliticasIaTab
            canUse={canUse}
            initialPolicy={initialAppointmentPolicy}
            initialConversationFlows={mergeConversationFlows(initialConversationFlows ?? null)}
            initialVaSettings={initialSettings ?? {}}
          />
        )}

        {tab === "fluxos" && (
          <AssistenteVirtualFlowsTab
            initialFlows={mergeConversationFlows(initialConversationFlows ?? null)}
          />
        )}

        {tab === "avancado" && (
          <div className="space-y-4">
            <SegmentedTabs
              tabs={advancedTabs}
              value={advancedSub}
              onChange={(id) => setAdvancedSub(id as AdvancedSubId)}
            />
            {advancedSub === "pipeline" && (
              <AssistenteVirtualPipelineTab
                initialToolModes={initialSettings?.tool_execution_modes ?? null}
              />
            )}
            {advancedSub === "ferramentas" && (
              <AssistenteVirtualToolsPlayground toolDefinitions={toolDefinitions} />
            )}
            {advancedSub === "diagnostico" && (
              <AssistenteVirtualDiagnostics active={advancedSub === "diagnostico"} />
            )}
          </div>
        )}
      </PageShell>
    </AssistantNavProvider>
  );
}
