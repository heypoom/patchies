import type { PeppermintPreset } from './types';

const code = `# errors.pep — what different errors look like

people = [
  { name: "alice", age: 30 },
  { name: "bob",   age: 17 }
]

# 1. Row-level error — field missing on some rows
#    alice has no 'score', so that row goes to .errors
result = people |> add(label: it.score * 2)
print(result.errors)    # [{ name: "alice", ..., _error: "...", _step: "add(label)" }]

# 2. Undefined variable — whole pipe fails
# result = missing_data |> filter(it.age > 18)

# 3. Wrong number of args
# double = x -> x * 2
# double(1, 2)

# 4. Parse error — uncomment to see
# x = foo(bar`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
