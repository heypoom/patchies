# 65. Optimize the `asm` object.

I want to optimize the `asm` object and its Rust-based virtual machine.

## Problem

1. Right now the way we re-fetch memory for `asm` object is very inefficient. I think we read the whole memory page and a lot of unnecessary metadata on every read cycle. This is the biggest problem.
2. I think the `asm` object's memory cell and its virtual machine is way too big. I think of asm object more like how TIS-100 and Shenzhen I/O works, where you have smaller VMs that can execute a bit of code, and you just create lots of them when you run into limitations.

## Ideal State

1. The communication overhead from Svelte to WebAssembly should be fairly minimal, we should try to minimize the sheer amount of messages exchanged to reduce memory footprint and data transfer.
2. We should re-think our memory segments (`segments.rs`) and make it more reasonable.

## Resources

- Current memory size is 0xFFFF of u16. See `segments.rs` and `memory.rs` file
