"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { LogoUpload } from "@/app/dashboard/configuracoes/logo-upload";
import { updateClinicProfile } from "@/app/dashboard/configuracoes/clinic-profile-actions";
import {
  deleteVirtualAssistantLocation,
  upsertVirtualAssistantLocation,
} from "@/app/dashboard/configuracoes/assistente-virtual/actions";
import { SegmentedTabs } from "@/components/dashboard-ui/layout/segmented-tabs";
import {
  DAY_LABELS,
  DEFAULT_OPERATING_HOURS,
  type DayKey,
  type OperatingHours,
  type VirtualAssistantLocation,
} from "@/lib/virtual-assistant/types";

type TabId = "info" | "institutional" | "location" | "hours" | "contact" | "logo";

export interface ClinicProfileInitialData {
  name: string | null;
  logoUrl: string | null;
  logoScale: number;
  agendaWorkStart: string | null;
  agendaWorkEnd: string | null;
  agendaMaxConcurrent: number | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  whatsappUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  segment: string | null;
  shortDescription: string | null;
  mission: string | null;
  vision: string | null;
  valuesText: string | null;
  googleMapsUrl: string | null;
  parkingInfo: string | null;
  accessibilityInfo: string | null;
  landmarks: string | null;
  hasMultipleUnits: boolean;
  operatingHours: OperatingHours;
  holidayPolicy: string | null;
  websiteUrl: string | null;
  locations: VirtualAssistantLocation[];
}

interface ClinicInfoTabsProps {
  canUseCustomLogo: boolean;
  initialData: ClinicProfileInitialData;
}

export function ClinicInfoTabs({ canUseCustomLogo, initialData }: ClinicInfoTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(initialData.name || "");
  const [agendaWorkStart, setAgendaWorkStart] = useState(
    String(initialData.agendaWorkStart || "07:00:00").slice(0, 5)
  );
  const [agendaWorkEnd, setAgendaWorkEnd] = useState(
    String(initialData.agendaWorkEnd || "20:00:00").slice(0, 5)
  );
  const [agendaMaxConcurrent, setAgendaMaxConcurrent] = useState(
    initialData.agendaMaxConcurrent != null ? String(initialData.agendaMaxConcurrent) : ""
  );

  const [segment, setSegment] = useState(initialData.segment || "");
  const [shortDescription, setShortDescription] = useState(initialData.shortDescription || "");
  const [mission, setMission] = useState(initialData.mission || "");
  const [vision, setVision] = useState(initialData.vision || "");
  const [valuesText, setValuesText] = useState(initialData.valuesText || "");

  const [address, setAddress] = useState(initialData.address || "");
  const [googleMaps, setGoogleMaps] = useState(initialData.googleMapsUrl || "");
  const [parking, setParking] = useState(initialData.parkingInfo || "");
  const [accessibility, setAccessibility] = useState(initialData.accessibilityInfo || "");
  const [landmarks, setLandmarks] = useState(initialData.landmarks || "");
  const [hasUnits, setHasUnits] = useState(initialData.hasMultipleUnits);
  const [locations, setLocations] = useState(initialData.locations);

  const [operatingHours, setOperatingHours] = useState<OperatingHours>(
    initialData.operatingHours ?? DEFAULT_OPERATING_HOURS
  );
  const [holidayPolicy, setHolidayPolicy] = useState(initialData.holidayPolicy || "");

  const [phone, setPhone] = useState(initialData.phone || "");
  const [email, setEmail] = useState(initialData.email || "");
  const [websiteUrl, setWebsiteUrl] = useState(initialData.websiteUrl || "");
  const [whatsappUrl, setWhatsappUrl] = useState(initialData.whatsappUrl || "");
  const [facebookUrl, setFacebookUrl] = useState(initialData.facebookUrl || "");
  const [instagramUrl, setInstagramUrl] = useState(initialData.instagramUrl || "");

  const tabs: { id: TabId; label: string }[] = [
    { id: "info", label: "Informações" },
    { id: "institutional", label: "Institucional" },
    { id: "location", label: "Localização" },
    { id: "hours", label: "Horários" },
    { id: "contact", label: "Contato" },
    { id: "logo", label: "Logo" },
  ];

  async function saveProfile(payload: Parameters<typeof updateClinicProfile>[0]) {
    setSaving(true);
    const result = await updateClinicProfile(payload);
    setSaving(false);
    if (result.error) {
      toast(result.error, "error");
    } else {
      toast("Informações salvas.", "success");
    }
  }

  const handleSaveInfo = async () => {
    const concurrentRaw = agendaMaxConcurrent.trim();
    const concurrentParsed = concurrentRaw === "" ? null : Number.parseInt(concurrentRaw, 10);
    await saveProfile({
      name: name.trim() || null,
      agenda_work_start: agendaWorkStart,
      agenda_work_end: agendaWorkEnd,
      agenda_max_concurrent:
        concurrentRaw === "" ? null : Number.isNaN(concurrentParsed) ? null : concurrentParsed,
    });
  };

  const handleSaveInstitutional = async () => {
    await saveProfile({
      segment: segment.trim() || null,
      short_description: shortDescription.trim() || null,
      mission: mission.trim() || null,
      vision: vision.trim() || null,
      values_text: valuesText.trim() || null,
    });
  };

  const handleSaveLocation = async () => {
    await saveProfile({
      address: address.trim() || null,
      google_maps_url: googleMaps.trim() || null,
      parking_info: parking.trim() || null,
      accessibility_info: accessibility.trim() || null,
      landmarks: landmarks.trim() || null,
      has_multiple_units: hasUnits,
    });
  };

  const handleSaveHours = async () => {
    await saveProfile({
      operating_hours: operatingHours,
      holiday_policy: holidayPolicy.trim() || null,
    });
  };

  const handleSaveContact = async () => {
    await saveProfile({
      phone: phone.trim() || null,
      email: email.trim() || null,
      website_url: websiteUrl.trim() || null,
      whatsapp_url: whatsappUrl.trim() || null,
      facebook_url: facebookUrl.trim() || null,
      instagram_url: instagramUrl.trim() || null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações da clínica</CardTitle>
        <CardDescription>
          Dados institucionais, contato e identidade visual usados no site, assistente virtual e
          comunicações.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <SegmentedTabs
            tabs={tabs}
            value={activeTab}
            onChange={(id) => setActiveTab(id as TabId)}
            variant="underline"
          />
        </div>

        {activeTab === "info" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clinic-name">Nome da clínica *</Label>
              <Input
                id="clinic-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Clínica Saúde"
                required
              />
              <p className="text-xs text-muted-foreground">
                Usado em emails, formulários e outras comunicações
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agenda-work-start">Início do expediente (agenda)</Label>
                <Input
                  id="agenda-work-start"
                  type="time"
                  value={agendaWorkStart}
                  onChange={(e) => setAgendaWorkStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agenda-work-end">Final do expediente (agenda)</Label>
                <Input
                  id="agenda-work-end"
                  type="time"
                  value={agendaWorkEnd}
                  onChange={(e) => setAgendaWorkEnd(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Define a grade exibida na agenda semanal (faixas de 15 min). Distinto do horário de
              funcionamento público.
            </p>
            <div className="space-y-2">
              <Label htmlFor="agenda-max-concurrent">Consultórios simultâneos</Label>
              <Input
                id="agenda-max-concurrent"
                type="number"
                min={2}
                max={20}
                placeholder="Vazio = sem limite (só por médico)"
                value={agendaMaxConcurrent}
                onChange={(e) => setAgendaMaxConcurrent(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Com salas em{" "}
                <Link href="/dashboard/configuracoes/salas" className="underline">
                  Salas e consultórios
                </Link>
                , o conflito passa a ser por sala; este campo fica opcional.
              </p>
            </div>
            <Button onClick={handleSaveInfo} disabled={saving || !name.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}

        {activeTab === "institutional" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="segment">Segmento</Label>
              <Input
                id="segment"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="Ex.: Clínica de dermatologia e estética"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="short-description">Descrição curta</Label>
              <Textarea
                id="short-description"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="O que a clínica faz, especialidades..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mission">Missão</Label>
              <Textarea
                id="mission"
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder="Nossa missão é..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vision">Visão</Label>
              <Textarea
                id="vision"
                value={vision}
                onChange={(e) => setVision(e.target.value)}
                placeholder="Nossa visão é..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="values">Valores</Label>
              <Textarea
                id="values"
                value={valuesText}
                onChange={(e) => setValuesText(e.target.value)}
                placeholder="Ética, empatia, excelência..."
                rows={3}
              />
            </div>
            <Button onClick={handleSaveInstitutional} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}

        {activeTab === "location" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clinic-address">Endereço principal</Label>
              <Input
                id="clinic-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua Exemplo, 123 - Bairro - Cidade/UF"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google-maps">Link Google Maps</Label>
              <Input
                id="google-maps"
                value={googleMaps}
                onChange={(e) => setGoogleMaps(e.target.value)}
                placeholder="https://maps.google.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parking">Estacionamento</Label>
              <Input
                id="parking"
                value={parking}
                onChange={(e) => setParking(e.target.value)}
                placeholder="Estacionamento gratuito na rua..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessibility">Acessibilidade</Label>
              <Input
                id="accessibility"
                value={accessibility}
                onChange={(e) => setAccessibility(e.target.value)}
                placeholder="Rampa de acesso, elevador..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landmarks">Pontos de referência</Label>
              <Input
                id="landmarks"
                value={landmarks}
                onChange={(e) => setLandmarks(e.target.value)}
                placeholder="Próximo ao shopping..."
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasUnits}
                onChange={(e) => setHasUnits(e.target.checked)}
              />
              Mais de uma unidade
            </label>
            {hasUnits && (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Unidades adicionais</p>
                {locations.map((loc) => (
                  <div
                    key={loc.id}
                    className="flex justify-between items-center gap-2 text-sm border-b pb-2 last:border-0"
                  >
                    <span>
                      {loc.name}
                      {loc.address ? ` — ${loc.address}` : ""}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const res = await deleteVirtualAssistantLocation(loc.id);
                        if (res.error) toast(res.error, "error");
                        else {
                          setLocations((prev) => prev.filter((l) => l.id !== loc.id));
                          toast("Unidade removida.", "success");
                        }
                      }}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const unitName = prompt("Nome da unidade");
                    if (!unitName) return;
                    const unitAddr = prompt("Endereço") ?? "";
                    const res = await upsertVirtualAssistantLocation(null, {
                      name: unitName,
                      address: unitAddr,
                      display_order: locations.length,
                    });
                    if (res.error) toast(res.error, "error");
                    else toast("Unidade adicionada. Recarregue para ver.", "success");
                  }}
                >
                  Adicionar unidade
                </Button>
              </div>
            )}
            <Button onClick={handleSaveLocation} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}

        {activeTab === "hours" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Horário de funcionamento exibido no site e usado pelo assistente virtual.
            </p>
            {(Object.keys(DAY_LABELS) as DayKey[]).map((day) => {
              const h = operatingHours[day] ?? {};
              return (
                <div key={day} className="grid gap-2 sm:grid-cols-5 items-end border-b pb-3">
                  <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={!!h.closed}
                      onChange={(e) =>
                        setOperatingHours((prev) => ({
                          ...prev,
                          [day]: { ...prev[day], closed: e.target.checked },
                        }))
                      }
                    />
                    Fechado
                  </label>
                  <Input
                    placeholder="Abre"
                    value={h.open ?? ""}
                    disabled={h.closed}
                    onChange={(e) =>
                      setOperatingHours((prev) => ({
                        ...prev,
                        [day]: { ...prev[day], open: e.target.value },
                      }))
                    }
                  />
                  <Input
                    placeholder="Fecha"
                    value={h.close ?? ""}
                    disabled={h.closed}
                    onChange={(e) =>
                      setOperatingHours((prev) => ({
                        ...prev,
                        [day]: { ...prev[day], close: e.target.value },
                      }))
                    }
                  />
                  <Input
                    placeholder="Almoço ex: 12:00-13:00"
                    value={h.lunch_start && h.lunch_end ? `${h.lunch_start}-${h.lunch_end}` : ""}
                    disabled={h.closed}
                    onChange={(e) => {
                      const [ls, le] = e.target.value.split("-");
                      setOperatingHours((prev) => ({
                        ...prev,
                        [day]: {
                          ...prev[day],
                          lunch_start: ls?.trim(),
                          lunch_end: le?.trim(),
                        },
                      }));
                    }}
                  />
                </div>
              );
            })}
            <div className="space-y-2">
              <Label htmlFor="holiday-policy">Política de feriados</Label>
              <Input
                id="holiday-policy"
                value={holidayPolicy}
                onChange={(e) => setHolidayPolicy(e.target.value)}
                placeholder="Fechado em feriados nacionais..."
              />
            </div>
            <Button onClick={handleSaveHours} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}

        {activeTab === "contact" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clinic-phone">Telefone</Label>
                <Input
                  id="clinic-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-email">E-mail</Label>
                <Input
                  id="clinic-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@clinica.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website-url">Site</Label>
                <Input
                  id="website-url"
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://sua-clinica.com.br"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-whatsapp">WhatsApp (link)</Label>
                <Input
                  id="clinic-whatsapp"
                  type="url"
                  value={whatsappUrl}
                  onChange={(e) => setWhatsappUrl(e.target.value)}
                  placeholder="https://wa.me/5562999999999"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-instagram">Instagram</Label>
                <Input
                  id="clinic-instagram"
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/sua-conta"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-facebook">Facebook</Label>
                <Input
                  id="clinic-facebook"
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/sua-pagina"
                />
              </div>
            </div>
            <Button onClick={handleSaveContact} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}

        {activeTab === "logo" && (
          <div className="space-y-4">
            {!canUseCustomLogo && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Sua clínica já pode visualizar este recurso. Ao evoluir de plano, você libera a logo
                personalizada em toda a comunicação.
              </div>
            )}
            {canUseCustomLogo ? (
              <LogoUpload
                currentLogoUrl={initialData.logoUrl}
                currentScale={initialData.logoScale}
                type="clinic"
              />
            ) : (
              <div className="rounded-md border border-dashed p-8 text-sm text-muted-foreground text-center min-h-[220px] flex items-center justify-center">
                Ative um plano com logo personalizada para enviar e ajustar a marca da clínica.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
