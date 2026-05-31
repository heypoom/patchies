import type { PeppermintPreset } from './types';

const code = `# 09_strings.pep — string operations with use text

use text

# String functions work best inside a pipe
"hello"   |> text.upper()   |> send()
"WORLD"   |> text.lower()   |> send()
"  hi  "  |> text.trim()    |> send()

# Use inside a data pipe — it.field passes through str functions
input()
  |> add(name_upper: text.upper(it.name))
  |> add(region_short: text.slice(it.region, 0, 2))
  |> select("name")
  |> send()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
