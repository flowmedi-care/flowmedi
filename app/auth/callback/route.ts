import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  resolvePostAuthRedirect,
  sanitizeRedirectPath,
} from "@/lib/auth/post-auth-redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRedirectPath(
    searchParams.get("next") ?? undefined,
    "/dashboard"
  );

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/entrar?error=oauth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/entrar?error=oauth`);
  }

  const redirectPath = await resolvePostAuthRedirect(supabase, user.id, next);
  return NextResponse.redirect(`${origin}${redirectPath}`);
}
