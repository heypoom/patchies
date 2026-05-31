import type { PeppermintPreset } from './types';

const code = `use text

# find matching ] for [ at position ip (scan forward)
find_close = (prog, ip, depth) -> match(depth,
  0: ip,
  _: match(str.at(prog, ip),
    "[": find_close(prog, ip + 1, depth + 1),
    "]": find_close(prog, ip + 1, depth - 1),
    _:   find_close(prog, ip + 1, depth)
  )
)

# find matching [ for ] at position ip (scan backward)
find_open = (prog, ip, depth) -> match(depth,
  0: ip,
  _: match(str.at(prog, ip),
    "]": find_open(prog, ip - 1, depth + 1),
    "[": find_open(prog, ip - 1, depth - 1),
    _:   find_open(prog, ip - 1, depth)
  )
)

# one brainfuck step
step = state -> (
  tape = state.tape
  ptr  = state.ptr
  ip   = state.ip
  prog = state.prog
  out  = state.output
  cell = tape[ptr]
  match(str.at(prog, ip),
    "+": {tape: set(tape, ptr, cell + 1), ptr: ptr, ip: ip + 1, prog: prog, output: out},
    "-": {tape: set(tape, ptr, cell - 1), ptr: ptr, ip: ip + 1, prog: prog, output: out},
    ">": {tape: tape, ptr: ptr + 1, ip: ip + 1, prog: prog, output: out},
    "<": {tape: tape, ptr: ptr - 1, ip: ip + 1, prog: prog, output: out},
    ".": {tape: tape, ptr: ptr, ip: ip + 1, prog: prog, output: text.join([out, text.char(cell)], "")},
    "[": {tape: tape, ptr: ptr, ip: match(cell, 0: find_close(prog, ip + 1, 1), _: ip + 1), prog: prog, output: out},
    "]": {tape: tape, ptr: ptr, ip: match(cell, 0: ip + 1, _: find_open(prog, ip - 1, 1)),  prog: prog, output: out},
    _:   {tape: tape, ptr: ptr, ip: ip + 1, prog: prog, output: out}
  )
)

# run until ip reaches end of program
run = (state, len) -> match(state.ip,
  == len: state,
  _: run(step(state), len)
)

# prints "Hi" (72=H, 105=i)
prog = "++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++.+++++++++++++++++++++++++++++++++."
init = {tape: [0, 0], ptr: 0, ip: 0, prog: prog, output: ""}
result = run(init, text.length(prog))
print(result.output)`;

export const preset: PeppermintPreset = {
  type: 'peppermint',
  data: { code: code.trim(), showConsole: true }
};
