import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyFileAccessToken } from "@/lib/storage/file-access-token";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  opus: "audio/opus",
  wav: "audio/wav",
  m4a: "audio/mp4",
  webm: "video/webm",
  mp4: "video/mp4",
};

function contentTypeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function filenameFromPath(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || "file";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);
  const payload = verifyFileAccessToken(token);

  if (!payload) {
    return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 403 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { data, error } = await supabase.storage
    .from(payload.bucket)
    .download(payload.path);

  if (error || !data) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  const contentType = contentTypeFromPath(payload.path);
  const filename = filenameFromPath(payload.path);
  const buffer = Buffer.from(await data.arrayBuffer());

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
