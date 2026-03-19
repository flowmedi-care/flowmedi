import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  EDIT_WINDOW_MS,
  MAX_SUGGESTION_LENGTH,
  sanitizeSuggestionContent,
  toPublicSuggestion,
  type PublicSuggestionRow,
} from "@/lib/public-suggestions";

async function getSuggestionById(id: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("public_suggestions")
    .select("id, content, created_at, updated_at, edit_token")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data as PublicSuggestionRow | null;
}

function validateToken(expected: string, provided: unknown) {
  return typeof provided === "string" && provided.length > 0 && provided === expected;
}

function isExpired(createdAt: string, now = Date.now()) {
  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return true;
  return now - createdAtMs > EDIT_WINDOW_MS;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const suggestion = await getSuggestionById(id);
    if (!suggestion) {
      return NextResponse.json({ error: "Sugestão não encontrada." }, { status: 404 });
    }

    if (!validateToken(suggestion.edit_token, body?.edit_token)) {
      return NextResponse.json({ error: "Token de edição inválido." }, { status: 403 });
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
      .eq("id", id)
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({} as { edit_token?: string }));
    const suggestion = await getSuggestionById(id);

    if (!suggestion) {
      return NextResponse.json({ error: "Sugestão não encontrada." }, { status: 404 });
    }

    if (!validateToken(suggestion.edit_token, body?.edit_token)) {
      return NextResponse.json({ error: "Token de edição inválido." }, { status: 403 });
    }

    if (isExpired(suggestion.created_at)) {
      return NextResponse.json({ error: "Tempo de edição expirado." }, { status: 403 });
    }

    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("public_suggestions").delete().eq("id", id);
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
