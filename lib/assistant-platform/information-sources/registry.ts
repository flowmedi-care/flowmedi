import type { InformationSource, InformationSourceId } from "./types";
import { clinicSource } from "./clinic";
import { proceduresSource } from "./procedures";
import { servicesSource } from "./services";
import { knowledgeBaseSource } from "./knowledge-base";

const SOURCES: InformationSource[] = [
  clinicSource,
  proceduresSource,
  servicesSource,
  knowledgeBaseSource,
];

const BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

export function listInformationSources(): InformationSource[] {
  return [...SOURCES];
}

export function getInformationSource(id: InformationSourceId): InformationSource | undefined {
  return BY_ID.get(id);
}

export { clinicSource, proceduresSource, servicesSource, knowledgeBaseSource };
export type { InformationSource, InformationSourceId, FieldSpec } from "./types";
