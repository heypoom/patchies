import type { PeppermintPreset } from './types';

const code = `# aggregation.pep — collapse, each, and column functions

# Basic aggregation — collapse all rows into a single summary
input()
  |> collapse(
      avg_income: mean(col.income),
      min_age:    min(col.age),
      max_age:    max(col.age),
      n:          count()
  )
  |> send()

# Group by region using collapse
input()
  |> collapse(by: "region",
      avg_income: mean(col.income),
      n:          count()
  )
  |> sort(by: "avg_income", dir: "desc")
  |> send()

# Annotate each row with its group average (broadcast)
input()
  |> add(region_avg: mean(col.income, by: "region"))
  |> send()

# Top 1 per region using each
input()
  |> each(by: "region",
      |> add(rank: rank(col.income, dir: "desc"))
      |> filter(it.rank == 1)
      |> drop("rank")
  )
  |> send()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
