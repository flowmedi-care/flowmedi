export type OnboardingTourStep =
  | "contact"
  | "appointment"
  | "attendance"
  | "payment"
  | "aha"
  | "done"
  | "skipped";

export type OnboardingDemoStory = {
  name: string;
  channelLabel: string;
  reasonLabel: string;
  isDemo: true;
};

export type OnboardingDemoBundle = {
  leadId?: string;
  caseId?: string;
  patientId?: string;
  serviceId?: string;
  procedureId?: string;
  roomId?: string;
  doctorId?: string;
  appointmentId?: string;
  servicePriceId?: string;
  story: OnboardingDemoStory;
};

export type OnboardingState = {
  clinicId: string;
  adminAlsoPractices: boolean;
  tourStep: OnboardingTourStep | null;
  miniAhaAt: string | null;
  ahaCompletedAt: string | null;
  demoSeededAt: string | null;
  bundle: OnboardingDemoBundle | null;
  /** Ativação ainda em curso (não done/skipped e sem aha completo). */
  isActive: boolean;
  /** Mostrar coach no layout. */
  showCoach: boolean;
};

export type ProductEventName =
  | "clinic_created"
  | "demo_seeded"
  | "maria_why_seen"
  | "micro_win"
  | "mini_aha_completed"
  | "aha_completed"
  | "tour_skipped"
  | "continued_after_mini"
  | "post_aha_cta_clicked"
  | "post_aha_explore"
  | "post_aha_real_action";
