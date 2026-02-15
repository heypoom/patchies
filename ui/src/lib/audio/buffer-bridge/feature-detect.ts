/**
 * Detect whether SharedArrayBuffer is available.
 *
 * SAB requires cross-origin isolation (COOP + COEP headers).
 * `crossOriginIsolated` is the definitive browser check.
 */
export function canUseSharedArrayBuffer(): boolean {
  if (typeof crossOriginIsolated !== 'undefined') {
    return crossOriginIsolated;
  }

  return typeof SharedArrayBuffer !== 'undefined';
}
