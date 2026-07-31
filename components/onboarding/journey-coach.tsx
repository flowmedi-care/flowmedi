"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ClinicProgressBar } from "./clinic-progress-bar";
import { MicroWinToast } from "./micro-win-toast";
import { MiniAhaBeat } from "./mini-aha-beat";
import { FullAhaScreen } from "./full-aha-screen";
import {
  MARIA_STORY,
  STEP_COPY,
  ANCHOR_PHRASE,
} from "@/lib/onboarding/copy";
import {
  clinicProgressPercent,
  clinicProgressStatus,
} from "@/lib/onboarding/clinic-progress";
import type { OnboardingDemoBundle, OnboardingTourStep } from "@/lib/onboarding/types";
import {
  advanceTourStepAction,
  completeAhaAction,
  continueAfterMiniAhaAction,
  markMariaWhySeenAction,
  skipTourAction,
  trackActivationEventAction,
} from "@/lib/onboarding/actions";
import { X } from "lucide-react";

function buildScheduleHref(bundle: OnboardingDemoBundle): string {
  const params = new URLSearchParams();
  params.set("novaConsulta", "1");
  params.set("tour", "1");
  if (bundle.patientId) params.set("patientId", bundle.patientId);
  if (bundle.doctorId) params.set("doctorId", bundle.doctorId);
  if (bundle.serviceId) params.set("serviceId", bundle.serviceId);
  if (bundle.procedureId) params.set("procedureId", bundle.procedureId);
  if (bundle.roomId) params.set("roomId", bundle.roomId);
  params.set("valor", "250");
  return `/dashboard/agenda?${params.toString()}`;
}

export function JourneyCoach({
  initialStep,
  bundle,
  showFullAhaInitially,
}: {
  initialStep: OnboardingTourStep | null;
  bundle: OnboardingDemoBundle | null;
  showFullAhaInitially?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<OnboardingTourStep | null>(initialStep);
  const [microWin, setMicroWin] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(true);
  const [showMiniAha, setShowMiniAha] = useState(false);
  const [showFullAha, setShowFullAha] = useState(Boolean(showFullAhaInitially));
  const [pending, startTransition] = useTransition();
  const [collapsed, setCollapsed] = useState(false);

  const tourMode = searchParams.get("tour") === "1";
  const ahaParam = searchParams.get("aha") === "1";

  useEffect(() => {
    if (ahaParam) setShowFullAha(true);
  }, [ahaParam]);

  useEffect(() => {
    if (showWhy) {
      void markMariaWhySeenAction();
    }
  }, [showWhy]);

  // Detectar exploração espontânea pós-aha
  useEffect(() => {
    if (step !== "done" && step !== "aha") return;
    if (!pathname) return;
    void trackActivationEventAction("post_aha_explore", { path: pathname });
  }, [pathname, step]);

  const copy = useMemo(() => {
    if (!step || step === "done" || step === "skipped" || step === "aha") return null;
    return STEP_COPY[step];
  }, [step]);

  const percent = clinicProgressPercent(step);
  const status = clinicProgressStatus(step);

  const ctaHref = useMemo(() => {
    if (!bundle) return "/dashboard";
    if (step === "contact" || step === "appointment") return buildScheduleHref(bundle);
    if (step === "attendance" && bundle.appointmentId) {
      return `/dashboard/agenda/consulta/${bundle.appointmentId}?tour=1`;
    }
    if (step === "payment" && bundle.appointmentId) {
      return `/dashboard/agenda/atendimento/${bundle.appointmentId}?tour=1&finalize=1`;
    }
    if (step === "aha") return "/dashboard/financeiro?aha=1";
    return bundle.caseId
      ? `/dashboard/crm/jornada/${bundle.caseId}?tour=1`
      : "/dashboard/hoje?focus=pendencias&tour=1";
  }, [bundle, step]);

  function handleSkip() {
    startTransition(async () => {
      await skipTourAction();
      setStep("skipped");
      setCollapsed(true);
    });
  }

  function handlePrimary() {
    if (step === "contact") {
      startTransition(async () => {
        const res = await advanceTourStepAction("appointment");
        if (res.microWin) setMicroWin(res.microWin);
        setStep("appointment");
        setShowWhy(false);
        router.push(buildScheduleHref(bundle!));
      });
      return;
    }
    router.push(ctaHref);
  }

  function handleContinueMini() {
    startTransition(async () => {
      await continueAfterMiniAhaAction();
      setShowMiniAha(false);
      if (bundle?.appointmentId) {
        router.push(`/dashboard/agenda/consulta/${bundle.appointmentId}?tour=1`);
      }
    });
  }

  function handleLaterMini() {
    setShowMiniAha(false);
    setCollapsed(true);
  }

  // Expor helpers via custom events para outras telas
  useEffect(() => {
    function onMiniAha(e: Event) {
      const detail = (e as CustomEvent<{ appointmentId?: string }>).detail;
      if (detail?.appointmentId && bundle) {
        bundle.appointmentId = detail.appointmentId;
      }
      setShowMiniAha(true);
      setStep("attendance");
      setMicroWin("Sua agenda já tem um atendimento.");
    }
    function onFullAha() {
      startTransition(async () => {
        await completeAhaAction();
        setStep("aha");
        setShowFullAha(true);
        setMicroWin("Dinheiro registrado.");
      });
    }
    function onMicroWin(e: Event) {
      const msg = (e as CustomEvent<{ message?: string }>).detail?.message;
      if (msg) setMicroWin(msg);
    }
    function onStep(e: Event) {
      const s = (e as CustomEvent<{ step?: OnboardingTourStep }>).detail?.step;
      if (s) setStep(s);
    }
    window.addEventListener("flowmedi:mini-aha", onMiniAha);
    window.addEventListener("flowmedi:full-aha", onFullAha);
    window.addEventListener("flowmedi:micro-win", onMicroWin);
    window.addEventListener("flowmedi:tour-step", onStep);
    return () => {
      window.removeEventListener("flowmedi:mini-aha", onMiniAha);
      window.removeEventListener("flowmedi:full-aha", onFullAha);
      window.removeEventListener("flowmedi:micro-win", onMicroWin);
      window.removeEventListener("flowmedi:tour-step", onStep);
    };
  }, [bundle]);

  if (step === "skipped" || step === "done") {
    if (showFullAha) {
      return (
        <FullAhaScreen
          onClose={() => {
            setShowFullAha(false);
            setStep("done");
          }}
        />
      );
    }
    return null;
  }

  if (showFullAha) {
    return (
      <FullAhaScreen
        onClose={() => {
          setShowFullAha(false);
          setStep("done");
        }}
      />
    );
  }

  return (
    <>
      {showMiniAha && (
        <MiniAhaBeat
          onContinue={handleContinueMini}
          onLater={handleLaterMini}
          pending={pending}
        />
      )}
      <MicroWinToast message={microWin} onDone={() => setMicroWin(null)} />

      <div
        className={
          collapsed
            ? "fixed bottom-4 right-4 z-50"
            : "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-4 shadow-2xl backdrop-blur sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[22rem] sm:rounded-2xl sm:border"
        }
      >
        {collapsed ? (
          <Button size="sm" onClick={() => setCollapsed(false)}>
            Continuar ativação · {percent}%
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium text-muted-foreground">{ANCHOR_PHRASE}</p>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Minimizar"
                onClick={() => setCollapsed(true)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ClinicProgressBar percent={percent} status={status} />

            {showWhy && step === "contact" && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{MARIA_STORY.name}</p>
                <p className="mt-1">
                  {MARIA_STORY.reasonLabel} · {MARIA_STORY.channelLabel}
                </p>
                <p className="mt-2">{MARIA_STORY.channelDetail}</p>
                <p className="mt-2 text-foreground/80">{MARIA_STORY.whyExists}</p>
              </div>
            )}

            {copy && (
              <div>
                <p className="text-sm font-semibold">{copy.coachTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">{copy.coachBody}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button size="sm" disabled={pending || !bundle} onClick={handlePrimary}>
                {copy?.ctaLabel ?? "Continuar"}
              </Button>
              {bundle?.caseId && step === "contact" && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/dashboard/crm/jornada/${bundle.caseId}?tour=1`}>
                    Ver pendência da Maria
                  </Link>
                </Button>
              )}
              <button
                type="button"
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                onClick={handleSkip}
                disabled={pending}
              >
                Pular por agora (pode retomar)
              </button>
            </div>

            {tourMode && (
              <p className="text-[10px] text-muted-foreground">
                Modo demonstração — tudo é reversível.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
