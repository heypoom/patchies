export function rescale(input: number[], targetMax = 255) {
  const min = Math.min(...input)
  const max = Math.max(...input)

  const factor = max > min ? targetMax / (max - min) : 1

  return input.map((x) => Math.round((x - min) * factor))
}
