/**
 * Unregisters all service workers and clears all caches.
 * Useful for fixing aggressive caching issues in emergencies.
 *
 * @returns true if any service workers were unregistered
 */
export async function unregisterAllServiceWorkers(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();

  for (const registration of registrations) {
    await registration.unregister();
    console.log('[SW] Unregistered service worker:', registration.scope);
  }

  if (registrations.length > 0) {
    console.log('[SW] All service workers unregistered.');

    // Clear all caches too
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log('[SW] Cleared all caches:', cacheNames);
    }

    return true;
  }

  return false;
}
