/**
 * Módulo Formulários — publica Domain Events no Case Management bus.
 * Nunca altera Case.phase diretamente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { publishDomainEvent } from "@/lib/case-management/bus";
import {
  contactIdFromLead,
  contactIdFromPatient,
  getOpenCaseByContact,
} from "@/lib/case-management";

export async function publishFormCompletedEvent(
  db: SupabaseClient,
  input: {
    clinicId: string;
    formInstanceId?: string;
    templateId?: string;
    patientId?: string | null;
    leadId?: string | null;
    appointmentId?: string | null;
    actor?: string;
  }
): Promise<void> {
  let contactId: string | null = null;
  if (input.patientId) contactId = contactIdFromPatient(input.patientId);
  else if (input.leadId) contactId = contactIdFromLead(input.leadId);

  let caseId: string | null = null;
  if (contactId) {
    const open = await getOpenCaseByContact(db, input.clinicId, contactId);
    caseId = open?.id ?? null;
  }

  await publishDomainEvent(db, {
    clinicId: input.clinicId,
    caseId,
    contactId,
    leadId: input.leadId,
    patientId: input.patientId,
    eventType: "Form.Completed",
    actor: input.actor ?? "system",
    payload: {
      form_instance_id: input.formInstanceId ?? null,
      template_id: input.templateId ?? null,
      appointment_id: input.appointmentId ?? null,
    },
    ensureCase: contactId ? { process_type_code: "primeira_consulta" } : undefined,
  });
}

export async function publishFormSentEvent(
  db: SupabaseClient,
  input: {
    clinicId: string;
    templateId?: string;
    patientId?: string | null;
    appointmentId?: string | null;
    actor?: string;
  }
): Promise<void> {
  const contactId = input.patientId ? contactIdFromPatient(input.patientId) : null;
  let caseId: string | null = null;
  if (contactId) {
    const open = await getOpenCaseByContact(db, input.clinicId, contactId);
    caseId = open?.id ?? null;
  }

  await publishDomainEvent(db, {
    clinicId: input.clinicId,
    caseId,
    contactId,
    patientId: input.patientId,
    eventType: "Form.Sent",
    actor: input.actor ?? "system",
    payload: {
      template_id: input.templateId ?? null,
      appointment_id: input.appointmentId ?? null,
    },
  });
}
