import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveServicePriceForClinic } from "@/lib/virtual-assistant/services/pricing";

export type QuotePricingMode = "clinic_general" | "per_doctor";

export type QuoteDoctorOption = {
  id: string;
  name: string;
  price: number | null;
  serviceId: string | null;
  needsDimensions: boolean;
};

export type ResolvedQuoteContext = {
  procedureId: string;
  procedureName: string;
  pricingMode: QuotePricingMode;
  validUntil: string;
  doctors: QuoteDoctorOption[];
  needsDoctorChoice: boolean;
  autoSelectedDoctorId: string | null;
  selectedDoctor: QuoteDoctorOption | null;
  fallbackToHuman: boolean;
  hint: string;
};

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadProcedureQuoteSettings(
  supabase: SupabaseClient,
  clinicId: string,
  procedureId: string
) {
  const { data } = await supabase
    .from("procedure_quote_settings")
    .select("pricing_mode, default_service_id, default_professional_id")
    .eq("clinic_id", clinicId)
    .eq("procedure_id", procedureId)
    .maybeSingle();

  return {
    pricingMode: (data?.pricing_mode as QuotePricingMode) ?? "per_doctor",
    defaultServiceId: data?.default_service_id ? String(data.default_service_id) : null,
    defaultProfessionalId: data?.default_professional_id
      ? String(data.default_professional_id)
      : null,
  };
}

async function loadDoctorsForProcedure(
  supabase: SupabaseClient,
  clinicId: string,
  procedureId: string
): Promise<{ id: string; name: string }[]> {
  const { data: links } = await supabase
    .from("doctor_procedures")
    .select("doctor_id, profiles!doctor_procedures_doctor_id_fkey(id, full_name)")
    .eq("clinic_id", clinicId)
    .eq("procedure_id", procedureId);

  const fromLinks = (links ?? [])
    .map((row) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return p ? { id: String(p.id), name: String(p.full_name ?? "Médico") } : null;
    })
    .filter((d): d is { id: string; name: string } => !!d);

  if (fromLinks.length > 0) return fromLinks;

  const { data: allDoctors } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("role", "medico")
    .order("full_name");

  return (allDoctors ?? []).map((d) => ({
    id: String(d.id),
    name: String(d.full_name ?? "Médico"),
  }));
}

async function resolveDoctorPrice(
  supabase: SupabaseClient,
  clinicId: string,
  doctorId: string,
  procedureId: string,
  overrideServiceId: string | null
): Promise<QuoteDoctorOption> {
  const { data: proc } = await supabase
    .from("procedures")
    .select("name, default_service_id")
    .eq("id", procedureId)
    .single();

  const serviceId = overrideServiceId ?? proc?.default_service_id ?? null;
  const { data: doctor } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", doctorId)
    .maybeSingle();

  if (!serviceId) {
    return {
      id: doctorId,
      name: String(doctor?.full_name ?? "Médico"),
      price: null,
      serviceId: null,
      needsDimensions: false,
    };
  }

  const priceRes = await resolveServicePriceForClinic(
    supabase,
    clinicId,
    String(serviceId),
    doctorId,
    []
  );

  return {
    id: doctorId,
    name: String(doctor?.full_name ?? "Médico"),
    price: priceRes.valor,
    serviceId: String(serviceId),
    needsDimensions: Boolean(priceRes.needsDimensions),
  };
}

export async function resolveQuoteContext(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    procedureId: string;
    doctorId?: string | null;
    dimensionValueIds?: string[];
  }
): Promise<ResolvedQuoteContext> {
  const { data: clinic } = await supabase
    .from("clinics")
    .select("quote_default_validity_days")
    .eq("id", opts.clinicId)
    .single();

  const validityDays = Number(clinic?.quote_default_validity_days) || 15;
  const validUntil = addDays(validityDays);

  const { data: procedure } = await supabase
    .from("procedures")
    .select("id, name, default_service_id")
    .eq("id", opts.procedureId)
    .eq("clinic_id", opts.clinicId)
    .single();

  if (!procedure) {
    return {
      procedureId: opts.procedureId,
      procedureName: "Procedimento",
      pricingMode: "per_doctor",
      validUntil,
      doctors: [],
      needsDoctorChoice: false,
      autoSelectedDoctorId: null,
      selectedDoctor: null,
      fallbackToHuman: true,
      hint: "Procedimento não encontrado.",
    };
  }

  const settings = await loadProcedureQuoteSettings(supabase, opts.clinicId, opts.procedureId);
  const doctorsRaw = await loadDoctorsForProcedure(supabase, opts.clinicId, opts.procedureId);

  const serviceOverride =
    settings.defaultServiceId ?? (procedure.default_service_id ? String(procedure.default_service_id) : null);

  let doctors: QuoteDoctorOption[] = [];
  if (settings.pricingMode === "clinic_general") {
    const doctorId =
      settings.defaultProfessionalId ?? (doctorsRaw.length === 1 ? doctorsRaw[0].id : doctorsRaw[0]?.id);
    if (doctorId) {
      doctors = [await resolveDoctorPrice(supabase, opts.clinicId, doctorId, opts.procedureId, serviceOverride)];
    }
  } else {
    doctors = await Promise.all(
      doctorsRaw.map((d) =>
        resolveDoctorPrice(supabase, opts.clinicId, d.id, opts.procedureId, serviceOverride)
      )
    );
  }

  if (opts.doctorId) {
    const selected = doctors.find((d) => d.id === opts.doctorId);
    if (!selected) {
      const one = await resolveDoctorPrice(
        supabase,
        opts.clinicId,
        opts.doctorId,
        opts.procedureId,
        serviceOverride
      );
      doctors = [one];
    }
  }

  const selectedDoctor = opts.doctorId
    ? doctors.find((d) => d.id === opts.doctorId) ?? null
    : null;

  let needsDoctorChoice = false;
  let autoSelectedDoctorId: string | null = null;
  let fallbackToHuman = doctors.length === 0;

  if (settings.pricingMode === "clinic_general") {
    needsDoctorChoice = false;
    autoSelectedDoctorId = doctors[0]?.id ?? null;
  } else if (opts.doctorId) {
    needsDoctorChoice = false;
    autoSelectedDoctorId = opts.doctorId;
  } else if (doctors.length === 0) {
    fallbackToHuman = true;
  } else if (doctors.length === 1) {
    needsDoctorChoice = false;
    autoSelectedDoctorId = doctors[0].id;
  } else {
    needsDoctorChoice = true;
  }

  let hint = "";
  if (fallbackToHuman) {
    hint = "Não foi possível montar o orçamento automaticamente. Encaminhe para a equipe.";
  } else if (needsDoctorChoice) {
    hint =
      "Apresente os médicos em lista numerada e pergunte se o paciente tem preferência por algum profissional.";
  } else if (doctors.some((d) => d.needsDimensions)) {
    hint = "Use list_price_options para convênio/turno antes de gerar o orçamento.";
  } else {
    hint = "Pode gerar e enviar o orçamento com create_and_send_quote.";
  }

  return {
    procedureId: String(procedure.id),
    procedureName: String(procedure.name),
    pricingMode: settings.pricingMode,
    validUntil,
    doctors,
    needsDoctorChoice,
    autoSelectedDoctorId,
    selectedDoctor,
    fallbackToHuman,
    hint,
  };
}
