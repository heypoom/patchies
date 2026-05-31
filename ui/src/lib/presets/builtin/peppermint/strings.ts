import type { PeppermintPreset } from './types';

const code = `# 09_strings.pep — string operations with use text

use text

# String functions work best inside a pipe
"hello"   |> text.upper()   |> print()
"WORLD"   |> text.lower()   |> print()
"  hi  "  |> text.trim()    |> print()

# Use inside a data pipe — it.field passes through str functions
input()
  |> add(name_upper: text.upper(it.name))
  |> add(region_short: text.slice(it.region, 0, 2))
  |> select("name")
  |> print()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
