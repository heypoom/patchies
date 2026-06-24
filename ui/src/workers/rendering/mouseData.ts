export type MouseData = [number, number, number, number, number?];

export const isSameMouseData = (a: MouseData | undefined, b: MouseData): boolean =>
  a !== undefined &&
  a[0] === b[0] &&
  a[1] === b[1] &&
  a[2] === b[2] &&
  a[3] === b[3] &&
  a[4] === b[4];
