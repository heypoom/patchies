import type { PeppermintPreset } from './types';

const code = `# error_handling.pep — row-level errors and recovery

# When add() fails on a row, that row moves to .errors
# Other rows continue through the pipe unaffected

result = input()
  |> add(ratio: it.income / it.age)

# .errors holds any rows that failed
print(result.errors)

# recover() pulls failed rows back with a fallback value
result2 = input()
  |> add(score_label: match(it.score,
      > 0.8: "high",
      > 0.5: "medium",
      _:     "low"
  ))
  |> recover(score_label: "unknown")

result2.data |> print()

# Echo the original input so the preset is still useful in Patchies,
# where data arrives by message rather than file loading.
input() |> print()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
