# 65. Optimize the `asm` object.

I want to optimize the `asm` object and its Rust-based virtual machine.

## Problem

1. Right now the way we re-fetch memory for `asm` object is very inefficient. I think we read the whole memory page and a lot of unnecessary metadata on every read cycle. This is the biggest problem.
2. I think the `asm` object's memory cell and its virtual machine is way too big. I think of asm object more like how TIS-100 and Shenzhen I/O works, where you have smaller VMs that can execute a bit of code, and you just create lots of them when you run into limitations.

## Analysis

### Current Memory Layout (128KB total)

| Segment | Range | Size (u16) | Size (bytes) |
|---------|-------|------------|--------------|
| CODE | 0x0000-0x0FFF | 4096 | 8KB |
| DATA | 0x1000-0x1FFF | 4096 | 8KB |
| MAPPED | 0x2000-0x3FFF | 8192 | 16KB |
| CALL_STACK | 0x4000-0x40FF | 256 | 512B |
| STACK | 0x4100-0xFFFE | ~48K | **~96KB** |

The stack segment alone is 96KB - way oversized for a "small VM" philosophy.

### Current Communication Overhead

Each cycle, `syncMachineState()` in `AssemblyMachine.svelte` makes **4 separate wasm↔JS round trips**:

1. `inspectMachine()` - registers, status
2. `consumeMachineEffects()` - effects array
3. `consumeMessages()` - messages array
4. `memoryActions.refreshMemory()` - memory page (64 u16 default)

Each call has serde serialization overhead through wasm-bindgen.

Additionally, `AssemblyValueViewer` polls independently every 200ms, even when not visible.

## Solution

### 1. New Memory Layout (8KB total)

Reduce from 65535 to **4096 u16** (8KB) - a 16x reduction.

| Segment | Range | Size (u16) | Notes |
|---------|-------|------------|-------|
| CODE | 0x000-0x1FF | 512 | ~250 instructions |
| DATA | 0x200-0x2FF | 256 | .string, .value constants |
| CALL_STACK | 0x300-0x33F | 64 | ~32 call depth (hard limit) |
| RAM | 0x340-0xFFF | 3264 | Stack + user memory (shared) |

**Philosophy: "Memory is just memory"** (Forth-style)

- Data stack (push/pop) grows UP from 0x340
- User data (load/store) should use HIGH addresses (e.g., 0xF00+)
- User is responsible for not overflowing stack into their data
- Call stack has a hard limit - errors on overflow rather than corrupting memory

**Bad Apple support**: 32×24 = 768 pixels. At 1 bit/pixel packed into u16 = 48 u16 per frame. RAM of 3264 can hold ~68 frames or use 768 for frame buffer + 2496 for working memory.

### 2. Communication Optimization

**Option A: Batched Snapshot** - Combine all reads into a single wasm call.

```rust
pub struct MachineSnapshot {
    pub registers: InspectedRegister,
    pub status: MachineStatus,
    pub effects: Vec<Event>,
    pub messages: Vec<Message>,
    pub memory_page: Option<Vec<u16>>,  // Only if requested
}

pub fn get_machine_snapshot(id: u16, memory_request: Option<MemoryRequest>) -> MachineSnapshot
```

This reduces 4 round trips to 1.

**Option C: Conditional Polling** - Don't fetch memory unless viewer is open.

- Only call memory refresh if `data.showMemoryViewer` is true
- `AssemblyValueViewer` should not poll when not visible/selected

### 3. Implementation Order

1. **New segment layout** ← biggest win (16x memory reduction)
2. **Conditional polling** ← easy frontend change
3. **Batched snapshot** ← moderate effort, reduces round trips

### 4. Deferred: Dirty Tracking (Option B)

Track which memory addresses changed since last read, only return changed cells. This adds complexity (dirty bits per cell/page) and is likely unnecessary after implementing the above optimizations. Revisit only if profiling shows communication is still a bottleneck.

## Files to Modify

### Rust (vasm module)

- `modules/vasm/src/mem/segments.rs` - New segment constants
- `modules/vasm/src/mem/memory.rs` - Update MEMORY_SIZE, adjust buffer allocation
- `modules/vasm/src/controller.rs` - Add `get_machine_snapshot()` function

### TypeScript/Svelte

- `ui/src/lib/assembly/AssemblyMachine.svelte` - Use batched snapshot, conditional memory polling
- `ui/src/lib/assembly/AssemblySystem.ts` - Add snapshot API wrapper
- `ui/src/lib/components/nodes/AssemblyValueViewer.svelte` - Don't poll when not visible
- `ui/src/lib/assembly/memoryStore.ts` - Update DEFAULT_PAGE_OFFSET for new layout
- `ui/static/content/objects/asm.md` - Update documentation (memory space: 4096 cells)

## Migration Notes

- Existing patches with asm code using addresses > 0xFFF will break
- Consider adding a console warning for out-of-range addresses during transition
- The MAPPED segment (0x2000-0x3FFF) is removed - if `asm.mem` relies on this, it needs updating
