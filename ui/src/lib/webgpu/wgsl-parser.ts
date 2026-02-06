import { match, P } from 'ts-pattern';
import type {
  WGSLBinding,
  WGSLParseResult,
  WGSLStruct,
  WGSLStructField,
  WGSLUniformBinding
} from './types';

function inferArrayType(elementType: string): {
  constructor: Float32ArrayConstructor | Uint32ArrayConstructor | Int32ArrayConstructor;
  components: number;
} {
  return match(elementType)
    .with(P.union('f32', 'f16'), () => ({
      constructor: Float32Array as Float32ArrayConstructor,
      components: 1
    }))
    .with('u32', () => ({ constructor: Uint32Array as Uint32ArrayConstructor, components: 1 }))
    .with('i32', () => ({ constructor: Int32Array as Int32ArrayConstructor, components: 1 }))
    .with(P.union('vec2f', 'vec2<f32>'), () => ({
      constructor: Float32Array as Float32ArrayConstructor,
      components: 2
    }))
    .with(P.union('vec3f', 'vec3<f32>'), () => ({
      constructor: Float32Array as Float32ArrayConstructor,
      components: 3
    }))
    .with(P.union('vec4f', 'vec4<f32>'), () => ({
      constructor: Float32Array as Float32ArrayConstructor,
      components: 4
    }))
    .with(P.union('vec2u', 'vec2<u32>'), () => ({
      constructor: Uint32Array as Uint32ArrayConstructor,
      components: 2
    }))
    .with(P.union('vec3u', 'vec3<u32>'), () => ({
      constructor: Uint32Array as Uint32ArrayConstructor,
      components: 3
    }))
    .with(P.union('vec4u', 'vec4<u32>'), () => ({
      constructor: Uint32Array as Uint32ArrayConstructor,
      components: 4
    }))
    .otherwise(() => ({ constructor: Float32Array as Float32ArrayConstructor, components: 1 }));
}

/** Get WGSL type size and alignment in bytes */
function getTypeLayout(type: string): { size: number; alignment: number } {
  return match(type)
    .with(P.union('f32', 'u32', 'i32'), () => ({ size: 4, alignment: 4 }))
    .with('f16', () => ({ size: 2, alignment: 2 }))
    .with(P.union('vec2f', 'vec2<f32>', 'vec2u', 'vec2<u32>', 'vec2i', 'vec2<i32>'), () => ({
      size: 8,
      alignment: 8
    }))
    .with(P.union('vec3f', 'vec3<f32>', 'vec3u', 'vec3<u32>', 'vec3i', 'vec3<i32>'), () => ({
      size: 12,
      alignment: 16
    }))
    .with(P.union('vec4f', 'vec4<f32>', 'vec4u', 'vec4<u32>', 'vec4i', 'vec4<i32>'), () => ({
      size: 16,
      alignment: 16
    }))
    .with(P.union('mat2x2f', 'mat2x2<f32>'), () => ({ size: 16, alignment: 8 }))
    .with(P.union('mat3x3f', 'mat3x3<f32>'), () => ({ size: 48, alignment: 16 }))
    .with(P.union('mat4x4f', 'mat4x4<f32>'), () => ({ size: 64, alignment: 16 }))
    .otherwise(() => ({ size: 4, alignment: 4 }));
}

function alignTo(offset: number, alignment: number): number {
  return Math.ceil(offset / alignment) * alignment;
}

function parseStructs(code: string): Map<string, WGSLStruct> {
  const structs = new Map<string, WGSLStruct>();

  // Match struct definitions: struct Name { field1: type1, field2: type2, ... }
  const structRegex = /struct\s+(\w+)\s*\{([^}]+)\}/g;
  let m;

  while ((m = structRegex.exec(code)) !== null) {
    const structName = m[1];
    const fieldsBlock = m[2];
    const fields: WGSLStructField[] = [];

    // Parse each field: name: type
    const fieldRegex = /(\w+)\s*:\s*([^,;}\s]+)/g;
    let fieldMatch;
    let currentOffset = 0;
    let maxAlignment = 4;

    while ((fieldMatch = fieldRegex.exec(fieldsBlock)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2];
      const { size, alignment } = getTypeLayout(fieldType);

      // Align the current offset
      currentOffset = alignTo(currentOffset, alignment);
      maxAlignment = Math.max(maxAlignment, alignment);

      fields.push({
        name: fieldName,
        type: fieldType,
        offset: currentOffset,
        size,
        alignment
      });

      currentOffset += size;
    }

    // Struct size must be a multiple of the largest alignment
    const structSize = alignTo(currentOffset, maxAlignment);

    structs.set(structName, {
      name: structName,
      fields,
      size: structSize,
      alignment: maxAlignment
    });
  }

  return structs;
}

function parseUniforms(code: string, structs: Map<string, WGSLStruct>): WGSLUniformBinding[] {
  const uniforms: WGSLUniformBinding[] = [];

  // Match: @group(0) @binding(0) var<uniform> name: StructType;
  const uniformRegex = /@group\((\d+)\)\s*@binding\((\d+)\)\s*var<uniform>\s*(\w+)\s*:\s*(\w+)/g;
  let m;

  while ((m = uniformRegex.exec(code)) !== null) {
    const structName = m[4];
    uniforms.push({
      group: parseInt(m[1]),
      binding: parseInt(m[2]),
      name: m[3],
      structName,
      struct: structs.get(structName) ?? null
    });
  }

  return uniforms.sort((a, b) => a.binding - b.binding);
}

function extractElementType(type: string): string {
  // Match array<T> patterns
  const arrayMatch = /^array<(.+?)>$/.exec(type);
  if (arrayMatch) return arrayMatch[1];

  return type;
}

export function parseWGSL(code: string): WGSLParseResult {
  const bindings: WGSLBinding[] = [];

  // Match: @group(0) @binding(0) var<storage, read> name: array<f32>;
  const bindingRegex =
    /@group\((\d+)\)\s*@binding\((\d+)\)\s*var<storage,\s*(read|read_write)>\s*(\w+)\s*:\s*([^;]+)/g;

  let m;
  while ((m = bindingRegex.exec(code)) !== null) {
    const type = m[5].trim();
    const elemType = extractElementType(type);
    const { constructor, components } = inferArrayType(elemType);

    bindings.push({
      group: parseInt(m[1]),
      binding: parseInt(m[2]),
      accessMode: m[3] as 'read' | 'read_write',
      name: m[4],
      type,
      elementType: elemType,
      arrayConstructor: constructor,
      componentsPerElement: components
    });
  }

  // Extract workgroup_size from @compute @workgroup_size(x, y, z)
  const wgMatch = /@workgroup_size\((\d+)(?:,\s*(\d+))?(?:,\s*(\d+))?\)/.exec(code);
  const workgroupSize: [number, number, number] | null = wgMatch
    ? [parseInt(wgMatch[1]), parseInt(wgMatch[2] ?? '1'), parseInt(wgMatch[3] ?? '1')]
    : null;

  const sorted = bindings.sort((a, b) => a.binding - b.binding);

  // Parse struct definitions and uniform bindings
  const structs = parseStructs(code);
  const uniforms = parseUniforms(code, structs);

  return {
    bindings: sorted,
    inputs: sorted.filter((b) => b.accessMode === 'read'),
    outputs: sorted.filter((b) => b.accessMode === 'read_write'),
    uniforms,
    structs,
    workgroupSize
  };
}

/** Serialize a JSON object to ArrayBuffer following WGSL struct layout */
export function serializeStructToBuffer(
  data: Record<string, number>,
  struct: WGSLStruct
): ArrayBuffer {
  const buffer = new ArrayBuffer(struct.size);
  const view = new DataView(buffer);

  for (const field of struct.fields) {
    const value = data[field.name];
    if (value === undefined) continue;

    match(field.type)
      .with(P.union('f32', 'f16'), () => view.setFloat32(field.offset, value, true))
      .with('u32', () => view.setUint32(field.offset, value, true))
      .with('i32', () => view.setInt32(field.offset, value, true))
      .otherwise(() => {
        // For vec types, assume the value is a single number for now
        // Could be extended to support arrays for vec2/3/4
        view.setFloat32(field.offset, value, true);
      });
  }

  return buffer;
}
