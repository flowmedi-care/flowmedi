import type {
  AppointmentPolicy,
  ConversationFlowsConfig,
} from "@/lib/attendance-flow/types";
import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import type { ComponentType } from "react";

export type CapabilityLoadContext = {
  appointmentPolicy: AppointmentPolicy;
  conversationFlows: ConversationFlowsConfig;
  vaSettings: Partial<VirtualAssistantSettings>;
};

export type CapabilitySaveContext = CapabilityLoadContext;

export type CapabilityFormProps<T> = {
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
};

/**
 * Product capability module — owns settings shape, defaults, persistence mapping, and form.
 * UI shell only knows this contract + the registry.
 */
export type Capability<T> = {
  id: string;
  title: string;
  description: string;
  order: number;
  defaults: () => T;
  load: (ctx: CapabilityLoadContext) => T;
  save: (ctx: CapabilitySaveContext, value: T) => Promise<{ error: string | null }>;
  summary?: (value: T) => string;
  Form: ComponentType<CapabilityFormProps<T>>;
};
