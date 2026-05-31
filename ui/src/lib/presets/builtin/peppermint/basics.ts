import type { PeppermintPreset } from './types';

const code = `# 01_basics.pep — filtering, adding fields, sorting

result = input()
  |> filter(it.age > 18)
  |> add(score_pct: it.score * 100)
  |> add(tier: match(it.income, > 80000: "high", > 40000: "medium", _: "low"))
  |> sort(by: "income", dir: "desc")

print(result)`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
