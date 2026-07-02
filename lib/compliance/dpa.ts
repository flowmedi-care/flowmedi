/** Versão vigente do DPA (sincronizar com app/acordo-tratamento-dados). */

const DPA_VERSION = "2026-07-02";

export function getDpaVersion(): string {
  return DPA_VERSION;
}

export function getDpaDocumentUrl(): string {
  return "/acordo-tratamento-dados";
}
