import { renderToBuffer } from "@react-pdf/renderer";
import {
  ReceiptPdfDocument,
  type ReceiptPdfData,
  type ReceiptPdfLine,
} from "./receipt-pdf-document";

export type { ReceiptPdfData, ReceiptPdfLine };

/** CORRIGIDO v2 — gera PDF binário do recibo para upload no Storage. */
export async function renderReceiptPdfBuffer(data: ReceiptPdfData): Promise<Buffer> {
  const buf = await renderToBuffer(<ReceiptPdfDocument data={data} />);
  return Buffer.from(buf);
}
