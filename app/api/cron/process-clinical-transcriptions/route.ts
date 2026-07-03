import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { processStuckClinicalTranscriptions } from "@/lib/clinical-transcription/post-process";

/**
 * GET /api/cron/process-clinical-transcriptions
 * Fallback para pós-processamento clínico travado.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const processed = await processStuckClinicalTranscriptions(10);
    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
