Use `asm.mem` to store external memory cells.

This is helpful when:

- The 4KB internal memory space is not enough
- You want to store values that persist even when the
  `asm` object is reset
- You want to share memory cells between multiple `asm` objects

See the virtual memory docs on the [asm object](/docs/objects/asm)
for how to read and write to external memory.

## Features

- Supports both hex and decimal display formats (toggle with button)
- Supports grid and text batch editing modes
- Values editable directly in the grid
- Configurable number of rows to display
- Memory persists across `asm` resets

## Virtual Memory Mapping

The [asm machine](/docs/objects/asm) can read and
write to virtual memory addresses starting at `0x1000`:

- Outlet 0 = `0x1000` to `0x11FF`
- Outlet 1 = `0x1200` to `0x13FF`
- Outlet 2 = `0x1400` to `0x15FF`
- Outlet 3 = `0x1600` to `0x17FF`

Each outlet has **512 addressable cells** (0x200). Each cell
holds a 16-bit value (0-65535). You can have up to 16 outlets
in a machine, configurable in settings.

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

## See Also

- [asm](/docs/objects/asm) - Virtual stack machine assembly interpreter
