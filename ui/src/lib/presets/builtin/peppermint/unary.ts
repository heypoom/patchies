import type { PeppermintPreset } from './types';

const code = `# 10_unary.pep — unary minus and arithmetic

x = -42
y = -3.14
z = -(10 + 5)

print(x)
print(y)
print(z)

# Unary minus in expressions
[{ v: 1 }, { v: -2 }, { v: 3 }]
  |> filter(it.v > -1)
  |> add(neg: -it.v)
  |> print()

# use math
use math

math.log(2)   |> print()
math.sqrt(16) |> print()
math.mean([1, 2, 3, 4, 5]) |> print()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
