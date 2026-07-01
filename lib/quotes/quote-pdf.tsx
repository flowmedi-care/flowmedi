import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePdfDocument, type QuotePdfData } from "./quote-pdf-document";

export type { QuotePdfData };

export async function renderQuotePdfBuffer(data: QuotePdfData): Promise<Buffer> {
  const buf = await renderToBuffer(<QuotePdfDocument data={data} />);
  return Buffer.from(buf);
}
