import type { PeppermintPreset } from './types';

const code = `# 04_namespace.pep — user-defined namespaces

ns transforms {
  clean = data -> (
    data
      |> filter(it.age > 18)
      |> filter(it.income > 0)
  )

  label_region = data -> (
    data
      |> add(region_label: match(it.region,
          "US": "United States",
          "EU": "Europe",
          "APAC": "Asia Pacific",
          _: "Other"))
  )
}

input()
  |> transforms.clean()
  |> transforms.label_region()
  |> sort(by: "income", dir: "desc")
  |> print()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
