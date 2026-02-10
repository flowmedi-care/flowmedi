"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoUpload } from "../configuracoes/logo-upload";
import {
  getDoctorPreferences,
  updateDoctorPreferences,
  type DoctorPreferences,
} from "../medico-preferences-actions";

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
