export type ClinicalDocumentType = "prescription" | "exam_request";

export type ClinicalTemplateScope = "clinic" | "doctor";

export type ClinicalDocumentStatus =
  | "draft"
  | "pending_signature"
  | "issued_manual"
  | "signed_digital"
  | "void";

export type SignatureMode = "manual" | "digital_icp";

export type MedicationItem = {
  name: string;
  dosage: string;
  quantity: string;
  instructions: string;
};

export type ExamItem = {
  name: string;
  notes: string;
  catalogId?: string;
  category?: string;
};

/** Linha do pedido: exame do catálogo + detalhes do que solicitar (ex.: itens do hemograma) */
export type ExamOrderLine = {
  catalogId?: string;
  name: string;
  details: string;
};

export type StructuredContent =
  | { medications: MedicationItem[] }
  | { exams: ExamItem[] }
  | { selectedExamIds: string[]; examNotes?: string }
  | { examLines: ExamOrderLine[]; examNotes?: string };

export type MedicationCatalogItem = {
  id: string;
  clinic_id: string;
  scope: ClinicalTemplateScope;
  doctor_id: string | null;
  name: string;
  default_dosage: string;
  default_quantity: string;
  default_instructions: string;
  display_order: number;
  is_active: boolean;
};

export type ExamCatalogItem = {
  id: string;
  clinic_id: string;
  scope: ClinicalTemplateScope;
  doctor_id: string | null;
  name: string;
  category: string;
  default_details: string;
  display_order: number;
  is_active: boolean;
};

export type ClinicalDocumentTemplate = {
  id: string;
  clinic_id: string;
  type: ClinicalDocumentType;
  scope: ClinicalTemplateScope;
  doctor_id: string | null;
  name: string;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClinicalDocument = {
  id: string;
  clinic_id: string;
  type: ClinicalDocumentType;
  patient_id: string;
  appointment_id: string | null;
  doctor_id: string;
  template_id: string | null;
  title: string | null;
  body_text: string;
  body_rendered: string | null;
  structured_content: StructuredContent;
  signature_mode: SignatureMode | null;
  status: ClinicalDocumentStatus;
  pdf_path: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentRenderContext = {
  patient: {
    full_name: string;
    cpf: string | null;
    birth_date: string | null;
    phone: string | null;
  };
  doctor: {
    full_name: string;
    crm: string | null;
    crm_uf: string | null;
    logo_url: string | null;
    logo_scale: number | null;
  };
  clinic: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    logo_url: string | null;
    logo_scale: number | null;
  };
  emission_date: string;
};
