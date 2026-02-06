export interface WGSLBinding {
  group: number;
  binding: number;
  name: string;
  accessMode: 'read' | 'read_write';
  type: string; // 'array<f32>', 'array<vec4f>', etc.
  elementType: string; // 'f32', 'vec4f', 'u32', etc.
  arrayConstructor: TypedArrayConstructor;
  componentsPerElement: number; // vec4 = 4, scalar = 1
}

export interface WGSLParseResult {
  bindings: WGSLBinding[];
  inputs: WGSLBinding[]; // accessMode === 'read'
  outputs: WGSLBinding[]; // accessMode === 'read_write'
  workgroupSize: [number, number, number] | null;
}

export type TypedArrayConstructor =
  | Float32ArrayConstructor
  | Uint32ArrayConstructor
  | Int32ArrayConstructor;

// Main -> Worker messages
export type ToWorker =
  | { type: 'init' }
  | { type: 'compile'; nodeId: string; code: string }
  | { type: 'setBuffer'; nodeId: string; binding: number; data: ArrayBuffer }
  | { type: 'dispatch'; nodeId: string; dispatchCount?: [number, number, number] }
  | { type: 'destroy'; nodeId: string };

// Worker -> Main messages
export type FromWorker =
  | { type: 'ready'; supported: boolean }
  | { type: 'compiled'; nodeId: string; error?: string }
  | { type: 'result'; nodeId: string; outputs: Record<number, ArrayBuffer> }
  | { type: 'error'; nodeId: string; message: string };

export interface CompileResult {
  error?: string;
}

export interface DispatchResult {
  outputs?: Record<number, ArrayBuffer>;
  error?: string;
}
