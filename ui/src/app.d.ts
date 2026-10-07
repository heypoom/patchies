/// <reference types="audioworklet" />
/// <reference types="w3c-web-serial" />

import type { StartupDiagnosticsSnapshot } from '$lib/startup/startup-diagnostics';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  interface Window {
    __patchiesStartupDiagnostics?: StartupDiagnosticsSnapshot;
    __patchiesStartup?: {
      phase: (message: string) => void;
      error: (error: unknown) => void;
      errorPageMounted: () => void;
      evaluated: (url: string) => void;
      trackImport: <T>(name: string, promise: Promise<T>) => Promise<T>;
    };
  }

  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

// PWA virtual module types
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: Error) => void;
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

export {};
