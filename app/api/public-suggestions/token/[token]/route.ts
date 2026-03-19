import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  EDIT_WINDOW_MS,
  MAX_SUGGESTION_LENGTH,
  sanitizeSuggestionContent,
  toPublicSuggestion,
  type PublicSuggestionRow,
} from "@/lib/public-suggestions";

async function getSuggestionByToken(token: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("public_suggestions")
    .select("id, content, created_at, updated_at, edit_token")
    .eq("edit_token", token)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data as PublicSuggestionRow | null;
}

function isExpired(createdAt: string, now = Date.now()) {
  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return true;
  return now - createdAtMs > EDIT_WINDOW_MS;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const suggestion = await getSuggestionByToken(token);

    if (!suggestion) {
      return NextResponse.json({ error: "Link de edição inválido." }, { status: 404 });
    }

    return NextResponse.json({
      suggestion: toPublicSuggestion(suggestion),
      editable: !isExpired(suggestion.created_at),
      remaining_ms: Math.max(
        0,
        EDIT_WINDOW_MS - (Date.now() - new Date(suggestion.created_at).getTime())
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar sugestão" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const content = sanitizeSuggestionContent(typeof body?.content === "string" ? body.content : "");

    if (!content) {
      return NextResponse.json({ error: "A sugestão não pode estar vazia." }, { status: 400 });
    }

    if (content.length > MAX_SUGGESTION_LENGTH) {
      return NextResponse.json(
        { error: `A sugestão deve ter no máximo ${MAX_SUGGESTION_LENGTH} caracteres.` },
        { status: 400 }
      );
    }

    const suggestion = await getSuggestionByToken(token);
    if (!suggestion) {
      return NextResponse.json({ error: "Link de edição inválido." }, { status: 404 });
    }

    if (isExpired(suggestion.created_at)) {
      return NextResponse.json({ error: "Tempo de edição expirado." }, { status: 403 });
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("public_suggestions")
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", suggestion.id)
      .select("id, content, created_at, updated_at, edit_token")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Erro ao atualizar sugestão." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      suggestion: toPublicSuggestion(data as PublicSuggestionRow),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao editar sugestão" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const suggestion = await getSuggestionByToken(token);

    if (!suggestion) {
      return NextResponse.json({ error: "Link de edição inválido." }, { status: 404 });
    }

    if (isExpired(suggestion.created_at)) {
      return NextResponse.json({ error: "Tempo de edição expirado." }, { status: 403 });
    }

    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("public_suggestions").delete().eq("id", suggestion.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir sugestão" },
      { status: 500 }
    );
  }
}
