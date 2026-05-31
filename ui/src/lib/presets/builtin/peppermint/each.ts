import type { PeppermintPreset } from './types';

const code = `input()

# Top 2 products by revenue per region
  |> each(by: "region",
      |> add(rank: rank(col.revenue, dir: "desc"))
      |> filter(it.rank <= 2)
      |> drop("rank")
  )
  |> sort(by: "region")
  |> send`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
