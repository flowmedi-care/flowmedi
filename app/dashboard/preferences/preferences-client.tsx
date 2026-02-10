"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { updateDashboardPreferences, type DashboardPreferences } from "./actions";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";

export function PreferencesClient({
  initialPreferences,
}: {
  initialPreferences: DashboardPreferences;
}) {
  const [preferences, setPreferences] = useState<DashboardPreferences>(initialPreferences);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleToggle = async (key: keyof DashboardPreferences) => {
    const newPreferences = {
      ...preferences,
      [key]: !preferences[key],
    };
    setPreferences(newPreferences);
    setLoading(true);

    const result = await updateDashboardPreferences(newPreferences);
    if (result.error) {
      // Revert on error
      setPreferences(preferences);
      alert(`Erro: ${result.error}`);
    }

    setLoading(false);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Preferências do Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Compliance</p>
            <p className="text-xs text-muted-foreground">
              Mostrar alertas de consultas que precisam de confirmação
            </p>
          </div>
          <Switch
            checked={preferences.show_compliance}
            onChange={(checked) => {
              if (checked !== preferences.show_compliance) {
                handleToggle("show_compliance");
              }
            }}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Métricas</p>
            <p className="text-xs text-muted-foreground">
              Mostrar cards com números e estatísticas
            </p>
          </div>
          <Switch
            checked={preferences.show_metrics}
            onChange={(checked) => {
              if (checked !== preferences.show_metrics) {
                handleToggle("show_metrics");
              }
            }}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Pipeline de Não Cadastrados</p>
            <p className="text-xs text-muted-foreground">
              Mostrar pipeline Kanban de pessoas não cadastradas
            </p>
          </div>
          <Switch
            checked={preferences.show_pipeline}
            onChange={(checked) => {
              if (checked !== preferences.show_pipeline) {
                handleToggle("show_pipeline");
              }
            }}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Próximas Consultas</p>
            <p className="text-xs text-muted-foreground">
              Mostrar lista de próximas consultas agendadas
            </p>
          </div>
          <Switch
            checked={preferences.show_upcoming_appointments}
            onChange={(checked) => {
              if (checked !== preferences.show_upcoming_appointments) {
                handleToggle("show_upcoming_appointments");
              }
            }}
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Atividades Recentes</p>
            <p className="text-xs text-muted-foreground">
              Mostrar feed de atividades recentes
            </p>
          </div>
          <Switch
            checked={preferences.show_recent_activity}
            onChange={(checked) => {
              if (checked !== preferences.show_recent_activity) {
                handleToggle("show_recent_activity");
              }
            }}
            disabled={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
}
