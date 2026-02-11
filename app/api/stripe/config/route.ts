import { NextResponse } from "next/server";

/**
 * Retorna a chave pública do Stripe para o cliente.
 * Usa STRIPE_PUBLISHABLE_KEY (servidor) ou NEXT_PUBLIC_* (fallback).
 * Prefira STRIPE_PUBLISHABLE_KEY no Vercel — sempre disponível em runtime.
 */
export async function GET() {
  const pk =
    process.env.STRIPE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!pk) {
    return NextResponse.json(
      { error: "Stripe não configurado." },
      { status: 500 }
    );
  }
  return NextResponse.json({ publishableKey: pk });
}
