export type Cid10Entry = { code: string; description: string };

/** Subset frequente em atendimento ambulatorial (expansível). */
export const CID10_COMMON: Cid10Entry[] = [
  { code: "J06.9", description: "Infecção aguda das vias aéreas superiores não especificada" },
  { code: "J00", description: "Nasofaringite aguda (resfriado comum)" },
  { code: "J02.9", description: "Faringite aguda não especificada" },
  { code: "J03.9", description: "Amigdalite aguda não especificada" },
  { code: "J20.9", description: "Bronquite aguda não especificada" },
  { code: "J18.9", description: "Pneumonia não especificada" },
  { code: "A09", description: "Diarreia e gastroenterite de origem infecciosa presumível" },
  { code: "K30", description: "Dispepsia funcional" },
  { code: "M54.5", description: "Dor lombar baixa" },
  { code: "M54.2", description: "Cervicalgia" },
  { code: "R51", description: "Cefaleia" },
  { code: "R10.4", description: "Outras dores abdominais e as não especificadas" },
  { code: "R50.9", description: "Febre não especificada" },
  { code: "F41.1", description: "Ansiedade generalizada" },
  { code: "F32.9", description: "Episódio depressivo não especificado" },
  { code: "E11.9", description: "Diabetes mellitus tipo 2 sem complicações" },
  { code: "I10", description: "Hipertensão essencial (primária)" },
  { code: "J45.9", description: "Asma não especificada" },
  { code: "N39.0", description: "Infecção do trato urinário de localização não especificada" },
  { code: "Z00.0", description: "Exame médico geral de rotina" },
];

export function searchCid10(query: string, limit = 12): Cid10Entry[] {
  const q = query.trim().toLowerCase();
  if (!q) return CID10_COMMON.slice(0, limit);
  return CID10_COMMON.filter(
    (e) =>
      e.code.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
  ).slice(0, limit);
}
