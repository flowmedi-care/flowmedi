import { loadFixturesFromEnv } from "@/lib/api-audit/fixtures";
import { ApiValidationPanel } from "@/components/api-audit/api-validation-panel";

export default function DevApiValidationPage() {
  const initialFixtures = loadFixturesFromEnv();
  return <ApiValidationPanel initialFixtures={initialFixtures} />;
}
