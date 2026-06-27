export type QuoteStatus = "rascunho" | "enviado" | "aceito" | "recusado" | "expirado";

export type QuoteItemType = "service" | "product" | "procedure" | "other";

export type QuoteItemSection = "services" | "materials" | "other";

export type QuoteItemInput = {
  id?: string;
  item_type: QuoteItemType;
  reference_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  section: QuoteItemSection;
  bill_separately?: boolean;
  display_order?: number;
};

export type QuoteInput = {
  patient_id?: string | null;
  pipeline_id?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  professional_id?: string | null;
  valid_until?: string | null;
  discount_amount?: number;
  notes?: string | null;
  terms?: string | null;
  items: QuoteItemInput[];
};

export type QuoteListItem = {
  id: string;
  quote_number: number;
  status: QuoteStatus;
  recipient_display: string;
  total_amount: number;
  valid_until: string | null;
  created_at: string;
  sent_at: string | null;
};

export type QuoteDetail = {
  id: string;
  quote_number: number;
  clinic_id: string;
  patient_id: string | null;
  pipeline_id: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  professional_id: string | null;
  professional_name: string | null;
  status: QuoteStatus;
  valid_until: string | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  notes: string | null;
  terms: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
  items: (QuoteItemInput & { id: string })[];
  patient_name: string | null;
  pipeline_name: string | null;
};

export type QuoteRenderContext = {
  clinic: {
    name: string;
    logo_url: string | null;
    logo_scale: number | null;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  quote: QuoteDetail;
  recipient: {
    name: string;
    phone: string | null;
    email: string | null;
  };
  professional_name: string | null;
  emission_date: string;
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aceito: "Aceito",
  recusado: "Recusado",
  expirado: "Expirado",
};

export const QUOTE_STATUS_VARIANTS: Record<
  QuoteStatus,
  "secondary" | "info" | "success" | "destructive" | "warning"
> = {
  rascunho: "secondary",
  enviado: "info",
  aceito: "success",
  recusado: "destructive",
  expirado: "warning",
};

export const DEFAULT_QUOTE_TERMS =
  "Proposta válida até a data indicada. Valores sujeitos a alteração após o prazo de validade. " +
  "Materiais cobrados separadamente, quando indicado, não estão inclusos no total de serviços.";
