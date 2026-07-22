/**
 * Remove a inscrição do App FlowMed na WABA (Meta Graph).
 * Falha da Meta não deve bloquear o disconnect local — retorna aviso.
 */
export async function unsubscribeWhatsappWabaApp(opts: {
  wabaId: string | null | undefined;
  accessToken: string | null | undefined;
}): Promise<{ ok: boolean; warning: string | null }> {
  const wabaId = typeof opts.wabaId === "string" ? opts.wabaId.trim() : "";
  const accessToken =
    typeof opts.accessToken === "string" ? opts.accessToken.trim() : "";

  if (!wabaId || !accessToken) {
    return {
      ok: false,
      warning:
        "Sem waba_id/token para unsubscribe na Meta — remova o app manualmente no Business Manager se ainda receber webhooks.",
    };
  }

  const graphVersion = process.env.META_GRAPH_VERSION || "v25.0";
  const url = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(wabaId)}/subscribed_apps`;

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[WhatsApp Disconnect] subscribed_apps DELETE falhou", {
        wabaId,
        status: res.status,
        body: body.slice(0, 500),
      });
      return {
        ok: false,
        warning:
          "Unsubscribe na Meta falhou — remova o app manualmente no Business Manager se ainda receber webhooks.",
      };
    }

    return { ok: true, warning: null };
  } catch (err) {
    console.warn("[WhatsApp Disconnect] subscribed_apps DELETE erro de rede", err);
    return {
      ok: false,
      warning:
        "Unsubscribe na Meta falhou (rede) — remova o app manualmente no Business Manager se ainda receber webhooks.",
    };
  }
}

export function pickWabaIdFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const value = metadata?.waba_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function pickAccessTokenFromCredentials(
  credentials: Record<string, unknown> | null | undefined
): string | null {
  const value = credentials?.access_token;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
