import type { KnowledgeAcl } from "../knowledge-acl";

export type InformationSourceId = "clinic" | "procedures" | "services" | "knowledge_base";

export type FieldSpec = {
  id: string;
  label: string;
  /** ACL path under source, e.g. address → clinic.address */
  aclKey: string;
};

export type StructuredSlice = Record<string, unknown>;

export type SourceLoadContext = {
  clinicId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
};

export type InformationSource = {
  id: InformationSourceId;
  displayName: string;
  editHref: string;
  fields: () => FieldSpec[];
  load: (ctx: SourceLoadContext) => Promise<unknown>;
  buildContext: (
    data: unknown,
    acl: KnowledgeAcl,
    neededPaths: string[]
  ) => StructuredSlice | null;
};
