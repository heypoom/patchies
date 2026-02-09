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

#### Memory Layout (8KB total, 4096 u16 cells)

| Segment | Address Range | Size | Description |
|---------|---------------|------|-------------|
| Code | 0x000-0x1FF | 512 | Program instructions (~250 max) |
| Data | 0x200-0x2FF | 256 | `.string` and `.value` constants |
| Call Stack | 0x300-0x33F | 64 | Return addresses (~32 call depth) |
| RAM | 0x340-0xFFF | 3008 | Data stack + user memory |
| External | 0x1000+ | virtual | Routed to `asm.mem` objects |

**Important**: Use high addresses (e.g., 0xF00+) for `load`/`store` to avoid colliding with the data stack which grows up from 0x340.

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

## Examples

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

Running sum - adds each input to a total stored at address 100.

```asm
loop:
receive
load 100
add
dup
store 100
send 0 1
jump loop
```

### Counter

Outputs incrementing values (0, 1, 2, ...) on each input. Count stored at address 0.

```asm
loop:
load 0
dup
send 0 1
inc
store 0
receive
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

Calculates running average. Sum at address 100, count at 101.

```asm
loop:
receive
load 100
add
store 100
load 101
push 1
add
store 101
load 100
load 101
div
send 0 1
jump loop
```

### Fibonacci

Outputs fibonacci sequence on each input. Previous value at 100, current at 101.

```asm
push 0
store 100
push 1
store 101

loop:
load 101
dup
send 0 1
load 100
add
load 101
store 100
store 101
receive
jump loop
```

### Delta

Outputs difference from previous input. Previous value at address 100.

```asm
loop:
receive
dup
load 100
sub
send 0 1
store 100
jump loop
```

### Modulo Counter

Counts 0 to 9, then wraps around.

```asm
loop:
load 0
dup
send 0 1
inc
push 10
mod
store 0
receive
jump loop
```

### Loop (10 to 50)

A simple loop from 10 to 50, demonstrating control flow.

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

Equivalent C code:

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
