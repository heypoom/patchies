import type { PeppermintPreset } from './types';

const code = `# collapse_lambda.pep — custom aggregation with lambdas in collapse

# Built-in aggregations
input()
  |> collapse(by: "region",
      n:          count(),
      avg_income: mean(col.income),
      top_earner: rows -> rows |> sort(by: "income", dir: "desc") |> get(0)
  )
  |> print()

# Collapse without by — summarize the whole table
input()
  |> collapse(
      n:     count(),
      names: rows -> rows |> map(it.name)
  )
  |> print()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
