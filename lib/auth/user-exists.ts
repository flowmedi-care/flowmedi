/**
 * Best-effort check whether an auth user exists for the given email.
 * Returns null if the lookup fails (do not expose that to the client).
 */
export async function authUserExistsByEmail(email: string): Promise<boolean | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;

    const res = await fetch(
      `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
        },
        signal: AbortSignal.timeout(5_000),
      }
    );

    if (!res.ok) {
      // Older GoTrue may not support email query — avoid false UNKNOWN_EMAIL
      return null;
    }

    const json = (await res.json()) as { users?: { id: string }[]; id?: string };
    if (Array.isArray(json.users)) return json.users.length > 0;
    if (json.id) return true;
    return false;
  } catch {
    return null;
  }
}
