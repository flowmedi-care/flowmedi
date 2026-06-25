import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingWizard } from "@/components/public-site/booking-wizard";
import { SiteHeader } from "@/components/public-site/site-header";
import { loadPublicClinicSite } from "@/lib/public-site/load-site";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { RESERVED_CLINIC_SLUGS } from "@/lib/public-site/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadPublicClinicSite(slug);
  if (!site.found) return { title: "Agendar" };
  return { title: `Agendar consulta — ${site.name}` };
}

export default async function PublicBookingPage({ params }: Props) {
  const { slug } = await params;

  if (RESERVED_CLINIC_SLUGS.has(slug)) {
    notFound();
  }

  const site = await loadPublicClinicSite(slug);
  if (!site.found) {
    notFound();
  }

  const readiness = checkPublicBookingReadiness(site);
  if (!readiness.available) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#f7faf9]">
      <SiteHeader site={site} slug={slug} />
      <div className="py-10 sm:py-14 px-4 sm:px-6">
        <div className="mx-auto max-w-lg text-center mb-10">
          <p className="text-sm font-medium text-primary mb-2">Agendamento online</p>
          <h1 className="text-3xl font-semibold text-[#1a2e28] tracking-tight">Agendar consulta</h1>
          <p className="text-[#5c6f68] mt-2">{site.name}</p>
        </div>
        <BookingWizard slug={slug} clinicName={site.name} />
      </div>
    </div>
  );
}
