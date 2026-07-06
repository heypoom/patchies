export { AssemblySystem, getAssemblySystem } from '$objects/asm/AssemblySystem';
export { default as AssemblyMachine } from '$objects/asm/AssemblyMachine.svelte';
export { default as AssemblyEditor } from '$objects/asm/AssemblyEditor.svelte';
export { default as MachineStateViewer } from '$objects/asm/MachineStateViewer.svelte';
export { default as MemoryViewer } from '$objects/asm/MemoryViewer.svelte';
export { default as PaginatedMemoryViewer } from '$objects/asm/PaginatedMemoryViewer.svelte';
export type {
  InspectedMachine,
  InspectedRegister,
  Effect,
  Message
} from '$objects/asm/AssemblySystem';
