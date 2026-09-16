export async function loadLibPd() {
  const [library, worklet] = await Promise.all([
    import('libpd-wasm'),
    import('libpd-wasm/assets/libpd-worklet-full.js?url')
  ]);

  return { ...library, workletUrl: worklet.default };
}
