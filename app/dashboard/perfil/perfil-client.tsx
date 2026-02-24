"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LogoUpload } from "../configuracoes/logo-upload";
import {
  getDoctorPreferences,
  updateDoctorPreferences,
  type DoctorPreferences,
} from "../medico-preferences-actions";
import {
  getReferralLinkData,
  saveReferralMessage,
} from "./referral-actions";
import { setProfileDimensionValueColors } from "./profile-dimension-colors-actions";

const DEFAULT_MESSAGE = "Olá gostaria de obter mais informação sobre a consulta com o dr. [digite seu nome]";
const DEFAULT_AGENDA_COLOR = "#3B82F6";
import { Share2, Copy, Check, Palette } from "lucide-react";

function ReferralLinkCard() {
  const [data, setData] = useState<{
    referralLink: string | null;
    customMessage: string | null;
    whatsappUrl: string | null;
    error: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messageInput, setMessageInput] = useState("");

  useEffect(() => {
    getReferralLinkData().then((res) => {
      setData(res);
      setMessageInput(res.customMessage?.trim() ?? "");
    }).finally(() => setLoading(false));
  }, []);

  async function handleSaveMessage() {
    setSaving(true);
    setData((prev) => prev ? { ...prev, error: null } : null);
    try {
      const result = await saveReferralMessage(messageInput);
      if (result.error) {
        setData((prev) => prev ? { ...prev, error: result.error } : prev);
      } else {
        const updated = await getReferralLinkData();
        setData(updated);
      }
    } catch (err) {
      setData((prev) => prev ? { ...prev, error: "Erro ao salvar. Tente novamente." } : prev);
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <h2 className="font-semibold flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Link de divulgação
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Link de divulgação
        </h2>
        <p className="text-sm text-muted-foreground">
          Compartilhe este link com seus pacientes. Ao clicar, eles abrem o WhatsApp da clínica e são automaticamente vinculados à sua secretária.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {data?.error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {data.error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <Label htmlFor="referral-message" className="text-sm font-medium">
              Mensagem que o paciente verá ao clicar no link
            </Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Inclua seu nome para garantir a vinculação correta com sua secretária.
            </p>
            <Textarea
              id="referral-message"
              placeholder={DEFAULT_MESSAGE}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <Button onClick={handleSaveMessage} disabled={saving}>
            {saving ? "Salvando..." : "Salvar e gerar link"}
          </Button>
        </div>
        {data?.referralLink && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                readOnly
                value={data.referralLink}
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={handleCopy} title="Copiar">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <div className="border rounded-lg p-2 bg-white">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(data.referralLink)}`}
                  alt="QR Code do link"
                  width={120}
                  height={120}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Escaneie o QR code ou copie o link para compartilhar.</p>
                <p className="mt-1">O paciente envia a mensagem pré-preenchida e será atribuído à sua secretária.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type AgendaDimension = { id: string; nome: string };
type AgendaDimensionValue = { id: string; dimension_id: string; nome: string; cor: string | null };

export function PerfilClient({
  doctorLogoUrl,
  doctorLogoScale,
  agendaDimensions = [],
  agendaDimensionValues = [],
  agendaColorOverrides = {},
}: {
  doctorLogoUrl: string | null;
  doctorLogoScale: number;
  agendaDimensions?: AgendaDimension[];
  agendaDimensionValues?: AgendaDimensionValue[];
  agendaColorOverrides?: Record<string, string>;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<DoctorPreferences>({
    late_threshold_minutes: 15,
  });
  const [error, setError] = useState<string | null>(null);
  const [agendaColorOverridesLocal, setAgendaColorOverridesLocal] = useState<Record<string, string>>(agendaColorOverrides);
  const [savingColors, setSavingColors] = useState(false);

  useEffect(() => {
    setAgendaColorOverridesLocal(agendaColorOverrides);
  }, [agendaColorOverrides]);

  useEffect(() => {
    loadPreferences();
  }, []);

  async function loadPreferences() {
    setLoading(true);
    setError(null);
    const result = await getDoctorPreferences();
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setPreferences(result.data);
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateDoctorPreferences(preferences);
    if (result.error) {
      setError(result.error);
    } else {
      // Recarregar página para aplicar mudanças
      window.location.reload();
    }
    setSaving(false);
  }

  function convertToMinutes(hours: number, minutes: number): number {
    return hours * 60 + minutes;
  }

  function convertFromMinutes(totalMinutes: number): { hours: number; minutes: number } {
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  }

  const { hours, minutes } = convertFromMinutes(preferences.late_threshold_minutes);

  const valuesByDimension = useMemo(() => {
    return agendaDimensions.map((dim) => ({
      ...dim,
      values: agendaDimensionValues.filter((v) => v.dimension_id === dim.id),
    }));
  }, [agendaDimensions, agendaDimensionValues]);

  function getEffectiveColor(value: AgendaDimensionValue): string {
    return agendaColorOverridesLocal[value.id] ?? value.cor ?? DEFAULT_AGENDA_COLOR;
  }

  async function handleSaveAgendaColors() {
    const overrides = Object.entries(agendaColorOverridesLocal).filter(
      ([id, cor]) => {
        const v = agendaDimensionValues.find((x) => x.id === id);
        const defaultCor = v?.cor ?? DEFAULT_AGENDA_COLOR;
        return cor && cor !== defaultCor && /^#[0-9A-Fa-f]{6}$/.test(cor);
      }
    ).map(([dimension_value_id, cor]) => ({ dimension_value_id, cor }));
    setSavingColors(true);
    await setProfileDimensionValueColors(overrides);
    setSavingColors(false);
  }

  return (
    <div className="space-y-6">
      <ReferralLinkCard />
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Minha Logo</h2>
          <p className="text-sm text-muted-foreground">
            Sua logo aparecerá no final dos formulários enviados aos seus pacientes.
          </p>
        </CardHeader>
        <CardContent>
          <LogoUpload
            currentLogoUrl={doctorLogoUrl}
            currentScale={doctorLogoScale}
            type="doctor"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Preferências</h2>
          <p className="text-sm text-muted-foreground">
            Configure suas preferências de trabalho.
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando preferências...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tempo de Atraso */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">
                    Tempo para considerar consulta atrasada
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Consultas que passaram mais tempo que este serão exibidas como
                    "Atrasadas" no topo da lista.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hours">Horas</Label>
                    <Input
                      id="hours"
                      type="number"
                      min="0"
                      max="23"
                      value={hours}
                      onChange={(e) => {
                        const h = parseInt(e.target.value) || 0;
                        const m = minutes;
                        setPreferences({
                          late_threshold_minutes: convertToMinutes(h, m),
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minutes">Minutos</Label>
                    <Input
                      id="minutes"
                      type="number"
                      min="0"
                      max="59"
                      value={minutes}
                      onChange={(e) => {
                        const h = hours;
                        const m = parseInt(e.target.value) || 0;
                        setPreferences({
                          late_threshold_minutes: convertToMinutes(h, m),
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-md bg-muted">
                  <p className="text-sm text-muted-foreground">
                    Total: <span className="font-medium">{preferences.late_threshold_minutes} minutos</span>
                  </p>
                </div>
              </div>

              {/* Botão Salvar */}
              <div className="pt-4 border-t border-border">
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? "Salvando..." : "Salvar Preferências"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cores na agenda (dimensões/valores) */}
      {valuesByDimension.some((d) => d.values.length > 0) && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Cores na agenda
            </h2>
            <p className="text-sm text-muted-foreground">
              Defina a cor de cada valor de dimensão para quando você escolher &quot;Colorir por&quot; essa dimensão na agenda.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {valuesByDimension.map((dim) => (
              <div key={dim.id} className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">{dim.nome}</h3>
                <div className="flex flex-wrap gap-3">
                  {dim.values.map((v) => {
                    const effective = getEffectiveColor(v);
                    return (
                      <div
                        key={v.id}
                        className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
                      >
                        <span className="text-sm">{v.nome}</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={effective}
                            onChange={(e) =>
                              setAgendaColorOverridesLocal((prev) => ({
                                ...prev,
                                [v.id]: e.target.value,
                              }))
                            }
                            className="h-8 w-10 cursor-pointer rounded border border-input bg-background"
                          />
                          <Input
                            value={effective}
                            onChange={(e) =>
                              setAgendaColorOverridesLocal((prev) => ({
                                ...prev,
                                [v.id]: e.target.value,
                              }))
                            }
                            placeholder="#3B82F6"
                            className="h-8 w-24 font-mono text-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Button onClick={handleSaveAgendaColors} disabled={savingColors}>
                {savingColors ? "Salvando..." : "Salvar cores da agenda"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
