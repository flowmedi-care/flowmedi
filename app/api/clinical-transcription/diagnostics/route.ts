import { NextResponse } from "next/server";
import { ApiAuthError, requireClinicMemberWithRole, toApiErrorResponse } from "@/lib/auth-helpers";
import { gatherClinicalTranscriptionDiagnostics } from "@/lib/clinical-transcription/diagnostics";

/**
 * GET /api/clinical-transcription/diagnostics
 * Testa conectividade Flowmedi → VPS de streaming (executa no servidor).
 */
export async function GET() {
  try {
    await requireClinicMemberWithRole();
    const data = await gatherClinicalTranscriptionDiagnostics();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return toApiErrorResponse(error);
    }
    const message = error instanceof Error ? error.message : "Erro ao executar diagnóstico.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
