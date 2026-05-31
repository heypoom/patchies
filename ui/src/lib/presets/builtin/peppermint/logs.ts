import type { PeppermintPreset } from './types';

const code = `# 06_logs.pep — log analysis: filter errors, classify latency

input()
  |> filter(it.status != 200)
  |> add(severity: match(it.latency_ms, > 500: "critical", > 200: "slow", _: "normal"))
  |> sort(by: "latency_ms", dir: "desc")
  |> print()`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
