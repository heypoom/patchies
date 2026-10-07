export interface StartupResource {
  id: number;
  url: string;
  durationMs: number;
  startTimeMs: number;
  encodedBodySize: number | null;
  initiatorType: string;
}

export interface StartupDiagnosticsSnapshot {
  durationMs: number;
  downloadedBytes: number;
  resourceCount: number;
  route: string;
  browser: string;
  online: boolean;
  serviceWorkerControlled: boolean;
  slowest: StartupResource[];
  largest: StartupResource[];
  errors: string[];
  milestones: string[];
  pendingDownloads: string[];
  pendingImports: string[];
}

export const getStartupDiagnostics = () =>
  typeof window === 'undefined' ? undefined : window.__patchiesStartupDiagnostics;

export const formatStartupResourceUrl = (
  url: string,
  origin = typeof window === 'undefined' ? '' : window.location.origin
) => (origin && url.startsWith(`${origin}/`) ? url.slice(origin.length) : url);

const metricColor = (value: number | null, yellow: number, red: number, normal: string) => {
  if (value !== null && value > red) return 'text-red-300';
  if (value !== null && value > yellow) return 'text-yellow-300';

  return normal;
};

export const startupDurationColor = (durationMs: number) =>
  metricColor(durationMs, 2000, 4000, 'text-blue-300');

export const startupSizeColor = (bytes: number | null) =>
  metricColor(bytes, 20_000, 50_000, 'text-zinc-400');

export const formatStartupSize = (bytes: number | null) => {
  if (bytes === null) return 'Unknown';

  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;

  return `${(bytes / 1000).toFixed(1)}kB`;
};

const formatResource = (entry: StartupResource) =>
  `${Math.round(entry.durationMs)}ms · ${formatStartupSize(entry.encodedBodySize)} · ${entry.url}`;

export const formatStartupDiagnostics = (snapshot: StartupDiagnosticsSnapshot) =>
  [
    `Patchies startup · ${(snapshot.durationMs / 1000).toFixed(1)}s`,
    `Downloaded: ${formatStartupSize(snapshot.downloadedBytes)} (known response-body sizes)`,
    `Completed resources: ${snapshot.resourceCount}`,
    `Route: ${snapshot.route}`,
    `Browser: ${snapshot.browser}`,
    `Online: ${snapshot.online}`,
    `Service worker controlling page: ${snapshot.serviceWorkerControlled}`,
    '',
    'Slowest downloads',
    ...snapshot.slowest.map(formatResource),
    '',
    'Largest downloads',
    ...snapshot.largest.map(formatResource),
    '',
    'Startup events',
    ...snapshot.milestones,
    '',
    'Errors',
    ...snapshot.errors,
    '',
    'Pending downloads at dismissal',
    ...snapshot.pendingDownloads,
    '',
    'Pending imports at dismissal',
    ...snapshot.pendingImports
  ].join('\n');
