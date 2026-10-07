import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { test, expect, type Page } from '@playwright/test';
import { rollup } from 'rollup';
import { startupDiagnostics } from '../vite-plugin-startup-diagnostics';
import { readStartupTemplate } from '../scripts/startup-template.js';

const template = readStartupTemplate();

test('captures early startup events while the loader HTML is still being parsed', async ({
  page
}) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));

  const html = template
    .replaceAll('%sveltekit.assets%', '')
    .replace('%sveltekit.head%', '')
    .replace('%sveltekit.body%', '')
    .replace(
      '<div class="text">Loading Patchies…</div>',
      '<div class="text">Loading Patchies…</div><script src="/pause-parser.js"></script>'
    );
  let resumeParsing!: () => void;
  const paused = new Promise<void>((resolve) => (resumeParsing = resolve));

  await page.route('https://patchies.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: html })
  );
  await page.route('**/pause-parser.js', async (route) => {
    await paused;
    await route.fulfill({ contentType: 'text/javascript', body: '' });
  });

  await page.goto('https://patchies.test/', { waitUntil: 'commit' });
  await expect(page.locator('.text')).toBeAttached();
  await expect(page.locator('.phase')).not.toBeAttached();

  expect(browserErrors).toEqual([]);

  await page.evaluate(() => {
    window.__patchiesStartup?.phase('SvelteKit started during parsing');
    window.__patchiesStartup?.error(new Error('Early startup failure'));
  });

  resumeParsing();

  await expect(page.locator('.phase')).toHaveText('SvelteKit started during parsing');
  await expect(page.locator('.errors')).toContainText('Early startup failure');

  expect(browserErrors).toEqual([]);
});

async function openLoader(page: Page, body = '', path = '/', setup?: () => Promise<void>) {
  const html = template
    .replaceAll('%sveltekit.assets%', '')
    .replace('%sveltekit.head%', '')
    .replace('%sveltekit.body%', body);

  await page.route('https://patchies.test/**', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({ contentType: 'text/html', body: html });
      return;
    }

    await route.fulfill({ status: 204 });
  });

  await setup?.();
  await page.goto(`https://patchies.test${path}`, { waitUntil: 'commit' });
  await expect(page.locator('#patchies-loader .text')).toBeAttached();
}

test('shows a pending bundle, download completion, and evaluation separately', async ({ page }) => {
  await openLoader(page);

  let releaseDownload!: () => void;
  const download = new Promise<void>((resolve) => (releaseDownload = resolve));
  const bundle = 'window.__patchiesStartup.evaluated(import.meta.url);'.padEnd(1500, ' ');

  await page.route('**/slow.js', async (route) => {
    await download;
    await route.fulfill({
      contentType: 'text/javascript',
      body: bundle
    });
  });

  await page.evaluate(() => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = '/slow.js';
    document.head.append(script);
  });

  const resources = page.locator('.resources');
  await expect(resources).toContainText('Awaiting download completion · /slow.js');

  releaseDownload();

  await expect(resources).toContainText(/\d+ms · size unknown · \/slow\.js/);
  await expect(resources).toContainText('Bundle evaluated · /slow.js');
});

test('reports the encoded download size of a real compressed bundle', async ({ page }) => {
  const bundle = gzipSync(
    Buffer.from('window.__patchiesStartup.evaluated(import.meta.url);'.padEnd(1500, ' '))
  );
  const html = template
    .replaceAll('%sveltekit.assets%', '')
    .replace('%sveltekit.head%', '')
    .replace('%sveltekit.body%', '<script type="module" src="/sized.js"></script>');
  const server = createServer((request, response) => {
    if (request.url === '/sized.js') {
      response.writeHead(200, {
        'Content-Type': 'text/javascript',
        'Content-Encoding': 'gzip',
        'Content-Length': bundle.length
      });
      response.end(bundle);
      return;
    }

    if (request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(html);
      return;
    }

    if (request.url === '/asset.bin') {
      response.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': 1_100_000,
        'Cache-Control': 'no-store'
      });
      response.end(Buffer.alloc(1_100_000));
      return;
    }

    response.writeHead(204);
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();

    if (!address || typeof address === 'string') throw new Error('Missing fixture server port');

    await page.goto(`http://127.0.0.1:${address.port}`);

    const size = `${(bundle.length / 1000).toFixed(1)}kB`;

    await expect(page.locator('.resources')).toContainText(` · ${size} · /sized.js`);
    await expect(page.locator('.summary-size')).toHaveText(size);
    await expect(page.locator('.status-size')).toHaveText(size);

    const timing = await page.evaluate(() => {
      const entry = performance
        .getEntriesByType('resource')
        .find((entry) => entry.name.endsWith('/sized.js')) as PerformanceResourceTiming;

      return { encoded: entry.encodedBodySize, decoded: entry.decodedBodySize };
    });

    expect(timing.encoded).toBe(bundle.length);
    expect(timing.decoded).toBe(1500);

    await page.evaluate(async () => {
      const response = await fetch('/asset.bin');
      await response.arrayBuffer();
    });

    await expect(page.locator('.summary-size')).toHaveText('1.1MB');

    await page.evaluate(async () => {
      const response = await fetch('/asset.bin');
      await response.arrayBuffer();
    });

    await expect(page.locator('.summary-size')).toHaveText('2.2MB');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('reports failed scripts, runtime errors, rejections, and framework errors', async ({
  page
}) => {
  await openLoader(page);
  await page.route('**/missing.js', (route) => route.fulfill({ status: 404 }));

  await page.evaluate(() => {
    const script = document.createElement('script');
    script.src = '/missing.js';
    document.head.append(script);

    setTimeout(() => {
      throw new Error('Startup execution failed');
    });

    void Promise.reject(new Error('Startup promise failed'));
    window.__patchiesStartup?.error(new Error('SvelteKit route failed'));
  });

  const errors = page.locator('.errors');
  await expect(errors).toContainText('Failed to load https://patchies.test/missing.js');
  await expect(errors).toContainText('Startup execution failed');
  await expect(errors).toContainText('Startup promise failed');
  await expect(errors).toContainText('SvelteKit route failed');
  await expect(page.locator('.text')).toHaveText('Cannot load Patchies');

  await expect(page.locator('details')).toHaveAttribute('open', '');
  await expect(page.locator('.resources')).toContainText('Download failed · /missing.js');
});

test('shows unknown size when cross-origin resource timing hides the body size', async ({
  page
}) => {
  await openLoader(page);
  await page.route('https://cdn.patchies.test/hidden.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: 'void 0;' })
  );

  await page.evaluate(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.patchies.test/hidden.js';
    document.head.append(script);
  });

  await expect(page.locator('.resources')).toContainText(/\d+ms · size unknown · \/hidden\.js/);
});

test('retains the loader after 20 seconds and reports milestones and offline state', async ({
  page
}) => {
  await page.clock.install();
  await openLoader(page);
  await page.evaluate(() => {
    window.__patchiesStartup?.phase('SvelteKit started; loading the page');
    window.__patchiesStartup?.phase('Svelte mounted; waiting for the patcher canvas');
  });

  await page.clock.fastForward(21_000);

  await expect(page.locator('#patchies-loader')).toBeVisible();
  await expect(page.locator('.slow')).toBeVisible();
  await expect(page.locator('.status')).toContainText('21s');
  await expect(page.locator('.resources')).toContainText('SvelteKit started');
  await expect(page.locator('.resources')).toContainText('Svelte mounted');

  await page.context().setOffline(true);

  await expect(page.locator('.network')).toContainText('offline');
});

test('dismisses on mounting before window load and removes startup observers', async ({ page }) => {
  let releaseImage!: () => void;
  const pendingImage = new Promise<void>((resolve) => (releaseImage = resolve));

  await openLoader(page, '<img src="/pending.png" />', '/', async () => {
    await page.route('**/pending.png', async (route) => {
      await pendingImage;
      await route.fulfill({ status: 204 });
    });
  });

  await page.evaluate(() => {
    const canvas = document.createElement('div');
    canvas.className = 'svelte-flow';
    document.body.append(canvas);
  });

  await expect(page.locator('#patchies-loader')).toBeHidden();

  expect(await page.evaluate(() => window.__patchiesStartup)).toBeUndefined();
  expect(
    await page.evaluate(() => window.__patchiesStartupDiagnostics?.durationMs)
  ).toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(() => document.readyState)).not.toBe('complete');

  const errors = await page.locator('.errors').textContent();

  await page.evaluate(() =>
    window.dispatchEvent(new ErrorEvent('error', { message: 'Later error' }))
  );

  await expect(page.locator('.errors')).toHaveText(errors ?? '');

  releaseImage();
});

test('dismisses after an error page mounts without a recognized canvas selector', async ({
  page
}) => {
  await openLoader(page, '', '/missing-route');
  await page.evaluate(() => {
    const errorPage = document.createElement('main');
    errorPage.textContent = '404 Not Found';
    document.body.append(errorPage);

    window.__patchiesStartup?.errorPageMounted();
  });

  await expect(page.locator('#patchies-loader')).toBeHidden();
  expect(await page.evaluate(() => window.__patchiesStartup)).toBeUndefined();
  expect(
    await page.evaluate(() => window.__patchiesStartupDiagnostics?.milestones.at(-1))
  ).toContain('Interface ready');
});

test('retains separate top-100 startup rankings and freezes them at dismissal', async ({
  page
}) => {
  await page.addInitScript(() => {
    const fixture = window as unknown as {
      deliverResources: (entries: unknown[]) => void;
      queuedResources: unknown[];
      observerDisconnected: boolean;
    };
    fixture.queuedResources = [];
    fixture.observerDisconnected = false;

    class ResourceObserver {
      constructor(callback: (list: { getEntries: () => unknown[] }) => void) {
        fixture.deliverResources = (entries) => callback({ getEntries: () => entries });
      }

      observe() {}

      takeRecords() {
        return fixture.queuedResources.splice(0);
      }

      disconnect() {
        fixture.observerDisconnected = true;
      }
    }

    Object.defineProperty(window, 'PerformanceObserver', { value: ResourceObserver });
  });

  await openLoader(page);
  let releasePending!: () => void;
  const pendingResponse = new Promise<void>((resolve) => (releasePending = resolve));

  await page.route('**/pending.js', async (route) => {
    await pendingResponse;
    await route.fulfill({ contentType: 'text/javascript', body: '' });
  });

  await page.evaluate(() => {
    const fixture = window as unknown as {
      deliverResources: (entries: unknown[]) => void;
      queuedResources: unknown[];
    };
    fixture.deliverResources(
      Array.from({ length: 250 }, (_, index) => ({
        name: `https://patchies.test/${index >= 248 ? 'repeat' : index}.js`,
        duration: (250 - index) * 5,
        startTime: index,
        encodedBodySize: index * 50,
        initiatorType: 'script'
      }))
    );
    fixture.queuedResources.push({
      name: 'https://patchies.test/queued.wasm',
      duration: 5000,
      startTime: 250,
      encodedBodySize: 1_000_000,
      initiatorType: 'fetch'
    });
    window.__patchiesStartup?.error(new Error('Retained startup error'));
    window.__patchiesStartup?.trackImport('pending.js', new Promise(() => {}));

    const pending = document.createElement('link');
    pending.rel = 'modulepreload';
    pending.href = '/pending.js';
    document.head.append(pending);
  });

  await expect(page.locator('.resources')).toContainText(
    'Awaiting download completion · /pending.js'
  );
  await page.evaluate(() => {
    const canvas = document.createElement('div');
    canvas.className = 'svelte-flow';
    document.body.append(canvas);
  });

  await expect(page.locator('#patchies-loader')).toBeHidden();

  const snapshot = await page.evaluate(() => window.__patchiesStartupDiagnostics!);

  expect(snapshot.resourceCount).toBe(251);
  expect(snapshot.downloadedBytes).toBe(2_556_250);
  expect(snapshot.slowest).toHaveLength(101);
  expect(snapshot.largest).toHaveLength(101);

  expect(snapshot.slowest[0].url).toContain('queued.wasm');
  expect(snapshot.slowest[1].url).toContain('/0.js');
  expect(snapshot.slowest[1].encodedBodySize).toBeNull();
  expect(snapshot.largest[1].url).toContain('repeat.js');
  expect(snapshot.largest[2].url).toContain('repeat.js');
  expect(snapshot.largest[1].id).not.toBe(snapshot.largest[2].id);

  expect(snapshot.errors.join('\n')).toContain('Retained startup error');
  expect(snapshot.milestones.at(-1)).toContain('Interface ready');
  expect(snapshot.pendingDownloads).toContain('https://patchies.test/pending.js');
  expect(snapshot.pendingImports).toContain('pending.js');

  releasePending();

  const disconnected = await page.evaluate(() => {
    const fixture = window as unknown as {
      observerDisconnected: boolean;
      deliverResources: (entries: unknown[]) => void;
    };
    fixture.deliverResources([
      {
        name: 'https://patchies.test/after-startup.js',
        duration: 100_000,
        startTime: 1000,
        encodedBodySize: 100_000_000,
        initiatorType: 'script'
      }
    ]);

    return fixture.observerDisconnected;
  });

  expect(disconnected).toBe(true);
  expect(await page.evaluate(() => window.__patchiesStartupDiagnostics)).toEqual(snapshot);
});

test('highlights exact thresholds and retains every highlighted request outside ranking limits', async ({
  page
}) => {
  await page.addInitScript(() => {
    const fixture = window as unknown as { deliverResources: (entries: unknown[]) => void };

    class ResourceObserver {
      constructor(callback: (list: { getEntries: () => unknown[] }) => void) {
        fixture.deliverResources = (entries) => callback({ getEntries: () => entries });
      }

      observe() {}
      takeRecords() {
        return [];
      }
      disconnect() {}
    }

    Object.defineProperty(window, 'PerformanceObserver', { value: ResourceObserver });
  });

  await openLoader(page);
  await page.evaluate(() => {
    const fixture = window as unknown as { deliverResources: (entries: unknown[]) => void };
    const resource = (path: string, duration: number, encodedBodySize: number) => ({
      name: `https://patchies.test/${path}`,
      duration,
      encodedBodySize,
      startTime: 0,
      initiatorType: 'fetch'
    });

    fixture.deliverResources([
      resource('boundary.js', 2000, 20_000),
      resource('yellow.js', 4000, 50_000),
      resource('red.js', 4001, 50_001),
      resource('lower-yellow.js', 2001, 20_001),
      resource('repeat.bin', 5000, 0),
      resource('repeat.bin', 5000, 0),
      ...Array.from({ length: 120 }, (_, index) => resource(`slow-${index}.bin`, 3000, 1000)),
      ...Array.from({ length: 120 }, (_, index) => resource(`large-${index}.bin`, 10, 30_000))
    ]);
    // A later batch cannot evict earlier highlighted requests.
    fixture.deliverResources(
      Array.from({ length: 250 }, (_, index) => resource(`normal-${index}.js`, 100, 1000))
    );
  });

  const row = (path: string) => page.locator('.diagnostic-row').filter({ hasText: ` · /${path}` });

  await expect(row('boundary.js').locator('.timing')).toHaveText('2000ms');
  await expect(row('boundary.js').locator('.metric-yellow, .metric-red')).toHaveCount(0);
  await expect(row('yellow.js').locator('.metric-yellow')).toHaveCount(2);
  await expect(row('red.js').locator('.metric-red')).toHaveCount(2);
  await expect(row('lower-yellow.js').locator('.metric-yellow')).toHaveCount(2);
  await expect(row('repeat.bin')).toHaveCount(2);
  await expect(row('slow-0.bin')).toHaveCount(1);
  await expect(row('large-0.bin')).toHaveCount(1);

  await page.evaluate(() => {
    const canvas = document.createElement('div');
    canvas.className = 'svelte-flow';
    document.body.append(canvas);
  });
  await expect(page.locator('#patchies-loader')).toBeHidden();

  const snapshot = await page.evaluate(() => window.__patchiesStartupDiagnostics!);
  // 245 highlighted requests plus 100 ordinary requests in each ranking.
  expect(snapshot.slowest).toHaveLength(345);
  expect(snapshot.largest).toHaveLength(345);
  expect(snapshot.slowest.filter((entry) => entry.url.endsWith('/repeat.bin'))).toHaveLength(2);
  expect(snapshot.largest.filter((entry) => entry.url.endsWith('/repeat.bin'))).toHaveLength(2);

  for (const ranking of [snapshot.slowest, snapshot.largest]) {
    expect(new Set(ranking.map((entry) => entry.id)).size).toBe(345);
    expect(ranking.some((entry) => entry.url.endsWith('/slow-0.bin'))).toBe(true);
    expect(ranking.some((entry) => entry.url.endsWith('/large-0.bin'))).toBe(true);
  }
});

for (const path of ['/docs/topic', '/output']) {
  test(`skips the loader on ${path}`, async ({ page }) => {
    await openLoader(page, '', path);

    await expect(page.locator('#patchies-loader')).toBeHidden();
    expect(await page.evaluate(() => window.__patchiesStartup)).toBeUndefined();
  });
}

test('reload action retries the document', async ({ page }) => {
  await openLoader(page);
  await page.locator('summary').click();

  await Promise.all([
    page.waitForEvent('request', (request) => request.resourceType() === 'document'),
    page.locator('#patchies-reload').click()
  ]);

  await expect(page.locator('#patchies-loader')).toBeVisible();
});

test('copy action includes errors, pending bundles, and browser context', async ({ page }) => {
  await openLoader(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (value: string) => {
          document.documentElement.dataset.diagnostics = value;
          return Promise.resolve();
        }
      }
    });

    window.__patchiesStartup?.error(new Error('Cache broke startup'));
  });

  await page.locator('#patchies-copy').click();

  await expect(page.locator('#patchies-copy')).toHaveText('Copied');

  const diagnostics = await page.evaluate(() => document.documentElement.dataset.diagnostics);

  expect(diagnostics).toContain('Cache broke startup');
  expect(diagnostics).toContain('Service worker controlling page: false');
  expect(diagnostics).toContain('Waiting for application bundles');
});

test('production instrumentation preserves native imports and reports their outcomes', async ({
  page
}) => {
  const build = await rollup({
    input: 'entry',
    plugins: [
      {
        name: 'startup-fixture',
        resolveId: (id) => id,
        load(id) {
          if (id === 'entry') {
            return `window.loadBundle = () => import('delayed');
              window.loadFailure = () => import('failed');`;
          }

          if (id === 'failed') return `throw new Error('Bundle evaluation failed');`;

          return 'export const result = 42;';
        }
      },
      startupDiagnostics()
    ]
  });

  const { output } = await build.generate({ format: 'es', entryFileNames: 'entry.js' });

  await build.close();
  let releaseImport!: () => void;
  const pendingImport = new Promise<void>((resolve) => (releaseImport = resolve));

  await openLoader(page, '<script type="module" src="/entry.js"></script>', '/', async () => {
    for (const chunk of output) {
      if (chunk.type !== 'chunk') continue;

      await page.route(`**/${chunk.fileName}`, async (route) => {
        if (chunk.facadeModuleId === 'delayed') await pendingImport;

        await route.fulfill({ contentType: 'text/javascript', body: chunk.code });
      });
    }
  });

  await expect(page.locator('.resources')).toContainText('Bundle evaluated · /entry.js');

  const resultPromise = page.evaluate(async () => {
    const load = (window as unknown as { loadBundle: () => Promise<{ result: number }> })
      .loadBundle;

    return (await load()).result;
  });

  await expect(page.locator('.resources')).toContainText('Loading / evaluating import');
  await expect(page.locator('summary')).toContainText('1 import');

  releaseImport();

  const result = await resultPromise;

  expect(result).toBe(42);

  await expect(page.locator('.resources')).toContainText('Import evaluated');

  const error = await page.evaluate(async () => {
    const load = (window as unknown as { loadFailure: () => Promise<unknown> }).loadFailure;

    try {
      await load();
    } catch (error) {
      return (error as Error).message;
    }
  });

  expect(error).toBe('Bundle evaluation failed');

  await expect(page.locator('.resources')).toContainText('Import failed');
  await expect(page.locator('.errors')).toContainText('Bundle evaluation failed');

  // The same output must work when the HTML bootstrap is absent (e.g. skipped routes).
  await page.evaluate(() => delete window.__patchiesStartup);

  expect(
    await page.evaluate(async () => {
      const load = (window as unknown as { loadBundle: () => Promise<{ result: number }> })
        .loadBundle;

      return (await load()).result;
    })
  ).toBe(42);
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 375, height: 667 }
]) {
  test(`keeps diagnostics quiet and within the ${viewport.width}px viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.clock.install();
    await openLoader(page);

    const panel = page.locator('.diagnostics');

    await expect(panel).not.toHaveAttribute('open', '');
    await expect(page.locator('#patchies-copy')).toBeHidden();
    await expect(page.locator('#patchies-reload')).toBeHidden();
    await expect(page.locator('.error-icon')).toBeHidden();

    await page.screenshot({ path: test.info().outputPath('normal.png') });
    await page.evaluate(async () => {
      window.__patchiesStartup?.trackImport(
        '_app/immutable/nodes/patcher-with-a-long-generated-bundle-name-and-dependency-hash.js',
        new Promise(() => {})
      );

      await fetch('/_app/immutable/chunks/codemirror.js');

      window.__patchiesStartup?.error(new Error('Failed to load /_app/immutable/chunks/tone.js'));
    });

    await expect(panel).toHaveAttribute('open', '');
    await expect(page.locator('#patchies-copy')).toBeVisible();
    await expect(page.locator('.error-icon')).toBeVisible();
    await expect(
      page.locator('.diagnostic-row').filter({ hasText: 'codemirror.js' })
    ).toBeVisible();
    await expect(page.locator('.pending-state')).toBeVisible();

    const log = page.locator('.diagnostic-content');
    const presentation = await log.evaluate((element) => ({
      hasHorizontalScroll: element.scrollWidth > element.clientWidth,
      errorWhitespace: getComputedStyle(element.querySelector('.errors')!).whiteSpace,
      rowWhitespace: getComputedStyle(element.querySelector('.diagnostic-row')!).whiteSpace,
      timingColor: getComputedStyle(element.querySelector('.timing')!).color,
      textColor: getComputedStyle(element.querySelector('.phase')!).color
    }));

    expect(presentation.hasHorizontalScroll).toBe(true);
    expect(presentation.errorWhitespace).toBe('pre');
    expect(presentation.rowWhitespace).toBe('pre');
    expect(presentation.timingColor).not.toBe(presentation.textColor);

    await log.evaluate((element) => {
      element.scrollLeft = 120;
    });

    expect(await log.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

    await log.evaluate((element) => {
      element.scrollLeft = 0;
    });

    const bounds = await panel.boundingBox();

    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(16);
    expect(bounds!.y).toBeGreaterThanOrEqual(16);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - 15);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 15);

    if (viewport.width < 600) {
      const message = await page.locator('.loading').boundingBox();

      expect(message!.y + message!.height).toBeLessThan(bounds!.y);
    }

    await page.screenshot({ path: test.info().outputPath('error.png') });
    await page.locator('summary').focus();
    await page.keyboard.press('Enter');
    await page.clock.fastForward(21_000);

    await expect(panel).not.toHaveAttribute('open', '');
  });
}
