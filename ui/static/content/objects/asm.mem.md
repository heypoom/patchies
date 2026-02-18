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

## See Also

- [asm](/docs/objects/asm) - Virtual stack machine assembly interpreter
