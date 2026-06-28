import { NextResponse } from "next/server";
import { notFound } from "next/navigation";

export function isApiAuditEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
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
  if (process.env.NODE_ENV !== "production") return false;
  return pathname.startsWith("/dev/") || pathname.startsWith("/api/dev/");
}
