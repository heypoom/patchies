# asm

Virtual stack machine assembly interpreter.

Inspired by Zachtronics games like [TIS-100](https://en.wikipedia.org/wiki/TIS-100)
and [Shenzhen I/O](https://en.wikipedia.org/wiki/Shenzhen_I/O), where you write
small assembly programs to interact with the world.

![Patchies virtual stack machine assembly](/content/images/patchies-vasm.png)

## Instructions

Stack effects are shown as `( before -- after )` where the rightmost value is the top of the stack.

### STACK OPERATIONS

| Instruction | Stack Effect | Description |
|-------------|--------------|-------------|
| `noop` | `( -- )` | No operation |
| `push <n>` | `( -- n )` | Push value onto stack |
| `pop` | `( a -- )` | Remove top value |
| `dup` | `( a -- a a )` | Duplicate top value |
| `swap` | `( a b -- b a )` | Swap top two values |
| `over` | `( a b -- a b a )` | Copy second value to top |
| `rotate` | `( a b c -- b c a )` | Rotate top three values |
| `nip` | `( a b -- b )` | Remove second value |
| `tuck` | `( a b -- b a b )` | Copy top value below second |
| `pick <n>` | `( -- v )` | Copy nth value to top (0=dup, 1=over) |

### ARITHMETIC

| Instruction | Stack Effect | Description |
|-------------|--------------|-------------|
| `add` | `( a b -- a+b )` | Addition |
| `sub` | `( a b -- a-b )` | Subtraction |
| `mul` | `( a b -- a*b )` | Multiplication |
| `div` | `( a b -- a/b )` | Integer division |
| `mod` | `( a b -- a%b )` | Modulo |
| `inc` | `( a -- a+1 )` | Increment by 1 |
| `dec` | `( a -- a-1 )` | Decrement by 1 (min 0) |

### COMPARISON

| Instruction | Stack Effect | Description |
|-------------|--------------|-------------|
| `equal` | `( a b -- flag )` | 1 if a == b, else 0 |
| `not_equal` | `( a b -- flag )` | 1 if a != b, else 0 |
| `less_than` | `( a b -- flag )` | 1 if a < b, else 0 |
| `less_than_or_equal` | `( a b -- flag )` | 1 if a <= b, else 0 |
| `greater_than` | `( a b -- flag )` | 1 if a > b, else 0 |
| `greater_than_or_equal` | `( a b -- flag )` | 1 if a >= b, else 0 |

### BITWISE

| Instruction | Stack Effect | Description |
|-------------|--------------|-------------|
| `and` | `( a b -- a&b )` | Bitwise AND |
| `or` | `( a b -- a\|b )` | Bitwise OR |
| `xor` | `( a b -- a^b )` | Bitwise XOR |
| `not` | `( a -- ~a )` | Bitwise NOT |
| `left_shift` | `( a b -- a<<b )` | Left shift a by b bits |
| `right_shift` | `( a b -- a>>b )` | Right shift a by b bits |

### CONTROL FLOW

| Instruction | Stack Effect | Description |
|-------------|--------------|-------------|
| `jump <addr>` | `( -- )` | Unconditional jump to address/label |
| `jump_zero <addr>` | `( a -- )` | Jump if top value is 0 |
| `jump_not_zero <addr>` | `( a -- )` | Jump if top value is not 0 |
| `call <addr>` | `( -- )` | Push PC to call stack and jump |
| `return` | `( -- )` | Pop call stack and jump back |
| `halt` | `( -- )` | Stop program execution |

### MEMORY

| Instruction | Stack Effect | Description |
|-------------|--------------|-------------|
| `load <addr>` | `( -- v )` | Push value at address onto stack |
| `store <addr>` | `( v -- )` | Pop value and store at address |
| `read <n>` | `( addr -- v1..vn )` | Pop address, push n values from memory |
| `write <n>` | `( v1..vn addr -- )` | Pop address, write n values to memory |
| `load_string <addr>` | `( -- bytes.. )` | Push null-terminated string bytes |

### I/O

| Instruction | Stack Effect | Description |
|-------------|--------------|-------------|
| `send <port> <n>` | `( v1..vn -- )` | Send n values to outlet port (0-3) |
| `receive` | `( -- v )` | Wait for input, push received value |
| `print` | `( bytes.. -- )` | Pop string bytes until null, print to console |

### TIMING

| Instruction | Stack Effect | Description |
|-------------|--------------|-------------|
| `sleep_tick <n>` | `( -- )` | Pause for n clock ticks |
| `sleep_ms <n>` | `( -- )` | Pause for n milliseconds |

## Syntax

### LABELS AND JUMPS

- Define label with `<label-name>:` and jump to it with `jump <label-name>`

### STRINGS AND CONSTANTS

- Define strings with `.string key "value"` and load it with `load_string key`
- Define const values with `.value key value` and use it e.g. `push key`

### I/O

- `send <port> <length>` sends top N stack values to the given port (0-3)
- `receive` waits for one input value from the message inlet, and pushes it onto the stack

### TIMING

- `sleep_tick <ticks>` sleeps for N clock ticks
- `sleep_ms <ms>` sleeps for N milliseconds

### MEMORY

- `write <length>` pops the memory address from the stack and write N values to the address
- `read <length>` pops the memory address from the stack and read N values from the address onto the stack
- `load <address>` pushes the value at the memory address onto the stack
- `store <address>` pops the value from the stack and store it at the memory address
- Memory space: 65,535 cells of unsigned 16-bit integer

### OTHER

- `print` pops the string until the null terminator and prints it to the console
- `call <label-name>` calls the function via the label
- `return` returns to the caller function, usually used in a function body
- `halt` stops the program until reset

## Clocking

### AUTOMATIC CLOCK

Use the play and pause buttons (or its messages) to start and stop automatic clocking. The clock speed can be adjusted via `Delay (ms)` in the settings menu, or send a `setDelayMs` message.

### MANUAL CLOCK

Send a `bang` message to step the program by one instruction. This is slower than automatic clocking, but useful for debugging.

### INSTRUCTIONS PER CYCLE

Default is 1 instruction. You can set it to higher number of instructions per cycle (e.g. 20) to speed up the program significantly. Set this in the settings menu via the `Step By` option, or send a `setStepBy` message.

## Memory Visualizer

- Highlights the current line of instruction being executed
- Visualize memory cells in real-time with color-coding
- Drag your mouse over the memory cells to make a memory region
- Then, press `Alt` on your keyboard, and drag the memory region onto the canvas
- This will create the memory visualizer object (`asm.value`) that shows the memory cells in real-time
- Click on the settings menu to change the memory region and color scheme

## Output Messages

- `number` or `number[]` when the `send` instruction is executed
  - `send 0 1` will send one number to outlet 0
  - `send 1 3` will send array of three numbers to outlet 1
- `{type: 'read', address: number, count: number}` when `read` instruction is ran onto a mapped address (e.g. `0x2000`) - used for `asm.mem`
- `{type: 'write', address: number, data: number[]}` when `write` instruction is ran onto a mapped address (e.g. `0x2000`) - used for `asm.mem`
- `{type: 'override', data: number[]}` when override operation is triggered

## Input Messages

- `bang`: step the program by one instruction
- `{type: 'setCode', value: <string>}`: load the assembly code
- `run`: reload the program and step N times
- `play`: start automatic clocking
- `pause`: pause automatic clocking
- `toggle`: toggle automatic clocking
- `reset`: reset the program
- `step`: step the program by one instruction
- `{type: 'setDelayMs', value: <number>}`: set the delay between automatic clock ticks in milliseconds
- `{type: 'setStepBy', value: <number>}`: set the number of instructions to step by on each (manual and auto) tick
- `number` or `array of number`: send the number(s) to the program - use the `receive` instruction to tell the machine to wait for one input

## Shortcuts

- `Shift + Enter` in the code editor auto-runs the program

## Example: Loop

This is a loop from 10 to 50.

```asm
push 10

l:
push 1
add
dup
push 50
less_than
jump_zero end
jump l

end:
push 0xDDDD
```

This would be roughly equivalent to:

```c
int main() {
    int i = 10;
    while (i < 50) {
        i++;
    }
    return 0xDDDD;
}
```

Try the [example assembly patch](/?id=6pyirxuw3cqvwhg).

## See Also

- [asm.mem](/docs/objects/asm.mem) - External memory buffer for assembly programs
- [uxn](/docs/objects/uxn) - Uxn virtual machine
- [expr](/docs/objects/expr) - Expression evaluator
