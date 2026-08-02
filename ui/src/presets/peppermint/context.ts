import type { PeppermintPreset } from './types';

const code = `# context.pep — accessing Context fields after a pipe

# After a pipe, the result is a Context with .data and .errors
result = input()
  |> filter(it.age > 18)
  |> add(income_k: it.income / 1000)

# .data — the rows
result.data |> send()

# .errors — rows that failed any step
send(result.errors)

# Dot into a named assignment to access Context fields again
posts = input()
  |> add(group: match(it.age, > 30: "experienced", _: "new"))

posts.data |> send()
posts.errors |> send()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
