import { Type, type TLiteral, type TObject, type TProperties } from '@sinclair/typebox';

/**
 * Shorthand for Type.Literal
 * Usage: t('bang') → Type.Literal('bang')
 */
export function t<T extends string | number | boolean>(value: T): TLiteral<T> {
  return Type.Literal(value);
}

/**
 * Create a symbol message (object with just a type field).
 * Usage: sym('bang') → Type.Object({ type: Type.Literal('bang') })
 */
export function sym<T extends string>(type: T): TObject<{ type: TLiteral<T> }> {
  return Type.Object({ type: Type.Literal(type) });
}

/**
 * Create a typed message with additional properties.
 * Usage: msg('size', { width: Type.Number(), height: Type.Number() })
 *   → Type.Object({ type: Type.Literal('size'), width: Type.Number(), height: Type.Number() })
 */
export function msg<T extends string, P extends TProperties>(
  type: T,
  props: P
): TObject<{ type: TLiteral<T> } & P> {
  return Type.Object({ type: Type.Literal(type), ...props });
}
