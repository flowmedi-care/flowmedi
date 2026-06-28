import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { assertApiAuditEnabled } from "@/lib/api-audit/guard";
import { getAuditSession, getRequestOriginFromHeaders } from "@/lib/api-audit/runner";

export async function GET() {
  assertApiAuditEnabled();

  const headersList = await headers();
  const cookieHeader = headersList.get("cookie");
  const session = await getAuditSession(cookieHeader);

  return NextResponse.json({
    ...session,
    panelEnabled: true,
    origin: getRequestOriginFromHeaders(
      headersList.get("x-forwarded-host") ?? headersList.get("host"),
      headersList.get("x-forwarded-proto")
    ),
  });
}
