export function composeEmailHtml(rawBody: string, header: string, footer: string): string {
  const bodySection = `
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
      <tr>
        <td style="padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #111827;">
          ${rawBody}
        </td>
      </tr>
    </table>
  `;
  return `${header}${bodySection}${footer}`;
}

function needsClinicBranding(
  bodyHtml: string | null,
  header: string | null,
  footer: string | null
): boolean {
  if (!bodyHtml?.trim()) return true;
  if (!header?.trim() && !footer?.trim()) return false;
  const headerSnippet = header?.replace(/\s+/g, " ").trim().slice(0, 48);
  if (headerSnippet && bodyHtml.replace(/\s+/g, " ").includes(headerSnippet)) {
    return false;
  }
  return true;
}

export function buildSentEmailPreviewHtml(
  bodyHtml: string | null,
  bodyText: string | null,
  header: string | null,
  footer: string | null
): string | null {
  const safeHeader = header ?? "";
  const safeFooter = footer ?? "";

  if (bodyHtml?.trim() && !needsClinicBranding(bodyHtml, header, footer)) {
    return bodyHtml.trim();
  }

  const rawBody = bodyHtml?.trim()
    ? bodyHtml.trim()
    : bodyText?.trim()
      ? bodyText.replace(/\n/g, "<br />")
      : "";

  if (!rawBody && !safeHeader && !safeFooter) return null;

  return composeEmailHtml(rawBody || "<p>(sem conteúdo)</p>", safeHeader, safeFooter);
}
