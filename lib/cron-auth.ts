import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function extractCronSecretToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  return (
    authHeader?.replace(/^Bearer\s+/i, "") ||
    request.nextUrl.searchParams.get("secret") ||
    null
  );
}

/**
 * Fail-closed: exige CRON_SECRET configurado e token válido (Bearer ou ?secret=).
 * Retorna NextResponse de erro ou null se autorizado.
 */
export function verifyCronSecret(request: NextRequest): NextResponse | null {
  const expectedSecret = process.env.CRON_SECRET?.trim();
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurado" },
      { status: 503 }
    );
  }

  const token = extractCronSecretToken(request);
  if (!token || token !== expectedSecret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  return null;
}
