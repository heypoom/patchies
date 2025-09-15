/**
 * Generates a list with range from start to end.
 *
 * @param start
 * @param end
 */
export const range = (start: number, end: number) =>
  Array(end - start + 1)
    .fill(0)
    .map((_, i) => i + start)
