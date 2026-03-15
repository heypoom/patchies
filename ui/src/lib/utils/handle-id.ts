/**
 * Pure function for deriving xyflow handle IDs from declarative props.
 *
 * This is the single source of truth for handle ID generation.
 * Used by StandardHandle, TypedHandle, and AI handle doc generation.
 */

export type PortDirection = 'inlet' | 'outlet';
export type HandleType = 'video' | 'audio' | 'message' | 'analysis';

export interface HandleProps {
  port: PortDirection;
  type?: HandleType | string;
  id?: string | number;
}

/**
 * Derive the xyflow handle ID string from port direction, type, and id.
 *
 * Priority:
 * 1. type + portDir + id → `${type}-${portDir}-${id}` (e.g. `audio-in-0`)
 * 2. type + portDir      → `${type}-${portDir}`       (e.g. `message-in`)
 * 3. portDir + id        → `${portDir}-${id}`         (e.g. `in-0`)
 * 4. fallback            → port value                 (e.g. `inlet`)
 */
export function deriveHandleId(props: HandleProps): string {
  const portDir = props.port === 'inlet' ? 'in' : 'out';

  if (props.type != null && props.id != null) return `${props.type}-${portDir}-${props.id}`;
  if (props.type != null) return `${props.type}-${portDir}`;
  if (props.id != null) return `${portDir}-${props.id}`;
  return props.port;
}
