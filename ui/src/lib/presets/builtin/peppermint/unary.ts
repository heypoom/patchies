import type { PeppermintPreset } from './types';

const code = `# 10_unary.pep — unary minus and arithmetic

x = -42
y = -3.14
z = -(10 + 5)

send(x)
send(y)
send(z)

# Unary minus in expressions
[{ v: 1 }, { v: -2 }, { v: 3 }]
  |> filter(it.v > -1)
  |> add(neg: -it.v)
  |> send()

# use math
use math

math.log(2)   |> send()
math.sqrt(16) |> send()
math.mean([1, 2, 3, 4, 5]) |> send()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
