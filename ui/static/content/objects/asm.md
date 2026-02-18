Heavily inspired by Zachtronics games e.g. [TIS-100](https://en.wikipedia.org/wiki/TIS-100)
and [Shenzhen I/O](https://en.wikipedia.org/wiki/Shenzhen_I/O), where you write
small assembly programs to interact with hardware and devices.

![Patchies virtual stack machine assembly](/content/images/patchies-vasm.png)

Each `asm` object is its own virtual stack machine, where you can write small programs
using Patchies' own flavor of stack machine assembly. You can use the `send` and
`receive` instructions to receive data from other objects and machines.

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

#### Memory Layout (8KB total, 4096 u16 cells)

| Segment | Address Range | Size | Description |
|---------|---------------|------|-------------|
| Code | 0x000-0x1FF | 512 | Program instructions (~250 max) |
| Data | 0x200-0x2FF | 256 | `.string` and `.value` constants |
| Call Stack | 0x300-0x33F | 64 | Return addresses (~32 call depth) |
| RAM | 0x340-0xFFF | 3264 | Data stack + user memory |
| External | 0x1000-0xFFFF | 61440 | Virtual external memory |

**Important**: Use high addresses (e.g., 0xF00+) for `load`/`store` to avoid colliding with the data stack which grows up from 0x340.

### Virtual Memory (0x1000 - 0xFFFF)

You can read and write to virtual memory addresses starting at `0x1000`:

- Outlet 0 = `0x1000` to `0x11FF`
- Outlet 1 = `0x1200` to `0x13FF`
- Outlet 2 = `0x1400` to `0x15FF`
- Outlet 3 = `0x1600` to `0x17FF`

Each outlet has **512 addressable cells** (0x200). Each cell
holds a 16-bit value (0-65535). You can have up to 16 outlets
in a machine, configurable in settings.

- See the [asm.mem](/docs/objects/asm.mem) external memory object for
  extending the memory space or sharing it across machines.
- You can listen to `write` messages and build your own objects
  that the assembly machine can write to!

### OTHER

- `print` pops the string until the null terminator and prints it to the console
- `call <label-name>` calls the function via the label
- `return` returns to the caller function, usually used in a function body
- `halt` stops the program until reset

## Clocking

### AUTOMATIC CLOCK

Use the play and pause buttons (or its messages) to start and stop automatic clocking.

The delay between instructions can be adjusted via `Delay (ms)` in the settings menu, or send a `setDelayMs` message.

### MANUAL CLOCK

Send a `bang` message to step the program by one instruction. This is
slower than automatic clocking, but useful for debugging.

### INSTRUCTIONS PER CYCLE

Default is 1 instruction. You can set it to higher number of instructions
per cycle (e.g. 20) to speed up the program significantly.

Set this in the settings menu via the `Instructions per Step` option,
or send a `setStepBy` message.

## Shortcuts

`Shift + Enter` in the code editor runs the program
in automatic clocking mode.

## Memory Visualizer

- Highlights the current line of instruction being executed
- Visualize memory cells in real-time with color-coding
- Drag your mouse over the memory cells to make a memory region
- Then, press `Alt` on your keyboard, and drag the memory region onto the canvas
- This will create the memory visualizer object (`asm.value`)
  that shows the memory cells in real-time
- Click on the settings menu to change the memory region and color scheme

## Examples

### Loop (10 to 50)

A simple loop from 10 to 50.

```asm
push 10

loop:
dup
send 0 1
inc
dup
push 50
less_than
jump_not_zero loop

halt
```

### Modulo Counter

Counts 0 to 9, then wraps around.

```asm
loop:
load 0xF00
dup
send 0 1
inc
push 10
mod
store 0xF00
jump loop
```

### Fibonacci

Outputs the fibonacci sequence. Previous value at 0xF00, current at 0xF01.

```asm
push 0
store 0xF00
push 1
store 0xF01

loop:
load 0xF01
dup
send 0 1
load 0xF00
add
load 0xF01
store 0xF00
store 0xF01
jump loop
```

### Echo

Receives input and sends it back. The simplest reactive program.

```asm
loop:
receive
send 0 1
jump loop
```

### Double

Multiplies input by 2.

```asm
loop:
receive
push 2
mul
send 0 1
jump loop
```

### Accumulator

Running sum - adds each input to a total stored at address 0xF00.

```asm
loop:
receive
load 0xF00
add
dup
store 0xF00
send 0 1
jump loop
```

### Threshold Gate

Only outputs values greater than 50.

```asm
loop:
receive
dup
push 50
greater_than
jump_zero skip
send 0 1
jump next
skip:
pop
next:
jump loop
```

### Running Average

Calculates running average. Sum at address 0xF00, count at 0xF01.

```asm
loop:
receive
load 0xF00
add
store 0xF00
load 0xF01
push 1
add
store 0xF01
load 0xF00
load 0xF01
div
send 0 1
jump loop
```

### Delta

Outputs difference from previous input. Previous value at address 0xF00.

```asm
loop:
receive
dup
load 0xF00
sub
send 0 1
store 0xF00
jump loop
```

## See Also

- [asm.mem](/docs/objects/asm.mem) - External memory buffer for assembly programs
- [uxn](/docs/objects/uxn) - Uxn virtual machine
- [expr](/docs/objects/expr) - Expression evaluator
