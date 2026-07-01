"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JourneyPhaseRail } from "@/components/crm/journey-phase-rail";
import { JourneyStepCards } from "@/components/crm/journey-step-cards";
import { JourneyFlowMap } from "@/components/crm/journey-flow-map";
import type { ContactJourney } from "@/lib/contact-journey/types";
import { getPhaseProgress } from "@/lib/contact-journey/active-path";
import type { JourneyPhase } from "@/lib/contact-journey/types";

type JourneyDetailViewProps = {
  journey: ContactJourney;
};

export function JourneyDetailView({ journey }: JourneyDetailViewProps) {
  const [tab, setTab] = useState("steps");
  const phaseProgress = getPhaseProgress(journey.currentStep, journey.completedSteps);
  const completedPhases = phaseProgress
    .filter((p) => p.status === "completed")
    .map((p) => p.phase as JourneyPhase);

  return (
    <div className="space-y-4">
      <JourneyPhaseRail
        currentPhase={journey.phase}
        completedPhases={completedPhases}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="steps">Passo a passo</TabsTrigger>
          <TabsTrigger value="map">Mapa completo</TabsTrigger>
        </TabsList>
        <TabsContent value="steps" className="mt-4">
          <JourneyStepCards steps={journey.activePathSteps} />
        </TabsContent>
        <TabsContent value="map" className="mt-4">
          <JourneyFlowMap
            currentStep={journey.currentStep}
            completedSteps={journey.completedSteps}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
