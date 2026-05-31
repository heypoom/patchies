import type { PeppermintPreset } from './types';

const code = `# interpolation.pep — string interpolation with {expr}

name = "alice"
age = 30

# Basic variable interpolation
send("{name} is {age} years old")

# Expression inside interpolation
send("in 10 years: {age + 10}")

# In a data pipe — it.field access
input()
  |> add(label: "{it.name} ({it.region})")
  |> add(summary: "age {it.age}, income {it.income}")
  |> select("label", "summary")
  |> send()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
