/** ACL of information sources the assistant may consult (governance only — no content). */

export type ClinicAclFields = {
  address: boolean;
  hours: boolean;
  parking: boolean;
  accessibility: boolean;
  units: boolean;
  phones: boolean;
  social: boolean;
  conventions: boolean;
  promotions: boolean;
  paymentMethods: boolean;
};

export type ProcedureAclFields = {
  list: boolean;
  shortDescription: boolean;
  howWePerform: boolean;
  prep: boolean;
  duration: boolean;
  recovery: boolean;
  indications: boolean;
  contraindications: boolean;
  supplies: boolean;
};

export type ServiceAclFields = {
  list: boolean;
  explainDifferences: boolean;
  showPrices: boolean;
  showDimensionVariants: boolean;
};

export type SourceAclEntry<TFields> = {
  enabled: boolean;
  fields: TFields;
};

export type KnowledgeAcl = {
  clinic: SourceAclEntry<ClinicAclFields>;
  procedures: SourceAclEntry<ProcedureAclFields>;
  services: SourceAclEntry<ServiceAclFields>;
  knowledge_base: { enabled: boolean };
};

export type KnowledgeAclInput = {
  clinic?: Partial<SourceAclEntry<Partial<ClinicAclFields>>>;
  procedures?: Partial<SourceAclEntry<Partial<ProcedureAclFields>>>;
  services?: Partial<SourceAclEntry<Partial<ServiceAclFields>>>;
  knowledge_base?: { enabled?: boolean };
};

export function defaultClinicFields(): ClinicAclFields {
  return {
    address: true,
    hours: true,
    parking: true,
    accessibility: true,
    units: true,
    phones: true,
    social: true,
    conventions: true,
    promotions: true,
    paymentMethods: true,
  };
}

export function defaultProcedureFields(): ProcedureAclFields {
  return {
    list: true,
    shortDescription: true,
    howWePerform: true,
    prep: true,
    duration: true,
    recovery: true,
    indications: true,
    contraindications: true,
    supplies: false,
  };
}

export function defaultServiceFields(): ServiceAclFields {
  return {
    list: true,
    explainDifferences: true,
    showPrices: true,
    showDimensionVariants: true,
  };
}

export function defaultKnowledgeAcl(): KnowledgeAcl {
  return {
    clinic: { enabled: true, fields: defaultClinicFields() },
    procedures: { enabled: true, fields: defaultProcedureFields() },
    services: { enabled: true, fields: defaultServiceFields() },
    knowledge_base: { enabled: true },
  };
}

function mergeFields<T extends Record<string, boolean>>(
  defaults: T,
  partial?: Partial<T>
): T {
  if (!partial) return { ...defaults };
  const next = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    if (typeof partial[key] === "boolean") {
      next[key] = partial[key] as T[keyof T];
    }
  }
  return next;
}

export function mergeKnowledgeAcl(stored?: KnowledgeAclInput | null): KnowledgeAcl {
  const d = defaultKnowledgeAcl();
  if (!stored) return d;
  return {
    clinic: {
      enabled: stored.clinic?.enabled ?? d.clinic.enabled,
      fields: mergeFields(d.clinic.fields, stored.clinic?.fields),
    },
    procedures: {
      enabled: stored.procedures?.enabled ?? d.procedures.enabled,
      fields: mergeFields(d.procedures.fields, stored.procedures?.fields),
    },
    services: {
      enabled: stored.services?.enabled ?? d.services.enabled,
      fields: mergeFields(d.services.fields, stored.services?.fields),
    },
    knowledge_base: {
      enabled: stored.knowledge_base?.enabled ?? d.knowledge_base.enabled,
    },
  };
}

/** Dot-path ACL checks used by tool resolution, e.g. `services.showPrices`. */
export function aclFieldEnabled(acl: KnowledgeAcl, path: string): boolean {
  const [sourceId, field] = path.split(".");
  if (!sourceId) return false;
  if (sourceId === "knowledge_base") {
    return acl.knowledge_base.enabled;
  }
  if (sourceId === "clinic") {
    if (!acl.clinic.enabled) return false;
    if (!field) return true;
    return Boolean(acl.clinic.fields[field as keyof ClinicAclFields]);
  }
  if (sourceId === "procedures") {
    if (!acl.procedures.enabled) return false;
    if (!field) return true;
    return Boolean(acl.procedures.fields[field as keyof ProcedureAclFields]);
  }
  if (sourceId === "services") {
    if (!acl.services.enabled) return false;
    if (!field) return true;
    return Boolean(acl.services.fields[field as keyof ServiceAclFields]);
  }
  return false;
}

export function sourceEnabled(
  acl: KnowledgeAcl,
  sourceId: "clinic" | "procedures" | "services" | "knowledge_base"
): boolean {
  if (sourceId === "knowledge_base") return acl.knowledge_base.enabled;
  return acl[sourceId].enabled;
}
