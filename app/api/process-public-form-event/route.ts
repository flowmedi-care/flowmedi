import { NextResponse } from "next/server";

/**
 * @deprecated Use POST /api/public/form/submit — auto-send ocorre server-side no submit.
 * Endpoint desativado para evitar abuso de reenvio com form_instance_id.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Endpoint descontinuado. Use /api/public/form/submit." },
    { status: 410 }
  );
}
