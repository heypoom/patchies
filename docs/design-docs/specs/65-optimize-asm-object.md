# 65. Optimize the `asm` object.

I want to optimize the `asm` object and its Rust-based virtual machine.

## Problem

1. Right now the way we re-fetch memory for `asm` object is very inefficient. I think we read the whole memory page and a lot of unnecessary metadata on every read cycle. This is the biggest problem.
2. I think the `asm` object's memory cell and its virtual machine is way too big. I think of asm object more like how TIS-100 and Shenzhen I/O works, where you have smaller VMs that can execute a bit of code, and you just create lots of them when you run into limitations.

## Ideal State

1. The communication overhead from Svelte to WebAssembly should be fairly minimal, we should try to minimize the sheer amount of messages exchanged to reduce memory footprint and data transfer.
2. We should re-think our memory segments (`segments.rs`) and make it more reasonable.

## Notes

- Current memory size is 0xFFFF of u16. See `segments.rs` and `memory.rs` file

- Read cycles can be as often as the user wants it. check out @ui/static/content/objects/asm.md#136-148 on clocking - there are `delay` parameter for automatic clocking, and `stepBy` for how many instruction steps per second. in theory, the user could be doing "step by 1 and only have 4ms delay between it" which would be horrendously inefficient if we transfer 128KB of data every couple milliseconds

- Target VM size - let's make it smaller but please don't make it too small, otherwise I couldn't do fun stuff like "bad apple" where I might want to store the video frame in temporary memory / stack. In bad apple demos, you typically want to be able to decode video frames (black/white) and emit it.

- Communication - use whatever is MOST efficient, honestly. I think let's not use SharedArrayBuffer yet as I guess it needs an origin trial and not sure about browser compat, although I would love to explore it in the next iteration!

- Segments - I think segments is good, just that the ratio and size of the segments seems off. By ratio I mean the ratio of main stack memory (what user will use 90% of the time honestly), function call stack, temporary memory, virtual address.
