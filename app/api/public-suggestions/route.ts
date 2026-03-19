import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  MAX_SUGGESTION_LENGTH,
  sanitizeSuggestionContent,
  toPublicSuggestion,
  type PublicSuggestionRow,
} from "@/lib/public-suggestions";
import { checkSuggestionSpamCooldown } from "@/lib/public-suggestions-rate-limit";

function getClientIdentifier(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return `ip:${ip}`;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return `ip:${realIp}`;

  return `ua:${request.headers.get("user-agent") ?? "unknown"}`;
}

export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    const { data, error, count } = await supabase
      .from("public_suggestions")
      .select("id, content, created_at, updated_at, edit_token", { count: "exact" })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const suggestions = ((data ?? []) as PublicSuggestionRow[]).map(toPublicSuggestion);
    return NextResponse.json({
      suggestions,
      total: count ?? suggestions.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar sugestões" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawContent = typeof body?.content === "string" ? body.content : "";
    const content = sanitizeSuggestionContent(rawContent);

    if (!content) {
      return NextResponse.json({ error: "A sugestão não pode estar vazia." }, { status: 400 });
    }

    if (content.length > MAX_SUGGESTION_LENGTH) {
      return NextResponse.json(
        { error: `A sugestão deve ter no máximo ${MAX_SUGGESTION_LENGTH} caracteres.` },
        { status: 400 }
      );
    }

    const cooldown = checkSuggestionSpamCooldown(getClientIdentifier(request));
    if (!cooldown.allowed) {
      return NextResponse.json(
        {
          error: "Aguarde alguns segundos antes de enviar outra sugestão.",
          retry_after_ms: cooldown.retryAfterMs,
        },
        { status: 429 }
      );
    }

    const editToken = crypto.randomUUID();
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("public_suggestions")
      .insert({
        content,
        edit_token: editToken,
      })
      .select("id, content, created_at, updated_at, edit_token")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Erro ao salvar sugestão." },
        { status: 500 }
      );
    }

    const row = data as PublicSuggestionRow;
    return NextResponse.json({
      suggestion: toPublicSuggestion(row),
      edit_token: row.edit_token,
      edit_link: `/edit/${row.edit_token}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar sugestão" },
      { status: 500 }
    );
  }
}
