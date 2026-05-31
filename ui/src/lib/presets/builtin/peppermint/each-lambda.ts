import type { PeppermintPreset } from './types';

const code = `# each_lambda.pep — both forms of each: block and lambda

# Block form — multi-step, reads like a loop body
input()
  |> each(by: "region",
      |> sort(by: "income", dir: "desc")
      |> take(2)
  )
  |> print()

# Lambda form — single expression, consistent with map/filter
input()
  |> each(by: "region", grp -> grp |> sort(by: "income", dir: "desc") |> take(2))
  |> print()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
