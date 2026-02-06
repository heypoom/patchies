import { match, P } from 'ts-pattern';
import type { WGSLBinding, WGSLParseResult } from './types';

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

  return {
    bindings: sorted,
    inputs: sorted.filter((b) => b.accessMode === 'read'),
    outputs: sorted.filter((b) => b.accessMode === 'read_write'),
    workgroupSize
  };
}
