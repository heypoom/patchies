import type { PeppermintPreset } from './types';

const code = `use text
use math

W = 8

at = (grid, x, y) -> match(
    x, < 0: 0, >= W: 0,
    _: match(y, < 0: 0, >= W: 0, _: grid[y * W + x])
)

neighbors = (grid, x, y) ->
  at(grid, x-1, y-1) + at(grid, x, y-1) + at(grid, x+1, y-1) +
  at(grid, x-1, y)                      + at(grid, x+1, y)   +
  at(grid, x-1, y+1) + at(grid, x, y+1) + at(grid, x+1, y+1)

next_cell = (grid, x, y) -> (
  cell = grid[y * W + x]
  n    = neighbors(grid, x, y)
  match(cell,
    1: match(n, 2: 1, 3: 1, _: 0),
    _: match(n, 3: 1, _: 0)
  )
)

next_gen = grid -> mapi(grid,next_cell(grid, it.idx % W, math.floor(it.idx / W)))

render = grid -> (
  row  = i -> match(i % W, 0: "\n", _: "")
  cell = i -> match(grid[i], 1: "#", _: ".")
  text.join(mapi(grid, text.join([row(it.idx), cell(it.idx)], "")), "")
)

run = (grid, n) -> match(n, 0: grid, _: run(next_gen(grid), n - 1))

glider = [
  0, 1, 0, 0, 0, 0, 0, 0,
  0, 0, 1, 0, 0, 0, 0, 0,
  1, 1, 1, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0
]

step = x -> (
  run(glider, x) |> render |> print
  match(x, < 20: step(x + 1), _: none)
)

step(0)`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
