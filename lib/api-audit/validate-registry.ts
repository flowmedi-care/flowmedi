import fs from "fs";
import path from "path";
import type { HttpMethod, RegistryValidationResult } from "./types";
import { API_AUDIT_REGISTRY } from "./registry";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function routeFileToApiPath(relativePath: string): string {
  const withoutRoute = relativePath.replace(/\/route\.ts$/, "");
  return `/api/${withoutRoute}`;
}

function scanRouteFiles(dir: string, baseDir: string): { file: string; method: HttpMethod; path: string }[] {
  const results: { file: string; method: HttpMethod; path: string }[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "dev") continue;
      results.push(...scanRouteFiles(fullPath, baseDir));
      continue;
    }
    if (entry.name !== "route.ts") continue;

    const relative = path.relative(baseDir, fullPath).replace(/\\/g, "/");
    const apiPath = routeFileToApiPath(relative);
    const content = fs.readFileSync(fullPath, "utf8");
    const regex = /export async function (GET|POST|PUT|PATCH|DELETE)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      results.push({
        file: `app/api/${relative.replace(/\/route\.ts$/, "/route.ts")}`,
        method: match[1] as HttpMethod,
        path: apiPath,
      });
    }
  }
  return results;
}

export function validateRegistryAgainstFilesystem(projectRoot?: string): RegistryValidationResult {
  const root = projectRoot ?? process.cwd();
  const apiDir = path.join(root, "app", "api");
  const filesystem = scanRouteFiles(apiDir, apiDir);

  const registryKeys = new Set(
    API_AUDIT_REGISTRY.map((r) => `${r.method}:${normalizePath(r.pathTemplate)}:${normalizeFile(r.file)}`)
  );
  const fsKeys = new Set(
    filesystem.map((f) => `${f.method}:${normalizePath(f.path)}:${normalizeFile(f.file)}`)
  );

  const missingInRegistry = filesystem.filter(
    (f) => !registryKeys.has(`${f.method}:${normalizePath(f.path)}:${normalizeFile(f.file)}`)
  );

  const extraInRegistry = API_AUDIT_REGISTRY.filter(
    (r) => !fsKeys.has(`${r.method}:${normalizePath(r.pathTemplate)}:${normalizeFile(r.file)}`)
  ).map((r) => ({
    id: r.id,
    file: r.file,
    method: r.method,
    pathTemplate: r.pathTemplate,
  }));

  return {
    inSync: missingInRegistry.length === 0 && extraInRegistry.length === 0,
    registryCount: API_AUDIT_REGISTRY.length,
    filesystemCount: filesystem.length,
    missingInRegistry,
    extraInRegistry,
  };
}

function normalizePath(p: string): string {
  return p.replace(/\/+$/, "").toLowerCase();
}

function normalizeFile(f: string): string {
  return f.replace(/\\/g, "/").toLowerCase();
}

export { HTTP_METHODS };
