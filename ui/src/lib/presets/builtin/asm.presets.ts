/**
 * Assembly Examples - preset programs for the asm virtual machine
 */

const ECHO_ASM = `; Echo - receives input and sends it back
loop:
receive
send 0 1
jump loop`;

const ACCUMULATOR_ASM = `; Accumulator - running sum stored at address 100
loop:
receive
load 100
add
dup
store 100
send 0 1
jump loop`;

const DOUBLE_ASM = `; Double - multiplies input by 2
loop:
receive
push 2
mul
send 0 1
jump loop`;

const THRESHOLD_GATE_ASM = `; Threshold Gate - only outputs if value > 50
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
jump loop`;

const RUNNING_AVERAGE_ASM = `; Running Average - sum at 100, count at 101
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
jump loop`;

const FIBONACCI_ASM = `; Fibonacci - outputs fibonacci sequence
; prev at 100, curr at 101
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
jump loop`;

const CLAMP_ASM = `; Clamp - clamps input to range 0-100
loop:
receive
dup
push 0
less_than
jump_not_zero set_min
dup
push 100
greater_than
jump_not_zero set_max
jump output
set_min:
pop
push 0
jump output
set_max:
pop
push 100
output:
send 0 1
jump loop`;

const MODULO_COUNTER_ASM = `; Modulo Counter - counts 0 to 9, wraps around
; Count stored at address 0
loop:
load 0
dup
send 0 1
inc
push 10
mod
store 0
receive
jump loop`;

const DELTA_ASM = `; Delta - outputs difference from previous input
; Previous value at address 100
loop:
receive
dup
load 100
sub
send 0 1
store 100
jump loop`;

export const ASM_PRESETS: Record<string, { type: string; data: { code: string } }> = {
  'echo.asm': {
    type: 'asm',
    data: { code: ECHO_ASM.trim() }
  },
  'accumulator.asm': {
    type: 'asm',
    data: { code: ACCUMULATOR_ASM.trim() }
  },
  'double.asm': {
    type: 'asm',
    data: { code: DOUBLE_ASM.trim() }
  },
  'threshold-gate.asm': {
    type: 'asm',
    data: { code: THRESHOLD_GATE_ASM.trim() }
  },
  'running-average.asm': {
    type: 'asm',
    data: { code: RUNNING_AVERAGE_ASM.trim() }
  },
  'fibonacci.asm': {
    type: 'asm',
    data: { code: FIBONACCI_ASM.trim() }
  },
  'clamp.asm': {
    type: 'asm',
    data: { code: CLAMP_ASM.trim() }
  },
  'modulo-counter.asm': {
    type: 'asm',
    data: { code: MODULO_COUNTER_ASM.trim() }
  },
  'delta.asm': {
    type: 'asm',
    data: { code: DELTA_ASM.trim() }
  }
};
