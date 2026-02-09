# Offline Usage

Patchies can be used even when you don't have an internet connection. Simply visit `https://patchies.app` as usual on your browser, and it will continue to work even when there is no internet.

## Preparing for Offline

To ensure most features are available when you are offline, use `Ctrl/Cmd + K > Prepare for Offline` to download as many assets for offline use as possible. This lets you pre-cache most objects into disk.

## Behind the scenes

Patchies uses [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [Vite PWA for SvelteKit](https://github.com/vite-pwa/sveltekit) and [Workbox](https://web.dev/learn/pwa/workbox).

## See Also

- [Demos](/docs/demos)
- [Saves](/docs/manage-saves)
