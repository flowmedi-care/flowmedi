"use client";

import { Suspense } from "react";
import { ClinicasAnalyticsProvider } from "./analytics-provider";
import { ClinicasHeader } from "./header";
import { ClinicasHero } from "./hero";
import { ClinicasProductFlow } from "./product-flow";
import { ClinicasHowItWorks } from "./how-it-works";
import { ClinicasBeforeAfter } from "./before-after";
import { ClinicasDemo } from "./demo";
import { ClinicasForWhom } from "./for-whom";
import { ClinicasFaq } from "./faq";
import { ClinicasFinalCta, ClinicasFooter } from "./final-cta";

function ClinicasPageInner() {
  return (
    <ClinicasAnalyticsProvider>
      <div className="flex min-h-screen flex-col">
        <ClinicasHeader />
        <main className="flex-1">
          <ClinicasHero />
          <ClinicasProductFlow />
          <ClinicasHowItWorks />
          <ClinicasBeforeAfter />
          <ClinicasDemo />
          <ClinicasForWhom />
          <ClinicasFaq />
          <ClinicasFinalCta />
        </main>
        <ClinicasFooter />
      </div>
    </ClinicasAnalyticsProvider>
  );
}

export function ClinicasLanding() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ClinicasPageInner />
    </Suspense>
  );
}
