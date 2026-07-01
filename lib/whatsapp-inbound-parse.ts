import {
  parseInteractiveInboundMessage,
  type ParsedFlowInbound,
} from "@/lib/virtual-assistant/confirmation-flow-handler";

export type MetaInboundParseResult = {
  msgType: string;
  bodyText: string;
  flowInbound: ParsedFlowInbound | null;
};

/**
 * Extrai texto e respostas interativas (Flow / quick_reply) de mensagens Meta.
 */
export function parseMetaInboundMessage(msg: Record<string, unknown>): MetaInboundParseResult {
  const msgType = String(msg.type ?? "text");
  const flowInbound = parseInteractiveInboundMessage(msg);

  const text = msg.text as { body?: string } | undefined;
  if (text?.body) {
    return { msgType, bodyText: String(text.body), flowInbound };
  }

  if (flowInbound) {
    const label =
      flowInbound.action === "confirmar"
        ? "Confirmar presença"
        : flowInbound.action === "cancelar"
          ? "Cancelar consulta"
          : "Remarcar consulta";
    return { msgType: "interactive", bodyText: `[flow:${flowInbound.action}] ${label}`, flowInbound };
  }

  const image = msg.image as { id?: string } | undefined;
  const audio = msg.audio as { id?: string } | undefined;
  const video = msg.video as { id?: string } | undefined;
  const document = msg.document as { id?: string } | undefined;

  if (image?.id) return { msgType, bodyText: "", flowInbound: null };
  if (audio?.id) return { msgType, bodyText: "", flowInbound: null };
  if (video?.id) return { msgType, bodyText: "", flowInbound: null };
  if (document?.id) return { msgType, bodyText: "", flowInbound: null };

  return { msgType, bodyText: `[${msgType}]`, flowInbound: null };
}
