"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getDoctorPreferences,
  updateDoctorPreferences,
  type DoctorPreferences,
} from "./medico-preferences-actions";
import { Settings, X } from "lucide-react";

export function MedicoPreferencesSidebar() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<DoctorPreferences>({
    late_threshold_minutes: 15,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadPreferences();
    }
  }, [open]);

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
      setOpen(false);
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
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 shadow-lg bg-background hover:bg-muted"
      >
        <Settings className="h-4 w-4 mr-2" />
        Preferências
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Preferências do Médico</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
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

                  {/* Botões */}
                  <div className="flex gap-2 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      onClick={() => setOpen(false)}
                      className="flex-1"
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleSave} className="flex-1" disabled={saving}>
                      {saving ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
