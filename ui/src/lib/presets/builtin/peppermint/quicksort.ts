import type { PeppermintPreset } from './types';

const code = `qs = lst -> match(len(lst),
  0: lst,
  _: (
    pivot   = lst[0]
    less    = filter(lst, it < pivot)
    equal   = filter(lst, it == pivot)
    greater = filter(lst, it > pivot)
    concat(qs(less), equal, qs(greater))
  )
)

qs([3, 1, 4, 1, 5, 9, 2, 6]) |> print`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
