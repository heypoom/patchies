import type { PeppermintPreset } from './types';

const code = `# 05_sales_analysis.pep — multi-step sales pipeline with derived metrics

input()
  |> add(revenue_per_unit: it.revenue / it.units)
  |> add(performance: match(it.revenue, > 12000: "strong", > 7000: "moderate", _: "weak"))
  |> sort(by: "revenue", dir: "desc")
  |> send()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
