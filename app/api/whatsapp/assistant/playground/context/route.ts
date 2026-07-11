import { NextRequest, NextResponse } from "next/server";
import { requireClinicAdminApi, ApiAuthError, toApiErrorResponse } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { lookupPatientByPhone } from "@/lib/virtual-assistant/services/patients";
import { listPatientAppointmentsViaAssistant } from "@/lib/virtual-assistant/services/appointments";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-utils";

export async function GET(request: NextRequest) {
  try {
    const { clinicId } = await requireClinicAdminApi();
    const phoneRaw = request.nextUrl.searchParams.get("phone")?.trim() ?? "";
    if (!phoneRaw) {
      return NextResponse.json({ error: "phone é obrigatório" }, { status: 400 });
    }

    const phone = normalizeWhatsAppPhone(phoneRaw.replace(/\D/g, ""));
    const supabase = await createClient();

    const patient = await lookupPatientByPhone(supabase, clinicId, phone);

    const { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("id, ai_state, patient_id")
      .eq("clinic_id", clinicId)
      .eq("phone_number", phone)
      .maybeSingle();

    let appointments: Array<{
      id: string;
      scheduled_at: string;
      status: string;
      doctor_name: string | null;
      procedure_name: string | null;
    }> = [];

    if (patient?.id) {
      const rows = await listPatientAppointmentsViaAssistant(supabase, clinicId, patient.id, {
        upcomingOnly: true,
      });
      appointments = rows.map((a) => ({
        id: a.id,
        scheduled_at: a.scheduled_at,
        status: a.status,
        doctor_name: a.doctor_name,
        procedure_name: a.procedure_name,
      }));
    }

    return NextResponse.json({
      phone,
      patient: patient
        ? {
            id: patient.id,
            full_name: patient.full_name,
            email: patient.email,
            phone: patient.phone,
          }
        : null,
      conversationId: conversation?.id ?? null,
      aiState: conversation?.ai_state ?? null,
      appointments,
    });
  } catch (e) {
    if (e instanceof ApiAuthError) return toApiErrorResponse(e);
    const message = e instanceof Error ? e.message : "Erro ao carregar contexto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
