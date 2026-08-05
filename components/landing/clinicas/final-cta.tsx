"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CLINICAS_COPY } from "@/lib/landing/clinicas-content";
import {
  getSalesInstagram,
  getSalesPhone,
} from "@/lib/landing/whatsapp";
import { useClinicasAnalytics } from "./analytics-provider";

export function ClinicasFinalCta() {
  const { trackCta, openWhatsApp, copyVariant } = useClinicasAnalytics();
  const copy = CLINICAS_COPY[copyVariant];

  return (
    <section className="bg-primary py-16 text-primary-foreground md:py-20">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Pronto para ver na prática?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-primary-foreground/85">
          Agende uma demonstração rápida. Sem compromisso — só para entender se faz sentido para a sua clínica.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            variant="secondary"
            className="h-12 px-8 text-base"
            onClick={() => {
              trackCta({
                location: "final",
                variant: "primary",
                text: copy.primaryCta,
              });
              void openWhatsApp({ buttonLocation: "final" });
            }}
          >
            {copy.primaryCta}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ClinicasFooter() {
  const { openWhatsApp, trackCta } = useClinicasAnalytics();
  const phone = getSalesPhone();
  const instagram = getSalesInstagram();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto flex flex-col gap-8 px-4 py-10 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">FlowMed</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Plataforma para clínicas de estética organizarem atendimento, agenda e pacientes.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium text-foreground">Contato</p>
          <button
            type="button"
            className="text-left text-muted-foreground transition hover:text-foreground"
            onClick={() => {
              trackCta({
                location: "footer",
                variant: "primary",
                text: "WhatsApp",
              });
              void openWhatsApp({ buttonLocation: "footer" });
            }}
          >
            WhatsApp
          </button>
          {phone && (
            <a
              href={`tel:${phone.replace(/\D/g, "")}`}
              className="text-muted-foreground transition hover:text-foreground"
            >
              {phone}
            </a>
          )}
          {instagram && (
            <a
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition hover:text-foreground"
            >
              Instagram
            </a>
          )}
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium text-foreground">Legal</p>
          <Link
            href="/politica-de-privacidade"
            className="text-muted-foreground transition hover:text-foreground"
          >
            Política de Privacidade
          </Link>
          <Link
            href="/politica-de-cookies"
            className="text-muted-foreground transition hover:text-foreground"
          >
            Política de Cookies
          </Link>
          <Link
            href="/termos-de-servico"
            className="text-muted-foreground transition hover:text-foreground"
          >
            Termos de Serviço
          </Link>
          <Link
            href="/encarregado-dados"
            className="text-muted-foreground transition hover:text-foreground"
          >
            LGPD / Encarregado
          </Link>
        </div>
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {year} FlowMed. Todos os direitos reservados.
      </div>
    </footer>
  );
}
