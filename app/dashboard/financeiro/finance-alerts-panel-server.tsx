import { getFinanceAlerts } from "./actions";
import { FinanceAlertsPanel } from "./components/finance-alerts-panel";

// FINANCEIRO FASE 1 — ITEM 8: alertas (server)

export async function FinanceAlertsPanelServer() {
  const { alerts } = await getFinanceAlerts();
  return <FinanceAlertsPanel alerts={alerts} />;
}
