"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { ExternalLink, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  updatePublicSiteSettings,
  type ClinicPublicSiteSettingsRow,
} from "./actions";
import type { DataReadinessReport } from "@/lib/virtual-assistant/data-readiness";

type Props = {
  initialSettings: ClinicPublicSiteSettingsRow | null;
  clinicName: string;
  slug: string;
  siteUrl: string | null;
  subdomainUrl: string | null;
  dataReadiness: DataReadinessReport;
  bookingReadiness: { available: boolean; reason: string | null };
  hasActiveRooms: boolean;
};

export function SiteConfigClient({
  initialSettings,
  clinicName,
  slug,
  siteUrl,
  subdomainUrl,
  dataReadiness,
  bookingReadiness,
  hasActiveRooms,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [siteEnabled, setSiteEnabled] = useState(initialSettings?.site_enabled ?? false);
  const [bookingEnabled, setBookingEnabled] = useState(
    initialSettings?.self_service_booking_enabled ?? false
  );
  const [showTeam, setShowTeam] = useState(initialSettings?.show_team ?? true);
  const [showFaq, setShowFaq] = useState(initialSettings?.show_faq ?? true);
  const [showServices, setShowServices] = useState(initialSettings?.show_services ?? true);
  const [heroTitle, setHeroTitle] = useState(initialSettings?.hero_title ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(initialSettings?.hero_subtitle ?? "");
  const [primaryColor, setPrimaryColor] = useState(initialSettings?.primary_color ?? "");
  const [copied, setCopied] = useState(false);

  const handleSave = () => {
    const fd = new FormData();
    fd.set("site_enabled", String(siteEnabled));
    fd.set("self_service_booking_enabled", String(bookingEnabled));
    fd.set("show_team", String(showTeam));
    fd.set("show_faq", String(showFaq));
    fd.set("show_services", String(showServices));
    fd.set("hero_title", heroTitle);
    fd.set("hero_subtitle", heroSubtitle);
    fd.set("primary_color", primaryColor);

    startTransition(async () => {
      const res = await updatePublicSiteSettings(fd);
      if (res.error) {
        toast(res.error, "error");
      } else {
        toast("Configurações salvas.", "success");
      }
    });
  };

  const copyUrl = async () => {
    if (!siteUrl) return;
    await navigator.clipboard.writeText(siteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publicação</CardTitle>
          <CardDescription>
            Quando ativo, o site fica acessível em{" "}
            {siteUrl ? (
              <code className="text-xs bg-muted px-1 py-0.5 rounded">/c/{slug}</code>
            ) : (
              "—"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Switch
            label="Publicar site da clínica"
            checked={siteEnabled}
            onChange={setSiteEnabled}
          />
          {siteEnabled && siteUrl && (
            <div className="flex flex-wrap items-center gap-2">
              <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Abrir site
                </Button>
              </a>
              <Button variant="outline" size="sm" onClick={copyUrl}>
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 mr-1.5 text-primary" />
                ) : (
                  <Copy className="h-4 w-4 mr-1.5" />
                )}
                Copiar link
              </Button>
              {subdomainUrl && (
                <span className="text-xs text-muted-foreground">
                  Subdomínio (quando DNS configurado): {subdomainUrl}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Autoagendamento online</CardTitle>
          <CardDescription>
            Permita que pacientes agendem consultas pelo site. Desative se preferir agendar
            manualmente pela agenda ou WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Switch
            label="Permitir autoagendamento"
            checked={bookingEnabled}
            onChange={setBookingEnabled}
            disabled={!siteEnabled}
          />
          {siteEnabled && bookingEnabled && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2">
                {bookingReadiness.available ? (
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Pronto para agendar
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-700 border-amber-300">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Atenção
                  </Badge>
                )}
              </div>
              {!bookingReadiness.available && bookingReadiness.reason && (
                <p className="text-sm text-muted-foreground">{bookingReadiness.reason}</p>
              )}
              {hasActiveRooms && (
                <p className="text-sm text-amber-700">
                  Sua clínica usa salas/consultórios. O autoagendamento online fica indisponível até
                  essa funcionalidade ser suportada.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conteúdo do site</CardTitle>
          <CardDescription>
            Dados de contato, horários e FAQ vêm de{" "}
            <Link href="/dashboard/configuracoes/clinica" className="text-primary hover:underline">
              Dados da clínica
            </Link>{" "}
            e{" "}
            <Link
              href="/dashboard/configuracoes/assistente-virtual"
              className="text-primary hover:underline"
            >
              Assistente virtual
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Switch label="Exibir equipe médica" checked={showTeam} onChange={setShowTeam} disabled={!siteEnabled} />
          <Switch label="Exibir serviços/procedimentos" checked={showServices} onChange={setShowServices} disabled={!siteEnabled} />
          <Switch label="Exibir FAQ" checked={showFaq} onChange={setShowFaq} disabled={!siteEnabled} />

          <div className="space-y-2 pt-2">
            <Label htmlFor="hero_title">Título do hero (opcional)</Label>
            <Input
              id="hero_title"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              placeholder={clinicName}
              disabled={!siteEnabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero_subtitle">Subtítulo do hero (opcional)</Label>
            <Textarea
              id="hero_subtitle"
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              placeholder="Descrição curta da clínica"
              rows={2}
              disabled={!siteEnabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primary_color">Cor primária (opcional, ex: 160 84% 39%)</Label>
            <Input
              id="primary_color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="HSL do tema"
              disabled={!siteEnabled}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prontidão dos dados</CardTitle>
          <CardDescription>
            Verifique se há procedimentos, médicos e horários cadastrados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">{dataReadiness.stats.procedures} procedimentos</Badge>
            <Badge variant="outline">{dataReadiness.stats.doctors} médicos</Badge>
            <Badge variant="outline">
              {dataReadiness.stats.doctorProcedureLinks} vínculos médico↔procedimento
            </Badge>
          </div>
          {dataReadiness.issues.length > 0 && (
            <ul className="text-sm text-muted-foreground space-y-1 mt-2">
              {dataReadiness.issues.slice(0, 5).map((issue, i) => (
                <li key={i} className={issue.level === "error" ? "text-destructive" : ""}>
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={pending}>
          {pending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}
