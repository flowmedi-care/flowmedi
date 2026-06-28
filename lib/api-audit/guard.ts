import { NextResponse } from "next/server";
import { notFound } from "next/navigation";

/**
 * Painel ativo quando ENABLE_API_AUDIT_PANEL=true (local, preview ou production).
 * Desligue a variável na Vercel assim que terminar a auditoria.
 */
export function isApiAuditEnabled(): boolean {
  return process.env.ENABLE_API_AUDIT_PANEL === "true";
}

export function assertApiAuditEnabled(): void {
  if (!isApiAuditEnabled()) {
    notFound();
  }
}

export function apiAuditDisabledResponse(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

export function blockDevRoutesInProduction(pathname: string): boolean {
  if (isApiAuditEnabled()) return false;
  if (process.env.NODE_ENV !== "production") return false;
  return pathname.startsWith("/dev/") || pathname.startsWith("/api/dev/");
}
