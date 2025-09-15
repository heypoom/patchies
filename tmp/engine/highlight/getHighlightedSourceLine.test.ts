import { expect, test } from "vitest"

import { getSourceHighlightMap } from "./getHighlightedSourceLine"

test("should be able to get highlighted source line", () => {
  const S1 = `
    push 5
    push 10
    push 15
    push 1024
  `

  const M1 = getSourceHighlightMap(S1)
  expect(M1.get(8)).toBe(4)

  const S2 = `
    .string hello_world "Hello, world!"
    .string foo "foo bar"

    load_string hello_world
    print

    .string sunshine "Sunshine!"

    load_string sunshine
    print

    .value bar 0xDEAD
    .value baz 0xAAAA

    push bar
    push baz
  `

  const M2 = getSourceHighlightMap(S2)
  expect(M2.get(8)).toBe(15)

  const S3 = `
    push 5
    push 10
    push 15
    push 1024
  `.trim()

  const M3 = getSourceHighlightMap(S3)
  expect(M3.get(2)).toBe(0)
  expect(M3.get(4)).toBe(1)
  expect(M3.get(8)).toBe(3)

  const S4 = `
    jump start

    add_pattern:
      push 0xAA        ; 170
      push 0b11001100  ; 204
      push 01024       ; 1024
      return

    start:
          call add_pattern
          call add_pattern
  `.trim()

  const M4 = getSourceHighlightMap(S4)
  expect(M4.get(2)).toBe(0)
  expect(M4.get(6)).toBe(4)
  expect(M4.get(9)).toBe(6)
  expect(M4.get(13)).toBe(10)
})
