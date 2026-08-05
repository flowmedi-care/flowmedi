"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { isPostHogEnabled } from "@/lib/posthog/client";

type PostHogIdentifyProps = {
  userId: string;
  role?: string | null;
  clinicId?: string | null;
};

/**
 * Associa eventos ao usuário autenticado (distinct_id = UUID do Supabase).
 * Não envia e-mail/nome — só metadados de produto.
 */
export function PostHogIdentify({ userId, role, clinicId }: PostHogIdentifyProps) {
  useEffect(() => {
    if (!isPostHogEnabled() || !userId) return;

    posthog.identify(userId, {
      role: role ?? undefined,
    });

    if (clinicId) {
      posthog.group("clinic", clinicId);
    }
  }, [userId, role, clinicId]);

  return null;
}

export function resetPostHogIdentity(): void {
  if (!isPostHogEnabled()) return;
  posthog.reset();
}
