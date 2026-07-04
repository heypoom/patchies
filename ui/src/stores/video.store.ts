import { writable, derived, get } from 'svelte/store';
import { webCodecsSupport, isFirefox, isSafari } from '$lib/video/feature-detection';

// Video input devices
export interface VideoDevice {
  id: string;
  name: string;
}

export const videoInputDevices = writable<VideoDevice[]>([]);
export const hasEnumeratedVideoDevices = writable(false);

/** Enumerate video input devices and populate store */
export async function enumerateVideoDevices(): Promise<void> {
  try {
    // Request permission first to get device labels
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs: VideoDevice[] = [];

    for (const device of devices) {
      if (device.kind === 'videoinput') {
        inputs.push({
          id: device.deviceId,
          name: device.label || `Camera ${inputs.length + 1}`
        });
      }
    }

    videoInputDevices.set(inputs);
    hasEnumeratedVideoDevices.set(true);
  } catch (error) {
    console.error('Failed to enumerate video devices:', error);
  }
}

/** Get default video input device ID */
export function getDefaultVideoDeviceId(): string {
  const inputs = get(videoInputDevices);
  return inputs[0]?.id ?? '';
}

// WebCodecs toggle - can be disabled for testing/comparison
const storedUseWebCodecs =
  typeof localStorage !== 'undefined' ? localStorage.getItem('patchies-use-webcodecs') : null;

// Default to true on Chrome/Edge, false on Firefox/Safari (slower performance)
// Users can manually toggle to test Firefox/Safari's experimental WebCodecs
const defaultValue =
  storedUseWebCodecs === null ? !isFirefox() && !isSafari() : storedUseWebCodecs === 'true';

export const useWebCodecs = writable(defaultValue);

// Persist to localStorage
if (typeof localStorage !== 'undefined') {
  useWebCodecs.subscribe((value) => {
    localStorage.setItem('patchies-use-webcodecs', String(value));
  });
}

// Derived store: true only if WebCodecs is enabled AND supported
export const webCodecsEnabled = derived(useWebCodecs, ($useWebCodecs) => {
  return $useWebCodecs && webCodecsSupport.videoFileFull;
});

// Derived store for webcam: true only if WebCodecs is enabled AND webcam support exists
export const webCodecsWebcamEnabled = derived(useWebCodecs, ($useWebCodecs) => {
  return $useWebCodecs && webCodecsSupport.webcamFull;
});

// Video stats overlay toggle
const storedShowVideoStats =
  typeof localStorage !== 'undefined' ? localStorage.getItem('patchies-show-video-stats') : null;

export const showVideoStats = writable(storedShowVideoStats === 'true');

if (typeof localStorage !== 'undefined') {
  showVideoStats.subscribe((value) => {
    localStorage.setItem('patchies-show-video-stats', String(value));
  });
}

/**
 * Toggle WebCodecs on/off for testing.
 * Can be called from browser console: window.toggleWebCodecs()
 */
export function toggleWebCodecs(): boolean {
  let newValue = false;
  useWebCodecs.update((v) => {
    newValue = !v;
    return newValue;
  });
  console.log(`[Video] WebCodecs ${newValue ? 'enabled' : 'disabled'}`);
  return newValue;
}

/**
 * Toggle video stats overlay.
 * Can be called from browser console: window.toggleVideoStats()
 */
export function toggleVideoStats(): boolean {
  let newValue = false;
  showVideoStats.update((v) => {
    newValue = !v;
    return newValue;
  });
  console.log(`[Video] Stats overlay ${newValue ? 'visible' : 'hidden'}`);
  return newValue;
}

// Expose toggles to window for easy console access
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).getWebCodecsStatus = () => ({
    enabled: webCodecsSupport.videoFileFull,
    webcamSupported: webCodecsSupport.webcamFull,
    videoFileSupported: webCodecsSupport.videoFileFull,
    userToggle: localStorage.getItem('patchies-use-webcodecs')
  });
}
