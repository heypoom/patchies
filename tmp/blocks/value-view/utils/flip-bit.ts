export function flipBit(n: number, bit: number): number {
  const total = Math.floor(Math.log2(n)) + 1

  if (bit < 0) return n

  if (bit >= total) {
    return n | (1 << (bit + 1))
  }

  return n ^ (1 << (total - 1 - bit))
}
