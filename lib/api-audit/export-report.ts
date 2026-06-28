import type { AuditTestResult } from "./types";

export function exportReportMarkdown(results: AuditTestResult[]): string {
  const lines: string[] = [
    "# Relatório de Validação de APIs",
    "",
    `Gerado em: ${new Date().toISOString()}`,
    "",
    "| Endpoint | Método | Cenário | Status | Tempo | Classificação | Problema |",
    "|----------|--------|---------|--------|-------|---------------|----------|",
  ];

  for (const r of results) {
    const problem = r.skipped
      ? r.skipReason ?? "Skip"
      : r.problems.join("; ") || "—";
    lines.push(
      `| ${r.pathTemplate} | ${r.method} | ${r.scenario} | ${r.status || "—"} | ${r.durationMs}ms | ${r.classification} | ${problem.replace(/\|/g, "\\|")} |`
    );
  }

  const critical = results.filter((r) => r.classification === "critico");
  if (critical.length) {
    lines.push("", "## Críticos", "");
    for (const r of critical) {
      lines.push(`- **${r.method} ${r.pathTemplate}** (${r.scenario}): ${r.problems.join("; ") || r.recommendation}`);
    }
  }

  return lines.join("\n");
}

export function exportReportJson(results: AuditTestResult[]): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      results,
    },
    null,
    2
  );
}

export function exportReportCsv(results: AuditTestResult[]): string {
  const header =
    "endpoint,method,scenario,status,duration_ms,classification,problem,recommendation,file";
  const rows = results.map((r) => {
    const problem = r.skipped ? r.skipReason ?? "" : r.problems.join("; ");
    const cols = [
      r.pathTemplate,
      r.method,
      r.scenario,
      String(r.status),
      String(r.durationMs),
      r.classification,
      problem,
      r.recommendation,
      r.file,
    ];
    return cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
  });
  return [header, ...rows].join("\n");
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
