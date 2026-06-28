import { NextRequest, NextResponse } from "next/server";
import { assertApiAuditEnabled } from "@/lib/api-audit/guard";
import { runAuditBatch, getRequestOriginFromHeaders } from "@/lib/api-audit/runner";
import type { AuditRunRequest } from "@/lib/api-audit/types";

export async function POST(request: NextRequest) {
  assertApiAuditEnabled();

  let body: AuditRunRequest = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const headersList = request.headers;
  const response = await runAuditBatch(body, {
    origin: getRequestOriginFromHeaders(
      headersList.get("x-forwarded-host") ?? headersList.get("host"),
      headersList.get("x-forwarded-proto")
    ),
    requestCookieHeader: headersList.get("cookie"),
    fixtureOverrides: body.fixtures,
  });

  return NextResponse.json(response);
}
