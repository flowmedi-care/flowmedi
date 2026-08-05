/**
 * Monta URL wa.me a partir do número configurado.
 */
export function getSalesWhatsAppUrl(prefilledText?: string): string | null {
  const phone = process.env.NEXT_PUBLIC_SALES_WHATSAPP?.replace(/\D/g, "");
  if (!phone) return null;
  if (!prefilledText) return `https://wa.me/${phone}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(prefilledText)}`;
}

export function getSalesPhone(): string | null {
  return process.env.NEXT_PUBLIC_SALES_PHONE?.trim() || null;
}

export function getSalesInstagram(): string | null {
  const handle = process.env.NEXT_PUBLIC_SALES_INSTAGRAM?.trim();
  if (!handle) return null;
  if (handle.startsWith("http")) return handle;
  return `https://instagram.com/${handle.replace(/^@/, "")}`;
}
