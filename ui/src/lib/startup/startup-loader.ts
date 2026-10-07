// This bootstrap intentionally has no imports: it must survive broken app bundles.
(() => {
  type StartupResource = import('./startup-diagnostics').StartupResource;
  type DiagnosticRow = { text?: string; tone?: string; resource?: StartupResource };

  if (location.pathname.startsWith('/docs/') || location.pathname === '/output') {
    document.documentElement.classList.add('no-loader');
    return;
  }

  const started = performance.now();
  const resources = new Map<string, string>();
  const imports = new Map<string, string>();
  const errors: string[] = [];
  const milestones: string[] = [];
  let slowestResources: StartupResource[] = [];
  let largestResources: StartupResource[] = [];
  const highlightedResources: StartupResource[] = [];
  let resourceCount = 0;
  let phase = 'Waiting for application bundles';
  let finished = false;
  let errorPageMounted = false;
  let diagnosticsRevealed = false;
  let downloadedBytes = 0;
  let resourceObserver: PerformanceObserver | undefined;

  const elapsed = () => Math.floor((performance.now() - started) / 1000);
  const loader = () => document.getElementById('patchies-loader');
  const isBundle = (url: string) => /\.(?:m?js|css|wasm)(?:[?#]|$)/.test(url);
  const resourceName = (url: string) => new URL(url, location.href).pathname;
  const formatSize = (bytes: number) =>
    bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)}MB` : `${(bytes / 1000).toFixed(1)}kB`;

  function metricTone(value: number | null, yellow: number, red: number, normal = '') {
    if (value !== null && value > red) return 'metric-red';
    if (value !== null && value > yellow) return 'metric-yellow';

    return normal;
  }

  const byDuration = (a: StartupResource, b: StartupResource) =>
    b.durationMs - a.durationMs || a.id - b.id;
  const bySize = (a: StartupResource, b: StartupResource) =>
    (b.encodedBodySize || 0) - (a.encodedBodySize || 0) || a.id - b.id;

  const completedRows = () =>
    Array.from(
      new Map(
        [...highlightedResources, ...slowestResources, ...largestResources].map((entry) => [
          entry.id,
          entry
        ])
      ).values()
    )
      .filter(
        (entry) =>
          isBundle(entry.url) || entry.durationMs > 2000 || (entry.encodedBodySize ?? 0) > 20_000
      )
      .sort((a, b) => a.id - b.id)
      .map((resource) => ({ resource }));

  function stateTone(state: string) {
    if (state.endsWith('failed')) return 'failed-state';

    if (state === 'Import evaluated') {
      return 'complete-state';
    }

    if (/^\d+ms/.test(state)) return '';

    return 'pending-state';
  }

  function renderRows(container: HTMLElement | null, rows: DiagnosticRow[]) {
    if (!container) return;

    const fragment = document.createDocumentFragment();

    for (const { text = '', tone = '', resource } of rows) {
      const row = document.createElement('div');
      row.className = 'diagnostic-row';

      if (resource) {
        const time = document.createElement('span');
        const size = document.createElement('span');
        time.className = metricTone(resource.durationMs, 2000, 4000, 'timing');
        time.textContent = `${Math.round(resource.durationMs)}ms`;
        size.className = metricTone(resource.encodedBodySize, 20_000, 50_000);
        size.textContent =
          resource.encodedBodySize === null
            ? 'size unknown'
            : `${(resource.encodedBodySize / 1000).toFixed(1)}kB`;
        row.append(time, ' · ', size, ` · ${resourceName(resource.url)}`);
        fragment.append(row, '\n');
        continue;
      }

      const label = document.createElement('span');
      const separator = text.indexOf(' · ');
      const state = separator < 0 ? text : text.slice(0, separator);
      label.className = tone;

      for (const part of state.split(/(\b\d+(?:ms|s)\b)/)) {
        const token = document.createElement('span');
        token.textContent = part;

        if (/^\d+(?:ms|s)$/.test(part)) token.className = 'timing';

        label.append(token);
      }

      row.append(label, separator < 0 ? '' : text.slice(separator));
      fragment.append(row, '\n');
    }

    container.replaceChildren(fragment);
  }

  function render() {
    const root = loader();

    // The parser exposes the outer loader before its children. The last control
    // signals that all elements used below exist; early events stay in memory.
    if (!root || finished || !root.querySelector<HTMLElement>('#patchies-reload')!) return;

    root.querySelector<HTMLElement>('.text')!.textContent = errors.length
      ? 'Cannot load Patchies'
      : 'Loading Patchies…';
    root.querySelector<HTMLElement>('.phase')!.textContent = phase;
    root.querySelector<HTMLElement>('.status-time')!.textContent = `${elapsed()}s`;
    root.querySelector<HTMLElement>('.status-size')!.textContent = formatSize(downloadedBytes);
    root.querySelector<HTMLElement>('.network')!.textContent = navigator.onLine
      ? ''
      : 'Your browser is offline.';
    root.querySelector<HTMLElement>('.slow')!.hidden = elapsed() < 20;
    root.querySelector<HTMLElement>('.errors')!.textContent = errors.join('\n\n');
    root.classList.toggle('has-errors', errors.length > 0);

    const rows = [
      ...milestones.map((text) => ({ text, tone: '' })),
      ...Array.from(imports, ([name, state]) => ({
        text: `${state} · ${name}`,
        tone: stateTone(state)
      })),
      ...Array.from(resources)
        .filter(([, state]) => !/^\d+ms/.test(state))
        .map(([url, state]) => ({
          text: `${state} · ${resourceName(url)}`,
          tone: stateTone(state)
        })),
      ...completedRows()
    ];
    const pendingDownloads = Array.from(resources.values()).filter(
      (state) => state === 'Awaiting download completion'
    ).length;
    const pendingImports = Array.from(imports.values()).filter(
      (state) => state === 'Loading / evaluating import'
    ).length;

    const activity = [];

    if (pendingDownloads) {
      activity.push(`${pendingDownloads} download${pendingDownloads === 1 ? '' : 's'}`);
    }

    if (pendingImports) {
      activity.push(`${pendingImports} import${pendingImports === 1 ? '' : 's'}`);
    }

    root.querySelector<HTMLElement>('.activity')!.textContent = activity.length
      ? `${activity.join(' · ')} · `
      : '';
    root.querySelector<HTMLElement>('.summary-time')!.textContent = `${elapsed()}s`;
    root.querySelector<HTMLElement>('.summary-size')!.textContent = formatSize(downloadedBytes);
    renderRows(root.querySelector<HTMLElement>('.resources')!, rows);

    if (!diagnosticsRevealed && (errors.length || elapsed() >= 20)) {
      root.querySelector<HTMLDetailsElement>('details')!.open = true;
      diagnosticsRevealed = true;
    }
  }

  function reportError(error: unknown) {
    if (finished) return;

    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}\n${error.stack || ''}`
        : String(error);

    if (!errors.includes(message)) {
      errors.push(message);
      console.error('[Startup]', message);
    }

    render();
  }

  function setPhase(message: string) {
    if (finished) return;

    phase = message;
    milestones.push(`${elapsed()}s · ${message}`);
    console.debug('[Startup]', message);
    render();
  }

  function discoverResources() {
    document
      .querySelectorAll<
        HTMLScriptElement | HTMLLinkElement
      >('script[src], link[rel="modulepreload"], link[rel="stylesheet"]')
      .forEach((element) => {
        const url = element instanceof HTMLScriptElement ? element.src : element.href;

        if (url && !resources.has(url)) resources.set(url, 'Awaiting download completion');
      });
  }

  function recordResources(entries: PerformanceEntry[]) {
    if (finished) return;

    for (const entry of entries) {
      if (!('encodedBodySize' in entry)) continue;

      const timing = entry as PerformanceResourceTiming;
      resourceCount += 1;

      const resource = {
        id: resourceCount,
        url: entry.name,
        durationMs: entry.duration,
        startTimeMs: entry.startTime,
        encodedBodySize: timing.encodedBodySize > 0 ? timing.encodedBodySize : null,
        initiatorType: timing.initiatorType
      };
      if (resource.durationMs > 2000 || (resource.encodedBodySize ?? 0) > 20_000) {
        highlightedResources.push(resource);
      } else {
        slowestResources.push(resource);

        if (resource.encodedBodySize !== null) largestResources.push(resource);
      }

      // One observer delivers each completed request once, including repeat URLs.
      if (timing.encodedBodySize > 0) downloadedBytes += timing.encodedBodySize;

      if (!isBundle(entry.name)) continue;

      // HTTP errors may also produce timing entries; never overwrite a known failure.
      if (resources.get(entry.name) === 'Download failed') continue;

      const sizeKnown = timing.encodedBodySize > 0;
      const size = sizeKnown ? `${(timing.encodedBodySize / 1000).toFixed(1)}kB` : 'size unknown';

      resources.set(entry.name, `${Math.round(entry.duration)}ms · ${size}`);
    }

    slowestResources = slowestResources.sort(byDuration).slice(0, 100);
    largestResources = largestResources.sort(bySize).slice(0, 100);

    render();
  }

  function onError(event: ErrorEvent) {
    const target = event.target;
    const url =
      target instanceof Element &&
      ((target as HTMLImageElement).src || (target as HTMLLinkElement).href);

    if (url) {
      resources.set(url, 'Download failed');
      reportError(`Failed to load ${url}`);
      return;
    }

    reportError(
      event.error ||
        `${event.message || 'Unknown startup error'}${event.filename ? ` at ${event.filename}:${event.lineno}:${event.colno}` : ''}`
    );
  }

  const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason);
  const onNetworkChange = () => render();

  function finish() {
    recordResources(resourceObserver?.takeRecords() || []);
    finished = true;
    milestones.push(`${elapsed()}s · Interface ready`);

    window.__patchiesStartupDiagnostics = {
      durationMs: performance.now() - started,
      downloadedBytes,
      resourceCount,
      route: location.pathname,
      browser: navigator.userAgent,
      online: navigator.onLine,
      serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
      slowest: [...highlightedResources, ...slowestResources].sort(byDuration),
      largest: [...highlightedResources, ...largestResources].sort(bySize),
      errors: errors.slice(-100),
      milestones: milestones.slice(-100),
      pendingDownloads: Array.from(resources)
        .filter(([, state]) => state === 'Awaiting download completion')
        .map(([url]) => url)
        .slice(0, 100),
      pendingImports: Array.from(imports)
        .filter(([, state]) => state === 'Loading / evaluating import')
        .map(([name]) => name)
        .slice(0, 100)
    };

    document.body.classList.add('app-loaded');
    clearInterval(timer);
    domObserver.disconnect();
    resourceObserver?.disconnect();
    window.removeEventListener('error', onError, true);
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('online', onNetworkChange);
    window.removeEventListener('offline', onNetworkChange);
    document.removeEventListener('click', onClick);
    delete window.__patchiesStartup;
    console.debug('[Startup]', `Interface ready after ${elapsed()}s`);
  }

  function checkMounted() {
    if (
      errorPageMounted ||
      document.querySelector('.svelte-flow, canvas#output, .patchies-docs, .debug-page')
    ) {
      finish();
      return;
    }

    discoverResources();
    render();
  }

  async function onClick(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;

    if (event.target.closest('#patchies-reload')) location.reload();
    if (!event.target.closest('#patchies-copy')) return;

    const root = loader();
    if (!root) return;

    const button = root.querySelector<HTMLElement>('#patchies-copy')!;

    const details = [
      `Patchies startup · ${elapsed()}s`,
      `Downloaded: ${formatSize(downloadedBytes)} (known response-body sizes)`,
      `Route: ${location.pathname}`,
      `Online: ${navigator.onLine}`,
      `Service worker controlling page: ${Boolean(navigator.serviceWorker?.controller)}`,
      `Browser: ${navigator.userAgent}`,
      phase,
      root.querySelector<HTMLElement>('.resources')!.textContent,
      ...errors
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(details);

      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Copy loading details manually';
      root.querySelector<HTMLDetailsElement>('details')!.open = true;
    }
  }

  window.__patchiesStartup = {
    phase: setPhase,
    error: reportError,
    errorPageMounted() {
      if (finished) return;

      errorPageMounted = true;
      checkMounted();
    },
    evaluated(url) {
      if (finished) return;

      const name = resourceName(url);
      milestones.push(`${elapsed()}s · Bundle evaluated · ${name}`);
      console.debug('[Startup] Bundle evaluated:', name);

      render();
    },

    trackImport(name, promise) {
      if (finished) return promise;

      imports.set(name, 'Loading / evaluating import');
      render();

      // Preserve the original promise's value and rejection for its caller.
      promise.then(
        () => {
          if (finished) return;

          imports.set(name, 'Import evaluated');
          render();
        },
        (error) => {
          if (finished) return;

          imports.set(name, 'Import failed');
          reportError(error);
        }
      );

      return promise;
    }
  };

  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('online', onNetworkChange);
  window.addEventListener('offline', onNetworkChange);

  document.addEventListener('click', onClick);

  if ('PerformanceObserver' in window) {
    try {
      resourceObserver = new PerformanceObserver((list) => recordResources(list.getEntries()));
      resourceObserver.observe({ type: 'resource', buffered: true });
    } catch {
      // Older browsers can still display milestones and errors.
    }
  }

  const domObserver = new MutationObserver((records) => {
    // Rendering diagnostics also changes the DOM; ignore our own mutations.
    if (records.some((record) => !loader()?.contains(record.target))) {
      checkMounted();
    }
  });

  domObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  const timer = setInterval(checkMounted, 1000);
  setPhase('Waiting for application bundles');
})();
