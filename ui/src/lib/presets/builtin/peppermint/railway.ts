import type { PeppermintPreset } from './types';

const code = `# railway.pep — whole-pipe error handling

# Happy track — all steps run
result = input()
  |> filter(it.age > 18)
  |> add(ratio: it.income / it.age)
  |> sort(by: "ratio", dir: "desc")

match(result,
  Ok(data): data |> print(),
  Err(msg):  print(msg)
)`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
