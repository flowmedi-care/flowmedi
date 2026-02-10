"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type PatientExamInsert = {
  patient_id: string;
  appointment_id?: string | null;
  file_name: string;
  file_size: number;
  file_type: string;
  exam_type?: string | null;
  description?: string | null;
};

export type PatientExamUpdate = {
  exam_type?: string | null;
  description?: string | null;
};

export type PatientExam = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  exam_type: string | null;
  description: string | null;
  uploaded_by: string | null;
  uploaded_by_role: string | null;
  created_at: string;
};

// Upload de exame para storage
async function uploadExamToStorage(
  file: File,
  clinicId: string,
  patientId: string,
  examId: string
): Promise<{ url: string; path: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  // Validar tipo de arquivo
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowedTypes.includes(file.type)) {
    return {
      error: "Tipo de arquivo não permitido. Use PDF, imagens (JPG, PNG, WEBP) ou documentos Word.",
    };
  }

  // Validar tamanho (20MB)
  const maxSize = 20 * 1024 * 1024; // 20MB em bytes
  if (file.size > maxSize) {
    return { error: "Arquivo muito grande. Tamanho máximo: 20MB." };
  }

  const extension = file.name.split(".").pop() || "pdf";
  const path = `${clinicId}/${patientId}/${examId}.${extension}`;

  const arrayBuffer = await file.arrayBuffer();
  const { data, error } = await supabase.storage
    .from("exams")
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) return { error: error.message };

  // Gerar URL assinada (válida por 1 hora, pode ser ajustada)
  const { data: signedUrlData } = await supabase.storage
    .from("exams")
    .createSignedUrl(path, 3600); // 1 hora

  if (!signedUrlData?.signedUrl) {
    return { error: "Erro ao gerar URL do arquivo." };
  }

  return { url: signedUrlData.signedUrl, path };
}

export async function uploadPatientExam(
  formData: FormData
): Promise<{ error: string | null; examId: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", examId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "secretaria"].includes(profile.role)) {
    return { error: "Apenas administradores e secretárias podem fazer upload de exames.", examId: null };
  }

  const file = formData.get("file") as File;
  if (!file) return { error: "Nenhum arquivo selecionado.", examId: null };

  const patientId = formData.get("patient_id") as string;
  if (!patientId) return { error: "ID do paciente não fornecido.", examId: null };

  // Verificar se paciente pertence à mesma clínica
  const { data: patient } = await supabase
    .from("patients")
    .select("id, clinic_id")
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!patient) {
    return { error: "Paciente não encontrado ou não pertence à sua clínica.", examId: null };
  }

  const appointmentId = formData.get("appointment_id") as string | null;
  const examType = formData.get("exam_type") as string | null;
  const description = formData.get("description") as string | null;

  // Criar registro do exame primeiro para obter o ID
  const { data: exam, error: insertError } = await supabase
    .from("patient_exams")
    .insert({
      patient_id: patientId,
      appointment_id: appointmentId || null,
      clinic_id: profile.clinic_id,
      file_url: "", // Será atualizado após upload
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      exam_type: examType || null,
      description: description || null,
      uploaded_by: user.id,
      uploaded_by_role: profile.role,
    })
    .select("id")
    .single();

  if (insertError || !exam) {
    return { error: insertError?.message || "Erro ao criar registro do exame.", examId: null };
  }

  // Fazer upload do arquivo
  const uploadResult = await uploadExamToStorage(file, profile.clinic_id, patientId, exam.id);

  if ("error" in uploadResult) {
    // Deletar registro se upload falhar
    await supabase.from("patient_exams").delete().eq("id", exam.id);
    return { error: uploadResult.error, examId: null };
  }

  // Atualizar registro com a URL do arquivo
  const { error: updateError } = await supabase
    .from("patient_exams")
    .update({ file_url: uploadResult.path })
    .eq("id", exam.id);

  if (updateError) {
    // Tentar deletar arquivo do storage se atualização falhar
    await supabase.storage.from("exams").remove([uploadResult.path]);
    await supabase.from("patient_exams").delete().eq("id", exam.id);
    return { error: updateError.message, examId: null };
  }

  revalidatePath("/dashboard/pacientes");
  revalidatePath(`/dashboard/agenda/consulta/${appointmentId || ""}`);
  return { error: null, examId: exam.id };
}

export async function getPatientExams(patientId: string): Promise<{ data: PatientExam[] | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) {
    return { data: null, error: "Clínica não encontrada." };
  }

  const { data: exams, error } = await supabase
    .from("patient_exams")
    .select("*")
    .eq("patient_id", patientId)
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  return { data: exams as PatientExam[], error: null };
}

export async function getAppointmentExams(appointmentId: string): Promise<{ data: PatientExam[] | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) {
    return { data: null, error: "Clínica não encontrada." };
  }

  // Buscar exames vinculados à consulta OU exames do paciente da consulta
  const { data: appointment } = await supabase
    .from("appointments")
    .select("patient_id")
    .eq("id", appointmentId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!appointment) {
    return { data: null, error: "Consulta não encontrada." };
  }

  const { data: exams, error } = await supabase
    .from("patient_exams")
    .select("*")
    .eq("patient_id", appointment.patient_id)
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  return { data: exams as PatientExam[], error: null };
}

export async function updatePatientExam(
  examId: string,
  data: PatientExamUpdate
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "secretaria"].includes(profile.role)) {
    return { error: "Apenas administradores e secretárias podem atualizar exames." };
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.exam_type !== undefined) updateData.exam_type = data.exam_type || null;
  if (data.description !== undefined) updateData.description = data.description || null;

  const { error } = await supabase
    .from("patient_exams")
    .update(updateData)
    .eq("id", examId)
    .eq("clinic_id", profile.clinic_id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/pacientes");
  return { error: null };
}

export async function deletePatientExam(examId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "secretaria"].includes(profile.role)) {
    return { error: "Apenas administradores e secretárias podem deletar exames." };
  }

  // Buscar exame para obter file_url
  const { data: exam } = await supabase
    .from("patient_exams")
    .select("file_url, appointment_id")
    .eq("id", examId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!exam) {
    return { error: "Exame não encontrado." };
  }

  // Deletar arquivo do storage
  if (exam.file_url) {
    await supabase.storage.from("exams").remove([exam.file_url]);
  }

  // Deletar registro
  const { error: deleteError } = await supabase
    .from("patient_exams")
    .delete()
    .eq("id", examId)
    .eq("clinic_id", profile.clinic_id);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/dashboard/pacientes");
  if (exam.appointment_id) {
    revalidatePath(`/dashboard/agenda/consulta/${exam.appointment_id}`);
  }
  return { error: null };
}

export async function getExamSignedUrl(fileUrl: string): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { url: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) {
    return { url: null, error: "Clínica não encontrada." };
  }

  // Verificar se o exame pertence à mesma clínica
  const { data: exam } = await supabase
    .from("patient_exams")
    .select("id")
    .eq("file_url", fileUrl)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!exam) {
    return { url: null, error: "Exame não encontrado ou acesso negado." };
  }

  // Gerar URL assinada válida por 1 hora
  const { data: signedUrlData, error } = await supabase.storage
    .from("exams")
    .createSignedUrl(fileUrl, 3600);

  if (error || !signedUrlData?.signedUrl) {
    return { url: null, error: error?.message || "Erro ao gerar URL do arquivo." };
  }

  return { url: signedUrlData.signedUrl, error: null };
}
