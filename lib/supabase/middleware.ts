import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type SessionHook = (
  request: NextRequest,
  supabase: ReturnType<typeof createServerClient>
) => Promise<NextResponse | null>;

export async function updateSession(
  request: NextRequest,
  afterAuth?: SessionHook
) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  if (afterAuth) {
    const redirect = await afterAuth(request, supabase);
    if (redirect) return redirect;
  }

  return response;
}
