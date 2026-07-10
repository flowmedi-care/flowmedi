export { infoNeedToChain } from "../planning/plan-templates";

export const FALLBACK_CHAINS: Record<string, string[]> = {
  what_we_do: ["listServices", "list_procedures", "searchFaq", "clinic_settings"],
  pricing: ["getPriceQuote", "list_price_options", "listServices"],
  availability: ["find_available_slots", "list_doctors", "listServices"],
  institutional: ["searchFaq", "clinic_settings"],
  general: ["searchFaq", "listServices", "list_procedures"],
};
