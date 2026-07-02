"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  enrollTotpFactor,
  unenrollUnverifiedTotpFactors,
  verifyTotpEnrollment,
} from "@/lib/compliance/mfa-service";
import {
  getUnverifiedTotpFactors,
  hasUnverifiedTotp,
  isMfaEnrolled,
  type MfaFactorsList,
} from "@/lib/compliance/mfa-helpers";

export function useMfaEnrollment() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [hasStaleFactor, setHasStaleFactor] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);

  const refreshFactors = useCallback(async () => {
    setChecking(true);
    const supabase = createClient();
    const { data: factors, error } = await supabase.auth.mfa.listFactors();
    setChecking(false);
    if (error) return { error: error.message };

    const list = factors as MfaFactorsList;
    setEnrolled(isMfaEnrolled(list));
    setHasStaleFactor(hasUnverifiedTotp(list));
    return { error: null };
  }, []);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  async function clearStaleFactors() {
    setLoading(true);
    const supabase = createClient();
    const result = await unenrollUnverifiedTotpFactors(supabase);
    setLoading(false);
    if (result.error) return { error: result.error };
    setHasStaleFactor(false);
    setQr(null);
    setFactorId(null);
    await refreshFactors();
    return { error: null };
  }

  async function startEnrollment() {
    setLoading(true);
    const supabase = createClient();

    if (hasStaleFactor) {
      const cleanup = await unenrollUnverifiedTotpFactors(supabase);
      if (cleanup.error) {
        setLoading(false);
        return { error: cleanup.error };
      }
    }

    const result = await enrollTotpFactor(supabase);
    setLoading(false);
    if (!result.ok) return { error: result.error };

    setQr(result.qrCode);
    setFactorId(result.factorId);
    setHasStaleFactor(false);
    return { error: null };
  }

  async function confirmEnrollment(code: string) {
    if (!factorId) return { error: "Inicie a configuração primeiro." };
    setLoading(true);
    const supabase = createClient();
    const result = await verifyTotpEnrollment(supabase, factorId, code);
    setLoading(false);
    if (result.error) return result;

    setEnrolled(true);
    setQr(null);
    setFactorId(null);
    setHasStaleFactor(false);
    return { error: null };
  }

  return {
    loading,
    checking,
    enrolled,
    hasStaleFactor,
    qr,
    factorId,
    refreshFactors,
    clearStaleFactors,
    startEnrollment,
    confirmEnrollment,
  };
}
