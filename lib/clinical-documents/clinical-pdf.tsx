import { renderToBuffer } from "@react-pdf/renderer";
import { ClinicalPdfDocument, type ClinicalPdfPayload } from "./clinical-pdf-document";

export type { ClinicalPdfPayload };

export async function renderClinicalDocumentPdfBuffer(
  data: ClinicalPdfPayload
): Promise<Buffer> {
  const buf = await renderToBuffer(<ClinicalPdfDocument data={data} />);
  return Buffer.from(buf);
}
