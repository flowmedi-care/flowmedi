const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const apiDir = path.join(root, "app", "api");

function scan(dir, base) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "dev") continue;
      out.push(...scan(full, base));
    } else if (entry.name === "route.ts") {
      const rel = path.relative(base, full).replace(/\\/g, "/");
      const apiPath = "/api/" + rel.replace(/\/route\.ts$/, "");
      const content = fs.readFileSync(full, "utf8");
      const re = /export async function (GET|POST|PUT|PATCH|DELETE)/g;
      let m;
      while ((m = re.exec(content)) !== null) {
        out.push({ method: m[1], path: apiPath, file: "app/api/" + rel });
      }
    }
  }
  return out;
}

const fsEntries = scan(apiDir, apiDir);
const registryContent = fs.readFileSync(path.join(root, "lib/api-audit/registry.ts"), "utf8");
const pathMatches = [...registryContent.matchAll(/path: "(\/api[^"]+)"/g)].map((m) => m[1]);
const pathMatches2 = [...registryContent.matchAll(/path: path as string/g)];

console.log("Filesystem handlers:", fsEntries.length);
console.log("Registry path literals:", pathMatches.length, "+ spreads ~10");

const registryKeys = new Set();
for (const m of [...registryContent.matchAll(/method: "(GET|POST|PUT|PATCH|DELETE)"[\s\S]*?path: "(\/api[^"]+)"/g)]) {
  registryKeys.add(`${m[1]}:${m[2]}`);
}

const missing = fsEntries.filter((f) => !registryKeys.has(`${f.method}:${f.path}`));
console.log("\nMissing:", missing.length);
missing.forEach((m) => console.log(`  ${m.method} ${m.path}`));
