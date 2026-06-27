import type { DreLine, ExpenseCategory } from "./types";
import { CATEGORY_LABELS, DRE_CATEGORY_ORDER } from "./constants";

export type DreBuildInput = {
  receitaBruta: number;
  cancelamentos: number;
  cmv: number;
  byCategory: Record<string, number>;
  aReceber: number;
  pecldPercent: number;
  irCsllPercent: number;
};

export function buildFullDreLines(input: DreBuildInput): DreLine[] {
  const receitaLiquida = input.receitaBruta - input.cancelamentos;
  const lucroBruto = receitaLiquida - input.cmv;

  const operacionalCats = DRE_CATEGORY_ORDER.filter(
    (c) => !["depreciacao", "pecld", "impostos"].includes(c)
  );
  let despesasOperacionais = 0;
  for (const cat of operacionalCats) {
    despesasOperacionais += input.byCategory[cat] ?? 0;
  }

  const resultadoOperacional = lucroBruto - despesasOperacionais;
  const depreciacao = input.byCategory["depreciacao"] ?? 0;
  const pecldManual = input.byCategory["pecld"] ?? 0;
  const pecldCalc = input.aReceber * (input.pecldPercent / 100);
  const pecld = pecldManual > 0 ? pecldManual : pecldCalc;
  const ebitda = resultadoOperacional;
  const lair = ebitda - depreciacao - pecld;
  const impostosManual = input.byCategory["impostos"] ?? 0;
  const impostosCalc = input.irCsllPercent > 0 ? lair * (input.irCsllPercent / 100) : 0;
  const impostos = impostosManual > 0 ? impostosManual : impostosCalc;
  const resultadoLiquido = lair - impostos;

  const lines: DreLine[] = [
    {
      key: "receita_bruta",
      label: "(+) Receita Bruta de Serviços",
      value: input.receitaBruta,
      level: 0,
      tooltip: "Comandas emitidas no período (competência).",
    },
    {
      key: "cancelamentos",
      label: "(-) Deduções e Cancelamentos",
      value: input.cancelamentos,
      level: 0,
      tooltip: "Comandas canceladas no período.",
    },
    {
      key: "receita_liquida",
      label: "(=) Receita Líquida",
      value: receitaLiquida,
      level: 0,
      isTotal: true,
    },
  ];

  if (input.cmv > 0 || receitaLiquida > 0) {
    lines.push({
      key: "cmv",
      label: "(-) CMV (Custo de Materiais)",
      value: input.cmv,
      level: 0,
      tooltip: "Custo real dos produtos consumidos/faturados.",
    });
    lines.push({
      key: "lucro_bruto",
      label: "(=) Lucro Bruto",
      value: lucroBruto,
      level: 0,
      isTotal: true,
    });
  }

  lines.push({
    key: "despesas_header",
    label: "(-) Despesas Operacionais",
    value: despesasOperacionais,
    level: 0,
    tooltip: "Despesas pagas no período por categoria operacional.",
  });

  for (const cat of operacionalCats) {
    const val = input.byCategory[cat] ?? 0;
    if (val <= 0) continue;
    lines.push({
      key: `despesa_${cat}`,
      label: `• ${CATEGORY_LABELS[cat as ExpenseCategory]}`,
      value: val,
      level: 1,
    });
  }

  lines.push({
    key: "ebitda",
    label: "(=) EBITDA / Resultado Operacional",
    value: ebitda,
    level: 0,
    isTotal: true,
  });

  if (depreciacao > 0) {
    lines.push({
      key: "depreciacao",
      label: "(-) Depreciação e Amortização",
      value: depreciacao,
      level: 0,
    });
  }

  lines.push({
    key: "pecld",
    label: "(-) PECLD (Provisão Inadimplência)",
    value: pecld,
    level: 0,
    tooltip:
      pecldManual > 0
        ? "Provisão lançada manualmente."
        : `${input.pecldPercent}% sobre contas a receber (R$ ${input.aReceber.toLocaleString("pt-BR")}).`,
  });

  lines.push({
    key: "lair",
    label: "(=) LAIR",
    value: lair,
    level: 0,
    isTotal: true,
    tooltip: "Lucro Antes do Imposto de Renda.",
  });

  if (impostos > 0 || input.irCsllPercent > 0) {
    lines.push({
      key: "impostos",
      label: "(-) IR e CSLL",
      value: impostos,
      level: 0,
      tooltip:
        impostosManual > 0
          ? "Impostos lançados manualmente."
          : `${input.irCsllPercent}% sobre LAIR.`,
    });
  }

  lines.push({
    key: "resultado_liquido",
    label: "(=) Resultado Líquido",
    value: resultadoLiquido,
    level: 0,
    isTotal: true,
  });

  return lines;
}

export function drePercentOfRevenue(lines: DreLine[], receitaBruta: number) {
  if (receitaBruta <= 0) return [];
  return lines
    .filter((l) => !l.isTotal && l.level === 0 && l.value > 0)
    .map((l) => ({
      key: l.key,
      label: l.label.replace(/^\([+\-=]\)\s*/, ""),
      pct: (l.value / receitaBruta) * 100,
    }));
}
