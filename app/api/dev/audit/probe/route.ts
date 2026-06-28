import { NextRequest, NextResponse } from "next/server";
import { assertApiAuditEnabled } from "@/lib/api-audit/guard";
import { getEndpointById } from "@/lib/api-audit/registry";
import { loadFixturesFromEnv } from "@/lib/api-audit/fixtures";
import {
  getRequestOriginFromHeaders,
  probeEndpoint,
} from "@/lib/api-audit/runner";
import type { AuditScenario } from "@/lib/api-audit/types";

export async function POST(request: NextRequest) {
  assertApiAuditEnabled();

  const body = await request.json();
  const endpointId = body?.endpointId as string | undefined;
  const scenario = body?.scenario as AuditScenario | undefined;
  const fixtureOverrides = body?.fixtures;

  if (!endpointId || !scenario) {
    return NextResponse.json(
      { error: "endpointId e scenario são obrigatórios" },
      { status: 400 }
    );
  }

  const endpoint = getEndpointById(endpointId);
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint não encontrado" }, { status: 404 });
  }

  const headersList = request.headers;
  const origin = getRequestOriginFromHeaders(
    headersList.get("x-forwarded-host") ?? headersList.get("host"),
    headersList.get("x-forwarded-proto")
  );

  const result = await probeEndpoint(endpoint, scenario, {
    origin,
    fixtures: loadFixturesFromEnv(fixtureOverrides),
    requestCookieHeader: headersList.get("cookie"),
  });

  return NextResponse.json({ result });
}
