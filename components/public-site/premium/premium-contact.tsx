"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail, MapPin, Phone } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { formatHoursTable } from "@/lib/public-site/presentation";
import { googleMapsEmbedUrl } from "@/lib/public-site/theme";
import { RevealSection } from "./reveal-section";

function ContactForm({ slug }: { slug: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privacy) {
      setErrorMsg("Aceite a política de privacidade para continuar.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/public/contact/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Erro ao enviar mensagem.");
        setStatus("error");
        return;
      }
      setStatus("success");
      setName("");
      setPhone("");
      setEmail("");
      setMessage("");
      setPrivacy(false);
    } catch {
      setErrorMsg("Erro de conexão. Tente novamente.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-6 text-center">
        <p className="font-semibold text-emerald-800">Mensagem enviada!</p>
        <p className="mt-2 text-sm text-emerald-700">
          Entraremos em contato em breve.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm font-medium text-[var(--site-primary)] hover:underline"
        >
          Enviar outra mensagem
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="contact-name" className="block text-sm font-medium text-[var(--site-text)] mb-1">
          Nome *
        </label>
        <input
          id="contact-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--site-primary)]/30 focus:border-[var(--site-primary)]"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contact-phone" className="block text-sm font-medium text-[var(--site-text)] mb-1">
            Telefone
          </label>
          <input
            id="contact-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--site-primary)]/30 focus:border-[var(--site-primary)]"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm font-medium text-[var(--site-text)] mb-1">
            E-mail *
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--site-primary)]/30 focus:border-[var(--site-primary)]"
          />
        </div>
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-[var(--site-text)] mb-1">
          Mensagem
        </label>
        <textarea
          id="contact-message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--site-primary)]/30 focus:border-[var(--site-primary)] resize-none"
        />
      </div>
      <label className="flex items-start gap-2 text-sm text-[var(--site-muted)] cursor-pointer">
        <input
          type="checkbox"
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
          className="mt-1 rounded border-slate-300 text-[var(--site-primary)] focus:ring-[var(--site-primary)]"
        />
        <span>
          Concordo com a{" "}
          <Link href="/politica-de-privacidade" className="text-[var(--site-primary)] hover:underline" target="_blank">
            política de privacidade
          </Link>
          .
        </span>
      </label>
      {status === "error" && errorMsg && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--site-accent)] px-6 py-3 text-sm font-semibold text-white shadow-md hover:brightness-105 disabled:opacity-60 transition-all"
      >
        {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
        Enviar mensagem
      </button>
    </form>
  );
}

export function PremiumContact({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  const hours = formatHoursTable(site.operating_hours);
  const embedUrl = googleMapsEmbedUrl(site.google_maps_url);
  const showForm = site.site.show_contact_form;

  return (
    <RevealSection id="contato" className="py-16 lg:py-24 bg-[var(--site-bg)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--site-primary)] mb-2">
            Contato
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--site-text)]">
            Fale conosco
          </h2>
          <p className="mt-4 text-[var(--site-muted)]">
            Estamos prontos para atender você. Entre em contato ou agende sua consulta.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          <div className="space-y-6">
            {showForm && (
              <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-semibold text-[var(--site-text)] mb-6">
                  Envie uma mensagem
                </h3>
                <ContactForm slug={slug} />
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
              <h3 className="text-lg font-semibold text-[var(--site-text)]">Informações</h3>
              {site.phone && (
                <a href={`tel:${site.phone}`} className="flex items-center gap-3 text-[var(--site-muted)] hover:text-[var(--site-primary)]">
                  <Phone className="h-5 w-5 shrink-0 text-[var(--site-primary)]" />
                  {site.phone}
                </a>
              )}
              {site.email && (
                <a href={`mailto:${site.email}`} className="flex items-center gap-3 text-[var(--site-muted)] hover:text-[var(--site-primary)]">
                  <Mail className="h-5 w-5 shrink-0 text-[var(--site-primary)]" />
                  {site.email}
                </a>
              )}
              {site.address && (
                <div className="flex items-start gap-3 text-[var(--site-muted)]">
                  <MapPin className="h-5 w-5 shrink-0 text-[var(--site-primary)] mt-0.5" />
                  <span>{site.address}</span>
                </div>
              )}
              {site.whatsapp_url && (
                <a
                  href={site.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                >
                  WhatsApp
                </a>
              )}

              {hours.length > 0 && (
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-[var(--site-text)] mb-3">Horários</h4>
                  <ul className="space-y-1.5 text-sm">
                    {hours.map((row) => (
                      <li
                        key={row.label}
                        className={`flex justify-between gap-4 ${row.isToday ? "font-semibold text-[var(--site-primary)]" : "text-[var(--site-muted)]"}`}
                      >
                        <span>{row.label}</span>
                        <span className={row.closed ? "text-slate-400" : ""}>{row.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {embedUrl ? (
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm aspect-video">
                <iframe
                  src={embedUrl}
                  title={`Mapa — ${site.name}`}
                  className="w-full h-full min-h-[280px] border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : site.google_maps_url ? (
              <a
                href={site.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--site-primary)] hover:underline"
              >
                <MapPin className="h-4 w-4" />
                Abrir no Google Maps
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </RevealSection>
  );
}
