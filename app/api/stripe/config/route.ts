import { NextResponse } from "next/server";

/**
 * Retorna a chave pública do Stripe para o cliente.
 * Usa variáveis de ambiente no servidor (runtime), evitando o problema
 * de NEXT_PUBLIC_* com build cache no Vercel.
 */
export async function GET() {
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!pk) {
    return NextResponse.json(
      { error: "Stripe não configurado." },
      { status: 500 }
    );
  }
  return NextResponse.json({ publishableKey: pk });
}
