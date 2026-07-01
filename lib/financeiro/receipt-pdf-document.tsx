import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export type ReceiptPdfLine = {
  label: string;
  amount: number;
  method?: string | null;
};

export type ReceiptPdfItem = {
  label: string;
  quantity: number;
  amount: number;
};

export type ReceiptPdfData = {
  clinic_name: string;
  clinic_address?: string | null;
  clinic_phone?: string | null;
  clinic_tax_id?: string | null;
  receipt_number: string;
  issued_at: string;
  patient_name: string;
  comanda_items: ReceiptPdfItem[];
  subtotal_amount: number | null;
  discount_amount: number | null;
  lines: ReceiptPdfLine[];
  total_received: number;
  comanda_total: number | null;
  comanda_remainder: number | null;
  voided: boolean;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 16, textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 10, textAlign: "center", color: "#666", marginBottom: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { color: "#555" },
  value: { fontWeight: "bold" },
  total: { fontSize: 14, marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#ddd" },
  footer: { fontSize: 8, color: "#888", textAlign: "center", marginTop: 30 },
  watermark: {
    position: "absolute",
    top: 280,
    left: 60,
    fontSize: 48,
    color: "#cc0000",
    opacity: 0.25,
    transform: "rotate(-25deg)",
  },
});

function fmtBrl(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

export function ReceiptPdfDocument({ data }: { data: ReceiptPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {data.voided && <Text style={styles.watermark}>CANCELADO</Text>}
        <Text style={styles.title}>Recibo de pagamento</Text>
        <Text style={styles.subtitle}>{data.clinic_name}</Text>
        {data.clinic_address ? (
          <Text style={styles.subtitle}>{data.clinic_address}</Text>
        ) : null}
        {(data.clinic_phone || data.clinic_tax_id) && (
          <Text style={styles.subtitle}>
            {[data.clinic_phone, data.clinic_tax_id ? `Doc: ${data.clinic_tax_id}` : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        )}
        <Text style={styles.subtitle}>{data.receipt_number}</Text>

        <View style={{ marginBottom: 16 }}>
          <View style={styles.row}>
            <Text style={styles.label}>Paciente</Text>
            <Text style={styles.value}>{data.patient_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Emissão</Text>
            <Text>{fmtDate(data.issued_at)}</Text>
          </View>
        </View>

        {data.comanda_items.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.label, { marginBottom: 6, fontWeight: "bold" }]}>
              Procedimentos e serviços
            </Text>
            {data.comanda_items.map((item, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.label}>
                  {item.label}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                </Text>
                <Text>{fmtBrl(item.amount)}</Text>
              </View>
            ))}
            {data.discount_amount != null && data.discount_amount > 0 && (
              <>
                {data.subtotal_amount != null && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Subtotal</Text>
                    <Text>{fmtBrl(data.subtotal_amount)}</Text>
                  </View>
                )}
                <View style={styles.row}>
                  <Text style={styles.label}>Desconto</Text>
                  <Text>-{fmtBrl(data.discount_amount)}</Text>
                </View>
              </>
            )}
            {data.comanda_total != null && (
              <View style={[styles.row, { marginTop: 4 }]}>
                <Text style={styles.value}>Total da comanda</Text>
                <Text style={styles.value}>{fmtBrl(data.comanda_total)}</Text>
              </View>
            )}
          </View>
        )}

        {data.lines.map((line, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.label}>
              {line.label}
              {line.method ? ` (${line.method})` : ""}
            </Text>
            <Text style={styles.value}>{fmtBrl(line.amount)}</Text>
          </View>
        ))}

        <View style={[styles.row, styles.total]}>
          <Text style={styles.value}>Total recebido</Text>
          <Text style={styles.value}>{fmtBrl(data.total_received)}</Text>
        </View>

        {data.comanda_remainder != null && data.comanda_remainder > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Saldo restante</Text>
            <Text>{fmtBrl(data.comanda_remainder)}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          Documento gerado pelo Flowmedi — comprovante interno, não substitui NF-e/NFC-e.
        </Text>
      </Page>
    </Document>
  );
}
