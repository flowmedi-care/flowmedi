"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { capture, flushAnalytics } from "@/lib/analytics/capture";
import { useScrollDepth, type ScrollDepth } from "@/lib/analytics/scroll";
import { useTimeOnPage, type TimeMilestone } from "@/lib/analytics/time";
import { getDeviceType } from "@/lib/analytics/device";
import {
  applyOutboundAttribution,
  setOutboundPersonProperties,
} from "@/lib/outbound/attribution";
import {
  advanceLeadStatus,
  touchVisit,
  type LeadStatus,
} from "@/lib/outbound/lead";
import { applyScoreAction, readLeadScore, type ScoreAction } from "@/lib/outbound/score";
import { buildLeadSummary } from "@/lib/outbound/summary";
import { parseCopyVariant } from "@/lib/outbound/message";
import type { OutboundAttribution } from "@/lib/outbound/utm";

type SessionFlags = {
  scroll75: boolean;
  demoViewed: boolean;
  faqOpened: boolean;
  time120: boolean;
  hesitationFired: boolean;
  interestedFired: boolean;
  wentBelowHero: boolean;
};

function scoreAndSync(action: ScoreAction): void {
  const next = applyScoreAction(action);
  if (next === null) return;
  setOutboundPersonProperties({ lead_score: next });
  capture("lead_score_updated", { lead_score: next, action });
}

export function useOutboundLandingTracker() {
  const searchParams = useSearchParams();
  const attrsRef = useRef<OutboundAttribution>({});
  const statusRef = useRef<LeadStatus | null>(null);
  const startedAtRef = useRef(Date.now());
  const featuresRef = useRef<string[]>([]);
  const faqsRef = useRef<string[]>([]);
  const flagsRef = useRef<SessionFlags>({
    scroll75: false,
    demoViewed: false,
    faqOpened: false,
    time120: false,
    hesitationFired: false,
    interestedFired: false,
    wentBelowHero: false,
  });

  const setStatus = useCallback((next: LeadStatus) => {
    const advanced = advanceLeadStatus(statusRef.current, next);
    if (advanced === statusRef.current) return;
    statusRef.current = advanced;
    setOutboundPersonProperties({ lead_status: advanced });
  }, []);

  const pushSummary = useCallback(() => {
    const attrs = attrsRef.current;
    const summary = buildLeadSummary({
      lead: attrs.lead,
      utm_source: attrs.utm_source,
      outbound_message: attrs.outbound_message,
      elapsedSeconds: Math.floor((Date.now() - startedAtRef.current) / 1000),
      featuresOpened: featuresRef.current,
      faqsOpened: faqsRef.current,
      leadScore: readLeadScore(),
      interested: flagsRef.current.interestedFired,
      leadStatus: statusRef.current ?? undefined,
    });
    setOutboundPersonProperties({
      lead_summary: summary.summary_text.slice(0, 500),
      suggested_next_action: summary.suggested_next_action.slice(0, 200),
      lead_score: summary.score,
      interested: summary.interested,
    });
    capture("lead_summary", {
      score: summary.score,
      interested: summary.interested,
      suggested_next_action: summary.suggested_next_action,
      interests_label: summary.interests_label.slice(0, 200),
    });
  }, []);

  const maybeHesitation = useCallback((reason: string) => {
    if (flagsRef.current.hesitationFired) return;
    flagsRef.current.hesitationFired = true;
    capture("hesitation", { reason, device_type: getDeviceType() });
  }, []);

  const maybeInterested = useCallback(() => {
    const f = flagsRef.current;
    if (f.interestedFired) return;
    if (!(f.scroll75 && f.demoViewed && f.faqOpened && f.time120)) return;
    f.interestedFired = true;
    setOutboundPersonProperties({ interested: true });
    capture("interested_lead", { lead_score: readLeadScore() });
    pushSummary();
  }, [pushSummary]);
  const bootstrapped = useRef(false);

  // Init attribution + landing_opened / landing_returned (uma vez por mount)
  useEffect(() => {
    if (bootstrapped.current) {
      attrsRef.current = applyOutboundAttribution(searchParams);
      return;
    }
    bootstrapped.current = true;

    const attrs = applyOutboundAttribution(searchParams);
    attrsRef.current = attrs;
    startedAtRef.current = Date.now();

    const visit = touchVisit(attrs.lead);
    if (visit.isReturn && visit.returnAfter) {
      capture("landing_returned", {
        return_after: visit.returnAfter,
        lead: attrs.lead,
        device_type: getDeviceType(),
      });
    }

    capture("landing_opened", {
      copy_variant: parseCopyVariant(attrs.copy_variant),
      device_type: getDeviceType(),
      lead: attrs.lead,
    });
    setStatus("landing_opened");
    scoreAndSync("landing_opened");
  }, [searchParams, setStatus]);

  // Scroll depth
  const onDepth = useCallback(
    (percent: ScrollDepth) => {
      capture("scroll_depth", { percent, device_type: getDeviceType() });
      if (percent >= 50) scoreAndSync("scroll_50");
      if (percent >= 75) {
        flagsRef.current.scroll75 = true;
        scoreAndSync("scroll_75");
        maybeHesitation("scroll_75");
        maybeInterested();
      }
      if (percent >= 40) flagsRef.current.wentBelowHero = true;
    },
    [maybeHesitation, maybeInterested]
  );
  useScrollDepth(onDepth);

  // Time
  const onTime = useCallback(
    (seconds: TimeMilestone) => {
      capture("time_on_page", { seconds, device_type: getDeviceType() });
      if (seconds >= 90) maybeHesitation("time_90");
      if (seconds >= 120) {
        flagsRef.current.time120 = true;
        maybeInterested();
      }
    },
    [maybeHesitation, maybeInterested]
  );
  useTimeOnPage(onTime);

  // Detect return to hero after scrolling down
  useEffect(() => {
    const onScroll = () => {
      if (!flagsRef.current.wentBelowHero) return;
      if (window.scrollY < 120) {
        maybeHesitation("back_to_hero");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [maybeHesitation]);

  // Summary on page hide
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") pushSummary();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", pushSummary);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", pushSummary);
    };
  }, [pushSummary]);

  const trackSection = useCallback(
    (section: "hero" | "flow" | "how_it_works" | "before_after" | "demo" | "faq") => {
      const map: Record<typeof section, { event: string; status?: LeadStatus }> = {
        hero: { event: "hero_viewed", status: "hero_viewed" },
        flow: { event: "flow_viewed", status: "flow_viewed" },
        how_it_works: { event: "how_it_works_viewed" },
        before_after: { event: "before_after_viewed" },
        demo: { event: "demo_viewed", status: "demo_viewed" },
        faq: { event: "faq_viewed", status: "faq_viewed" },
      };
      const cfg = map[section];
      capture(cfg.event, { device_type: getDeviceType() });
      if (cfg.status) setStatus(cfg.status);
      if (section === "demo") {
        flagsRef.current.demoViewed = true;
        scoreAndSync("demo_viewed");
        maybeInterested();
      }
    },
    [maybeInterested, setStatus]
  );

  const trackFaqOpened = useCallback(
    (question: string) => {
      faqsRef.current = [...new Set([...faqsRef.current, question])];
      flagsRef.current.faqOpened = true;
      capture("faq_opened", { question: question.slice(0, 120) });
      scoreAndSync("faq");
      maybeHesitation("faq_opened");
      maybeInterested();
    },
    [maybeHesitation, maybeInterested]
  );

  const trackFeatureOpened = useCallback((feature: string) => {
    featuresRef.current = [...new Set([...featuresRef.current, feature])];
    capture("feature_opened", { feature });
  }, []);

  const trackCta = useCallback(
    (opts: {
      location: string;
      variant: "primary" | "secondary";
      text: string;
      heroKind?: "hero_cta" | "hero_secondary" | "hero_image";
    }) => {
      capture("cta_clicked", {
        location: opts.location,
        variant: opts.variant,
        text: opts.text.slice(0, 80),
      });
      setStatus("cta_clicked");
      if (opts.heroKind) {
        capture(opts.heroKind, {
          location: opts.location,
          text: opts.text.slice(0, 80),
        });
      }
    },
    [setStatus]
  );

  const openWhatsApp = useCallback(
    async (opts: { buttonLocation: string; text?: string }) => {
      const phone = process.env.NEXT_PUBLIC_SALES_WHATSAPP?.replace(/\D/g, "");
      if (!phone) {
        console.warn("[outbound] NEXT_PUBLIC_SALES_WHATSAPP não configurado");
        return;
      }

      capture("whatsapp_clicked", {
        button_location: opts.buttonLocation,
        device_type: getDeviceType(),
      });
      setStatus("whatsapp_clicked");
      scoreAndSync("whatsapp_clicked");
      pushSummary();

      await flushAnalytics();

      const attrs = attrsRef.current;
      const defaultText =
        opts.text ||
        [
          "Olá! Vi a página do FlowMed e quero conhecer a plataforma.",
          attrs.lead ? `Ref: ${attrs.lead}` : null,
          attrs.outbound_message ? `Msg: ${attrs.outbound_message}` : null,
        ]
          .filter(Boolean)
          .join(" ");

      const url = `https://wa.me/${phone}?text=${encodeURIComponent(defaultText)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [pushSummary, setStatus]
  );

  return {
    trackSection,
    trackFaqOpened,
    trackFeatureOpened,
    trackCta,
    openWhatsApp,
    copyVariant: parseCopyVariant(searchParams.get("copy")),
    attribution: attrsRef.current,
  };
}
