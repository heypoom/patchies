import type { ObjectInlet } from '$lib/objects/v2/object-metadata';
import { parseObjectParamFromString } from '$lib/objects/parse-object-param';

export const isObjectBoxData = (objectType: string, data: Record<string, unknown>): boolean =>
  data.name === objectType;

export function getTextObjectData(
  objectType: string,
  data: Record<string, unknown>,
  rawParams: string[]
): Record<string, unknown> {
  const params = getRuntimeObjectParamsFromData(objectType, data, rawParams);

  return {
    expr: typeof data.expr === 'string' ? data.expr : '',
    name: objectType,
    params
  };
}

export function getRuntimeObjectParamsFromData(
  objectType: string,
  data: Record<string, unknown>,
  rawParams = getRawObjectParamsFromExpr(data.expr)
): unknown[] {
  const expectedParams = parseObjectParamFromString(objectType, rawParams);
  const hasSavedParams = Array.isArray(data.params);

  const savedParams: unknown[] = hasSavedParams ? (data.params as unknown[]) : [];

  return hasSavedParams && savedParams.length === expectedParams.length
    ? savedParams
    : expectedParams;
}

export function getRawObjectParamsFromExpr(expr: unknown): string[] {
  if (typeof expr !== 'string') return [];

  const trimmed = expr.trim();
  if (!trimmed) return [];

  return trimmed.split(/\s+/).slice(1);
}

export const getAudioParamsFromData = (
  inlets: ObjectInlet[],
  data: Record<string, unknown> | undefined
): unknown[] =>
  inlets.map((inlet) => {
    if (inlet.type === 'signal' && !inlet.acceptsFloat && !inlet.messages?.length) {
      return null;
    }

    if (inlet.name && data && data[inlet.name] !== undefined) {
      return data[inlet.name];
    }

    return inlet.defaultValue ?? null;
  });
