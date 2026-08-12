# iOS Safari Render Worker Message Research (2026-08-12)

## Question

Is there a known Safari/WebKit issue where a dedicated worker remains alive and sends messages to the main thread, but stops handling messages from the main thread? Why might Patchies reproduce this only in a Vite production build?

## Conclusion

I found no current WebKit report that exactly matches the Patchies observation:

- the dedicated render worker remains alive;
- its render loop and timers continue;
- it continues to send frames to the main thread;
- but its `message` handler stops handling messages from the main thread;
- the failure begins after Hydra or Shader Park uses the worker's WebGL context.

WebKit has had related message-delivery and OffscreenCanvas/WebGL defects. They show that these subsystems have had real Safari bugs, but none is evidence for this exact failure.

The production-only result is strong evidence that Patchies must first test the production worker artifact. Vite does not serve the same worker program in development and production. Patchies also applies a build-only Terser plugin to worker chunks. A production-only bundle transformation, chunk relationship, removed side effect, or timing change is at least as plausible as WebKit dropping messages.

The phrase "Safari starves inbound messages" should therefore remain a description of the observed result, not a confirmed browser root cause.

## What `postMessage()` Proves

A successful call to `worker.postMessage()` proves that the message was serialized and submitted to the worker's communication channel. It does not prove that the worker ran its `message` handler.

The HTML Standard defines dedicated-worker communication using an implicit `MessagePort`. Posted messages become event-loop tasks. Message delivery does not interrupt a task that is already running. A worker task must return before another queued message event can run. See the [HTML Standard: communicating with a dedicated worker](https://html.spec.whatwg.org/multipage/workers.html#communicating-with-a-dedicated-worker), [dedicated worker global scope](https://html.spec.whatwg.org/multipage/workers.html#dedicated-workers-and-the-dedicatedworkerglobalscope-interface), and [event loops](https://html.spec.whatwg.org/multipage/webappapis.html#event-loops).

This leaves two different explanations for the same counters:

1. WebKit incorrectly stops dispatching tasks from the worker's implicit message port.
2. Production code keeps the worker inside another task or microtask sequence, so queued message tasks do not get a turn.

The second explanation is an application or generated-bundle scheduling bug. It does not require Safari to lose a message.

## WebKit Issues

### Exact match

No exact match was found in WebKit Bugzilla, WebKit release notes, or the relevant web standards.

### Similar message-delivery failures, but not this case

- [WebKit bug 184285](https://bugs.webkit.org/show_bug.cgi?id=184285) describes a `MessagePort` created inside a worker that stops receiving messages after garbage collection. Keeping the `MessageChannel` alive avoids the failure. It was fixed in 2018.
- [WebKit bug 184502](https://bugs.webkit.org/show_bug.cgi?id=184502) describes messages sent between workers through an explicit `MessageChannel` that are never received because the channel is deallocated. It was fixed in 2018.
- [WebKit bug 193184](https://bugs.webkit.org/show_bug.cgi?id=193184) describes a `MessagePort` that Safari garbage-collects after inactivity or memory pressure, after which it permanently stops receiving. It was fixed in 2022.

These bugs establish precedent for WebKit message-channel lifetime defects. They are not direct matches because Patchies uses `Worker.postMessage()` and `self.onmessage` for the render-control path, keeps the `Worker` reachable through `GLSystem`, and still observes worker activity.

- [WebKit bug 240062](https://bugs.webkit.org/show_bug.cgi?id=240062) describes workers that stop when the page no longer holds a reachable reference. This is not a match because Patchies retains `GLSystem.renderWorker`, and the observed worker continues rendering and posting frames.
- [WebKit bug 259362](https://bugs.webkit.org/show_bug.cgi?id=259362) describes an `OffscreenCanvas` sent through `window.postMessage()` becoming `null` when an isolated-world listener is present. It was fixed in 2023. It concerns window/iframe delivery of one transferred object, not a live dedicated worker that later stops handling ordinary messages.

### Similar OffscreenCanvas, WebGL, and transfer failures

- [WebKit bug 286707](https://bugs.webkit.org/show_bug.cgi?id=286707) is an open Safari 18 issue where an OffscreenCanvas using WebGL becomes blank, especially under memory pressure. The worker-message direction is not implicated.
- [WebKit bug 296300](https://bugs.webkit.org/show_bug.cgi?id=296300) records a flaky WebKit timeout in the WebGL2 OffscreenCanvas `transferToImageBitmap` conformance test. It concerns frame transfer, whereas Patchies observed continued frame messages.
- [WebKit bug 281656](https://bugs.webkit.org/show_bug.cgi?id=281656) reports memory growth during high-bandwidth worker transfers while Web Inspector is open. It does not report one-way message dispatch stopping.
- [WebKit bug 286297](https://bugs.webkit.org/show_bug.cgi?id=286297) is a fixed iOS WebGL issue where a particular valid GLSL declaration caused context loss and stopped rendering. This is useful precedent for shader-dependent iOS failures, but Patchies did not observe context loss and its worker continues running.
- WebKit added WebGL support for OffscreenCanvas in workers in Safari 17, according to [WebKit Features in Safari 17.0](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/). This is a relatively young WebKit path, but its age does not identify the present cause.

## Why Development and Production Are Different

Vite documents a material difference for workers imported with `?worker`: development relies on native browser module loading, while a production build compiles the imports and emits a separate worker chunk. See [Vite: Web Workers](https://vite.dev/guide/features.html#web-workers).

Vite also applies worker build plugins separately. Its documentation states that normal `config.plugins` apply to workers in development, while `worker.plugins` must be configured for production worker bundles. See [Vite: Worker Options](https://vite.dev/config/worker-options.html).

Patchies has additional production differences:

- `ui/src/lib/canvas/GLSystem.ts` imports the renderer through `renderWorker?worker`.
- `ui/vite.config.ts` sets the worker output format to ES modules.
- `ui/vite.config.ts` applies `minifyExceptShaderParkCore()` to production worker builds.
- That plugin runs Terser with `module: true`, `compress: true`, and `mangle: true` on every worker chunk except a chunk containing `shader-park-core`.
- Terser's [`module` option](https://terser.org/docs/api-reference/#minify-options) permits module-level compression and mangling assumptions. Function and class names are not preserved by default. Property mangling is not enabled by this Patchies configuration.
- Production bundling also performs module linking and tree-shaking. Rollup documents these transformations in its [tree-shaking explanation](https://rollupjs.org/faqs/#what-is-tree-shaking).

The current local production artifact gives another concrete difference. Hydra and Shader Park are loaded as dynamic worker chunks. Those chunks import helper exports back from the main render-worker chunk. The main render-worker chunk is wrapped in generated top-level-await support. Development instead evaluates the source module graph through Safari's native module loader.

This does not prove that bundling is the bug. It identifies a production-only module topology and execution order that the development test does not exercise.

Pure minification of the Hydra and Shader Park library code is not a complete shared explanation: Patchies intentionally does not minify the chunk containing `shader-park-core`, while the Hydra chunk is minified. However, both paths still execute through a minified render-worker entry and minified Patchies bridge code.

The production service worker is another difference from Vite development. It may affect which artifact version is loaded, but it is unlikely to explain a deterministic freeze inside one already-running worker unless mixed cached chunks or an old worker artifact are present. A fresh production preview on a new local origin should separate build output from deployed service-worker cache behavior.

## Ranked Explanations

1. **Production worker transformation or chunk topology.** Compression, mangling, tree-shaking, generated top-level-await code, or dynamic-chunk relationships change code or execution timing used by both high-risk renderers.
2. **A WebKit WebGL/OffscreenCanvas defect exposed by production timing or generated shaders.** The production artifact changes when and how the same graphics operations are issued.
3. **Worker event-loop non-yielding in production.** A production-only task or microtask sequence lets render callbacks or local callbacks continue but prevents queued message tasks from running.
4. **A WebKit implicit-message-port dispatch defect.** Historical precedent exists, but no current exact report was found.
5. **Deployment cache mismatch.** Possible on `patchies.app`, but it should not reproduce on a fresh local production origin if caching is the cause.

## Recommended Test Matrix

Use the same production build, device, patch, URL origin, and rendering settings. Change one build variable at a time.

1. Build the normal production artifact and confirm the failure.
2. Disable `minifyExceptShaderParkCore()` only for the render-worker build. Keep Rollup bundling enabled.
3. Restore the plugin but use Terser with `compress: false` and `mangle: false`.
4. Test `compress: true, mangle: false`, then `compress: false, mangle: true`.
5. Keep minification unchanged and disable worker tree-shaking, or preserve all module side effects.
6. Keep transformations unchanged and test a single-file worker artifact if practical. This removes dynamic worker chunk boundaries and the import edges back to the entry chunk.
7. Test a fresh local production origin without the production service worker controlling it.

Each artifact should report four independent counters:

- main-thread messages submitted to the worker, with a sequence number;
- worker message-handler acknowledgements for those sequence numbers;
- a worker `setInterval` heartbeat;
- worker render-frame and worker-to-main frame-message counts.

Interpret the result carefully:

- If the interval heartbeat and render frames continue but acknowledgements stop, an implicit-port or task-source defect becomes more likely.
- If render frames continue but the interval heartbeat and acknowledgements both stop, the render callback or graphics integration is preventing normal worker tasks from running.
- If disabling a specific build transformation restores acknowledgements, reduce that transformation to the smallest changed output before assigning the cause to Safari.
- If every production artifact fails but equivalent unbundled code works, reduce the built worker to a standalone WebKit reproduction and file a WebKit bug.

## Answer

Safari has known worker-message and OffscreenCanvas/WebGL bugs, but I found no known issue that is an exact match for Patchies.

The observation that only the production build fails materially weakens the claim that Safari independently stops worker messages. It does not rule out WebKit: a WebKit bug can depend on code shape, shader shape, module topology, or timing. It does mean that Patchies should treat the generated worker artifact as the next primary suspect and run the build matrix before describing the root cause as a Safari message scheduler bug.
