"use client";

import type { ToolDefinition } from "@/lib/virtual-assistant/openai-client";
import { ToolsPlayground } from "./tools-playground/index";

interface Props {
  toolDefinitions: ToolDefinition[];
}

export function AssistenteVirtualToolsPlayground({ toolDefinitions }: Props) {
  return <ToolsPlayground toolDefinitions={toolDefinitions} />;
}
