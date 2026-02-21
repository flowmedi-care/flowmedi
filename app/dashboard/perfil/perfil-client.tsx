"use client";

import { useState, useEffect } from "react";
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

const DEFAULT_MESSAGE = "Olá gostaria de obter mais informação sobre a consulta com o dr. [digite seu nome]";
import { Share2, Copy, Check } from "lucide-react";

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

export function PerfilClient({
  doctorLogoUrl,
  doctorLogoScale,
}: {
  doctorLogoUrl: string | null;
  doctorLogoScale: number;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<DoctorPreferences>({
    late_threshold_minutes: 15,
  });
  const [error, setError] = useState<string | null>(null);

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
    </div>
  );
}
