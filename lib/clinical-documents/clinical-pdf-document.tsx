import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ClinicalDocumentType, DocumentRenderContext, MedicationItem } from "./types";
import type { ExamOrderLine } from "./types";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a2e35" },
  header: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#0d6b7d", paddingBottom: 8 },
  clinicName: { fontSize: 14, fontWeight: "bold", color: "#0d6b7d" },
  meta: { fontSize: 8, color: "#5a7a85", marginTop: 2 },
  badge: {
    fontSize: 9,
    backgroundColor: "#0d6b7d",
    color: "#fff",
    padding: 4,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginTop: 10, marginBottom: 6 },
  row: { marginBottom: 4 },
  medCard: { marginBottom: 8, padding: 8, borderWidth: 1, borderColor: "#e2e8f0" },
  medName: { fontSize: 11, fontWeight: "bold", color: "#0d6b7d" },
  medMeta: { fontSize: 9, color: "#555", marginTop: 2 },
  body: { fontSize: 10, lineHeight: 1.5, marginTop: 8 },
  footer: { marginTop: 24, borderTopWidth: 1, borderTopColor: "#ddd", paddingTop: 12 },
  signature: { marginTop: 40, borderTopWidth: 1, borderTopColor: "#333", width: "60%" },
  signatureLabel: { fontSize: 8, color: "#555", marginTop: 4 },
});

export type ClinicalPdfPayload = {
  type: ClinicalDocumentType;
  ctx: DocumentRenderContext;
  medications?: MedicationItem[];
  bodyText?: string;
  examLines?: ExamOrderLine[];
  examNotes?: string;
  certificateBody?: string;
  certificateDays?: number;
  certificateCid?: string;
};

function docTitle(type: ClinicalDocumentType) {
  if (type === "prescription") return "RECEITUÁRIO MÉDICO";
  if (type === "certificate") return "ATESTADO MÉDICO";
  return "PEDIDO DE EXAME";
}

export function ClinicalPdfDocument({ data }: { data: ClinicalPdfPayload }) {
  const { ctx, type } = data;
  const crm =
    ctx.doctor.crm && ctx.doctor.crm_uf
      ? `CRM/${ctx.doctor.crm_uf} ${ctx.doctor.crm}`
      : ctx.doctor.crm ?? "";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.clinicName}>{ctx.clinic.name}</Text>
          {ctx.clinic.address ? <Text style={styles.meta}>{ctx.clinic.address}</Text> : null}
          {ctx.clinic.phone ? <Text style={styles.meta}>Tel: {ctx.clinic.phone}</Text> : null}
        </View>

        <Text style={styles.badge}>{docTitle(type)}</Text>

        <View>
          <Text style={styles.row}>
            <Text style={{ fontWeight: "bold" }}>Paciente: </Text>
            {ctx.patient.full_name}
          </Text>
          {ctx.patient.cpf ? (
            <Text style={styles.row}>
              <Text style={{ fontWeight: "bold" }}>CPF: </Text>
              {ctx.patient.cpf}
            </Text>
          ) : null}
          <Text style={styles.row}>
            <Text style={{ fontWeight: "bold" }}>Data de emissão: </Text>
            {ctx.emission_date}
          </Text>
        </View>

        {type === "prescription" && data.medications ? (
          <View>
            <Text style={styles.sectionTitle}>Medicamentos</Text>
            {data.medications
              .filter((m) => m.name.trim())
              .map((m, i) => (
                <View key={`${m.name}-${i}`} style={styles.medCard}>
                  <Text style={styles.medName}>
                    {i + 1}. {m.name}
                  </Text>
                  {(m.dosage || m.quantity) && (
                    <Text style={styles.medMeta}>
                      {[m.dosage, m.quantity].filter(Boolean).join(" • ")}
                    </Text>
                  )}
                  {m.instructions ? <Text style={styles.medMeta}>{m.instructions}</Text> : null}
                </View>
              ))}
            {data.bodyText?.trim() ? (
              <Text style={styles.body}>{data.bodyText}</Text>
            ) : null}
          </View>
        ) : null}

        {type === "exam_request" && data.examLines ? (
          <View>
            <Text style={styles.sectionTitle}>Exames solicitados</Text>
            {data.examLines
              .filter((l) => l.name.trim())
              .map((l, i) => (
                <View key={`${l.name}-${i}`} style={styles.medCard}>
                  <Text style={styles.medName}>{l.name}</Text>
                  {l.details?.trim() ? <Text style={styles.medMeta}>{l.details}</Text> : null}
                </View>
              ))}
            {data.examNotes?.trim() ? (
              <Text style={styles.body}>Observações: {data.examNotes}</Text>
            ) : null}
          </View>
        ) : null}

        {type === "certificate" && data.certificateBody ? (
          <View>
            <Text style={styles.body}>{data.certificateBody}</Text>
            {data.certificateDays ? (
              <Text style={styles.row}>
                Afastamento: {data.certificateDays} dia(s)
              </Text>
            ) : null}
            {data.certificateCid?.trim() ? (
              <Text style={styles.row}>CID: {data.certificateCid}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={{ fontWeight: "bold" }}>{ctx.doctor.full_name}</Text>
          {crm ? <Text style={styles.meta}>{crm}</Text> : null}
        </View>

        <View style={styles.signature}>
          <Text style={styles.signatureLabel}>Assinatura e carimbo do médico</Text>
        </View>
      </Page>
    </Document>
  );
}
