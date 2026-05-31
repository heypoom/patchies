import type { PeppermintPreset } from './types';

const code = `# context.pep — accessing Context fields after a pipe

use ml

# After a pipe, the result is a Context with .data and .errors
result = input()
  |> filter(it.age > 18)
  |> add(income_k: it.income / 1000)

# .data — the rows
result.data |> print()

# .errors — rows that failed any step
print(result.errors)

# Dot into a named assignment to access artifact fields
posts = input()
  |> add(embedding: [0.1, 0.2, 0.3])  # placeholder
  |> ml.kmeans(k: 2, on: "embedding", out: "cluster")

posts.kmeans    # { model, k } written by ml.kmeans
posts.data      # the rows
posts.errors    # any rows that failed`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
