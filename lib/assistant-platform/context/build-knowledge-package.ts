import type { KnowledgeAcl } from "../knowledge-acl";
import type { ResolvedCapabilities } from "../capabilities/definitions";
import { RUNTIME_CAPABILITY_DEFS } from "../capabilities/definitions";
import { listInformationSources } from "../information-sources/registry";
import type { SourceLoadContext } from "../information-sources/types";

/** Structured package — provider-agnostic. Prompt Builder serializes this. */
export type KnowledgePackage = {
  clinic?: Record<string, unknown>;
  procedures?: Record<string, unknown>;
  services?: Record<string, unknown>;
  knowledge_base?: Record<string, unknown>;
};

function collectNeededPaths(capabilities: ResolvedCapabilities): string[] {
  const paths: string[] = [];
  for (const id of capabilities.enabled) {
    const def = RUNTIME_CAPABILITY_DEFS[id];
    if (def) paths.push(...def.requiredContext);
  }
  return paths;
}

function neededSources(capabilities: ResolvedCapabilities, acl: KnowledgeAcl): Set<string> {
  const set = new Set<string>();
  for (const id of capabilities.enabled) {
    const def = RUNTIME_CAPABILITY_DEFS[id];
    for (const src of def.requiredSources) {
      if (src === "knowledge_base" ? acl.knowledge_base.enabled : acl[src].enabled) {
        set.add(src);
      }
    }
  }
  // Always include enabled info sources that map to information capabilities
  if (capabilities.enabled.has("clinic_information") && acl.clinic.enabled) set.add("clinic");
  if (capabilities.enabled.has("procedure_information") && acl.procedures.enabled) {
    set.add("procedures");
  }
  if (capabilities.enabled.has("service_information") && acl.services.enabled) set.add("services");
  if (capabilities.enabled.has("knowledge_base") && acl.knowledge_base.enabled) {
    set.add("knowledge_base");
  }
  if (capabilities.enabled.has("pricing") && acl.services.enabled) set.add("services");
  return set;
}

export async function buildKnowledgePackage(input: {
  loadCtx: SourceLoadContext;
  knowledgeAcl: KnowledgeAcl;
  capabilities: ResolvedCapabilities;
}): Promise<KnowledgePackage> {
  const needed = neededSources(input.capabilities, input.knowledgeAcl);
  const neededPaths = collectNeededPaths(input.capabilities);
  const pkg: KnowledgePackage = {};

  for (const source of listInformationSources()) {
    if (!needed.has(source.id)) continue;
    const data = await source.load(input.loadCtx);
    const slice = source.buildContext(data, input.knowledgeAcl, neededPaths);
    if (!slice) continue;
    if (source.id === "clinic") pkg.clinic = slice;
    else if (source.id === "procedures") pkg.procedures = slice;
    else if (source.id === "services") pkg.services = slice;
    else if (source.id === "knowledge_base") pkg.knowledge_base = slice;
  }

  // Strip prices from services/procedures linkage if pricing capability off
  if (!input.capabilities.enabled.has("pricing") && pkg.services) {
    const items = pkg.services.items as Record<string, unknown>[] | undefined;
    if (Array.isArray(items)) {
      pkg.services = {
        ...pkg.services,
        items: items.map((it) => {
          const { priceMin: _a, priceMax: _b, priceNote: _c, ...rest } = it;
          return { ...rest, priceNote: "consultar" };
        }),
      };
    }
  }

  return pkg;
}
