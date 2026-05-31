import type { PeppermintPreset } from './types';

const code = `# 02_transform.pep — reusable transforms via named functions

clean = data -> (
  data
    |> filter(it.age > 18)
    |> filter(it.income > 0)
)

engineer = data -> (
  data
    |> add(income_per_year: it.income)
    |> add(seniority:
      match(it.age,
        > 50: "senior",
        > 35: "mid",
        _: "junior"))
    |> drop("score")
)

input()
  |> clean()
  |> engineer()
  |> sort(by: "income_per_year", dir: "desc")
  |> print()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
