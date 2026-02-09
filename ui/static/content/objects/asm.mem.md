# asm.mem

External memory buffer for assembly programs.

Use `asm.mem` to store external memory cells. This is helpful when the
4k internal memory space is not enough, or you want to store values that
persist even when the `asm` object is reset, or you want to share memory cells
between multiple `asm` objects.

## Virtual Memory Mapping

Connect `asm.mem` to an `asm` outlet. The `asm` machine can then read and write
to virtual memory addresses starting at `0x1000`:

- Outlet 0 maps to `0x1000` - `0x11FF`
- Outlet 1 maps to `0x1200` - `0x13FF`
- Outlet 2 maps to `0x1400` - `0x15FF`
- Outlet 3 maps to `0x1600` - `0x17FF`

## Reading from External Memory

```asm
; reads 5 values from outlet 0's first memory cell (0x1000)
push 0x1000
read 5

; reads 3 values from outlet 0's 5th memory cell (0x1005)
push 0x1005
read 3
```

## Writing to External Memory

```asm
; writes 1 value (0xCAAC) to outlet 0's first memory cell (0x1000)
push 0xCAAC
push 0x1000
write 1

; writes 2 values (20, 40) to outlet 0's 5th memory cell (0x1005)
push 20
push 40
push 0x1005
write 2
```

## Input Messages

- `bang`: output all memory values to the outlet
- `reset`: clear all memory values
- `{type: 'setRows', value: <number>}`: set the number of rows to display in grid mode
- `number` or `number[]`: append values to memory (when sent from an `asm` machine)
- `{type: 'write', address: <number>, data: <number[]>}`: write values at a specific address
- `{type: 'read', address: <number>, count: <number>}`: read values and send back to the requesting `asm` machine
- `{type: 'override', data: <number[]>}`: replace all memory values

## Output Messages

- `number[]`: all memory values (when `bang` is received)

## Features

- Supports both hex and decimal display formats (toggle with button)
- Supports grid and text batch editing modes
- Values editable directly in the grid
- Configurable number of rows to display
- Memory persists across `asm` resets

## See Also

- [asm](/docs/objects/asm) - Virtual stack machine assembly interpreter
