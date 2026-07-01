import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONFIRMATION_FLOW_NAME,
  getConfirmationFlowJsonString,
} from "@/lib/whatsapp-confirmation-flow-definition";
import { getWhatsAppCredentials } from "@/lib/comunicacao/whatsapp";

const GRAPH_API_VERSION = "v23.0";

export type WhatsAppFlowSummary = {
  id: string;
  name: string;
  status: string;
};

type GraphListResponse = {
  data?: Array<{ id?: string; name?: string; status?: string }>;
  error?: { message?: string; error_user_msg?: string };
};

type GraphCreateResponse = {
  id?: string;
  error?: { message?: string; error_user_msg?: string };
};

async function graphFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<{ ok: boolean; data: T; error?: string }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json()) as T & GraphListResponse;
  if (!response.ok) {
    const err = data as GraphListResponse;
    return {
      ok: false,
      data,
      error: err.error?.error_user_msg || err.error?.message || "Erro na API de Flows da Meta.",
    };
  }
  return { ok: true, data };
}

export async function listWhatsAppFlows(
  clinicId: string,
  supabaseClient?: SupabaseClient
): Promise<{ success: boolean; flows?: WhatsAppFlowSummary[]; error?: string }> {
  try {
    const { credentials, wabaId } = await getWhatsAppCredentials(clinicId, false, supabaseClient);
    if (!wabaId) {
      return { success: false, error: "WABA ID não encontrado na integração WhatsApp." };
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/flows?fields=id,name,status`;
    const result = await graphFetch<GraphListResponse>(url, credentials.access_token);
    if (!result.ok) {
      return { success: false, error: result.error };
    }

    const flows = (result.data.data ?? [])
      .filter((row) => row.id && row.name)
      .map((row) => ({
        id: String(row.id),
        name: String(row.name),
        status: String(row.status ?? "UNKNOWN"),
      }));

    return { success: true, flows };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao listar Flows.",
    };
  }
}

async function publishFlow(flowId: string, accessToken: string): Promise<{ success: boolean; error?: string }> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${flowId}/publish`;
  const result = await graphFetch<GraphCreateResponse>(url, accessToken, { method: "POST" });
  if (!result.ok) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

export async function ensureConfirmationFlow(
  clinicId: string,
  supabaseClient?: SupabaseClient
): Promise<{ success: boolean; flowId?: string; error?: string }> {
  try {
    const { credentials, wabaId } = await getWhatsAppCredentials(clinicId, false, supabaseClient);
    if (!wabaId) {
      return { success: false, error: "WABA ID não encontrado na integração WhatsApp." };
    }

    const listed = await listWhatsAppFlows(clinicId, supabaseClient);
    if (!listed.success) {
      return { success: false, error: listed.error };
    }

    const existing = (listed.flows ?? []).find(
      (flow) => flow.name === CONFIRMATION_FLOW_NAME && flow.status === "PUBLISHED"
    );
    if (existing) {
      return { success: true, flowId: existing.id };
    }

    const draft = (listed.flows ?? []).find((flow) => flow.name === CONFIRMATION_FLOW_NAME);
    if (draft) {
      const published = await publishFlow(draft.id, credentials.access_token);
      if (published.success) {
        return { success: true, flowId: draft.id };
      }
      return { success: false, error: published.error };
    }

    const createUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/flows`;
    const createResult = await graphFetch<GraphCreateResponse>(createUrl, credentials.access_token, {
      method: "POST",
      body: JSON.stringify({
        name: CONFIRMATION_FLOW_NAME,
        categories: ["OTHER"],
        flow_json: getConfirmationFlowJsonString(),
      }),
    });

    if (!createResult.ok || !createResult.data.id) {
      return {
        success: false,
        error: createResult.error || "Falha ao criar Flow de confirmação na Meta.",
      };
    }

    const flowId = String(createResult.data.id);
    const published = await publishFlow(flowId, credentials.access_token);
    if (!published.success) {
      return { success: false, error: published.error, flowId };
    }

    return { success: true, flowId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao garantir Flow de confirmação.",
    };
  }
}
