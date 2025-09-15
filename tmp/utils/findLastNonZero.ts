export function findLastNonZeroIndex(list: number[]): number {
  if (list.length === 0) return -1

  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i] !== 0) return i
  }

  return -1
}
