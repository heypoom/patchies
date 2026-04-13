/**
 * Local ESM resolution for packages installed in node_modules.
 * Packages listed here resolve locally (bundled by Vite) instead of hitting esm.sh.
 * Fallback to esm.sh for anything not in the registry.
 */

const LOCAL_PACKAGES: Record<string, () => Promise<unknown>> = {
  'primitive-geometry': () => import('primitive-geometry')
};

export function createEsm(fallbackBaseUrl: string) {
  return (name: string) => {
    const local = LOCAL_PACKAGES[name];
    if (local) return local();
    return import(/* @vite-ignore */ fallbackBaseUrl + name);
  };
}
