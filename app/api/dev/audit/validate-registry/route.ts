import { NextResponse } from "next/server";
import { assertApiAuditEnabled } from "@/lib/api-audit/guard";
import { validateRegistryAgainstFilesystem } from "@/lib/api-audit/validate-registry";

export async function GET() {
  assertApiAuditEnabled();

  const validation = validateRegistryAgainstFilesystem();
  return NextResponse.json(validation);
}
