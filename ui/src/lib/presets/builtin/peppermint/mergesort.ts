import type { PeppermintPreset } from './types';

const code = `merge = (a, b) ->
  match(len(a) == 0 or len(b) == 0,
    true: match(len(a) == 0, true: b, _: a),
    _:    match(a[0] <= b[0],
      true: concat([a[0]], merge(a[1..len(a)-1], b)),
      _:    concat([b[0]], merge(a, b[1..len(b)-1]))
    )
  )

ms = lst ->
  match(len(lst),
    0: lst,
    1: lst,
    _: (
      mid   = len(lst) / 2
      left  = lst[0..mid-1]
      right = lst[mid..len(lst)-1]
      merge(ms(left), ms(right))
    )
  )

ms([3, 1, 4, 1, 5, 9, 2, 6]) |> send`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
