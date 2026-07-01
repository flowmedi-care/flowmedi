import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export type QuotePdfData = {
  clinic_name: string;
  quote_number: string;
  recipient_name: string;
  procedure_name: string;
  doctor_name: string | null;
  total_amount: number;
  valid_until: string;
  terms: string | null;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 18, textAlign: "center", marginBottom: 8, fontWeight: "bold" },
  subtitle: { fontSize: 10, textAlign: "center", color: "#555", marginBottom: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  label: { color: "#555" },
  value: { fontWeight: "bold" },
  total: {
    fontSize: 14,
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  terms: { fontSize: 9, color: "#666", marginTop: 24, lineHeight: 1.4 },
  footer: { fontSize: 8, color: "#888", textAlign: "center", marginTop: 30 },
});

function fmtBrl(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function fmtDate(iso: string) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

export function QuotePdfDocument({ data }: { data: QuotePdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Orçamento</Text>
        <Text style={styles.subtitle}>{data.clinic_name}</Text>
        <Text style={styles.subtitle}>{data.quote_number}</Text>

        <View style={{ marginBottom: 16 }}>
          <View style={styles.row}>
            <Text style={styles.label}>Destinatário</Text>
            <Text style={styles.value}>{data.recipient_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Procedimento</Text>
            <Text>{data.procedure_name}</Text>
          </View>
          {data.doctor_name ? (
            <View style={styles.row}>
              <Text style={styles.label}>Profissional</Text>
              <Text>{data.doctor_name}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Válido até</Text>
            <Text>{fmtDate(data.valid_until)}</Text>
          </View>
        </View>

        <View style={styles.total}>
          <Text style={styles.value}>Valor total</Text>
          <Text style={styles.value}>{fmtBrl(data.total_amount)}</Text>
        </View>

        {data.terms ? <Text style={styles.terms}>{data.terms}</Text> : null}

        <Text style={styles.footer}>
          Documento gerado pelo Flowmedi — proposta comercial, sujeita a confirmação da clínica.
        </Text>
      </Page>
    </Document>
  );
}
