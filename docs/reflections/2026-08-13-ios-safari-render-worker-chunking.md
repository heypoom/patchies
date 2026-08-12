# iOS Safari Render Worker Chunking

**Date:** 2026-08-13

## Objective

Fix a production-only rendering freeze on iOS Safari. Adding a `hydra` or `shaderpark` node froze the shared visual output and prevented later controls from taking effect. Development builds, macOS Safari, and visual nodes such as `glsl`, `regl`, and `three` did not reproduce the same failure.

## What Made This Difficult

The visible symptom suggested that the render worker had stopped, but the rendering profiler still reported draw calls. A `three` preview could also continue animating after the freeze while fullscreen and control changes stopped working. Those observations allowed several explanations:

- Safari might have stopped delivering main-thread messages to a live worker.
- `OffscreenCanvas`, WebGL, or `ImageBitmap` transfer might have stalled.
- A renderer could have damaged shared WebGL state.
- Production minification or tree-shaking could have changed runtime behavior.
- The production worker module graph could have created two independent runtime owners.

The iOS simulator was not a useful substitute because it did not reproduce the real device's worker rendering behavior. Safari Web Inspector was also initially unavailable until the physical device, cable connection, Web Inspector setting, and macOS inspection setting were all active. Even after inspection worked, manual production testing remained slow enough that each build needed to answer several questions at once.

## Diagnostic Strategy

The useful breakthrough was to instrument every boundary of the rendering pipeline and show it inside Patchies instead of depending on DevTools. The diagnostic panel recorded:

- main-thread liveness;
- every main-to-worker message with a sequence number;
- worker acknowledgements and round-trip time;
- worker timer heartbeats;
- render-loop ticks;
- output and preview bitmap creation;
- worker-to-main frame posting;
- main-thread frame receipt and presentation;
- worker and main instance identities;
- message errors, worker errors, and WebGL context loss.

This separated “the worker is alive” from “the same worker runtime is receiving commands and producing the displayed frames.” That distinction was essential.

Before the freeze, messages, acknowledgements, render ticks, and frame presentation advanced together. After adding Hydra, diagnostics revealed two worker runtime IDs inside one main-thread worker relationship:

- the original runtime stopped acknowledging new control messages but continued rendering its stale graph and posting frames;
- a second runtime acknowledged new messages but owned no active render graph and produced no frames.

The browser was therefore not simply dropping messages. The displayed frames and the current message handler belonged to different runtime installations in the same worker global.

## Generated Artifact Inspection

The production artifact explained why development worked. Hydra and ShaderPark were emitted as dynamic worker chunks. Those chunks imported helpers back from the generated render-worker entry, which was wrapped by top-level-await transformation code. On iOS Safari, loading one of those chunks could re-evaluate the side-effectful entry:

1. The first evaluation created `FBORenderer`, installed `self.onmessage`, and started the render loop.
2. Loading Hydra or ShaderPark traversed a chunk edge back to the worker entry.
3. A second evaluation created another `FBORenderer` and replaced `self.onmessage`.
4. The first render loop survived and kept posting frames from its old graph.
5. New messages reached the second renderer, so the visible output appeared frozen and controls no longer affected it.

This topology existed only in the production worker bundle. Vite development served a different native module graph, which explains the production-only reproduction.

## What Did Not Work

### Treating the symptom as worker message starvation

“The worker stopped handling inbound messages” described part of the observation, but it was not the root cause. Counters without runtime identity made two worker installations look like one worker that had become partially unresponsive.

The better question was: which runtime received the message, and which runtime produced the frame?

### Searching for a matching WebKit worker bug

WebKit has related historical bugs involving `MessagePort`, worker lifetime, `OffscreenCanvas`, and WebGL. None exactly matched a worker that continued timers and outbound frame transfer while apparently losing only inbound commands. The research was useful for ruling out premature certainty, but it did not identify the Patchies failure.

### Changing Terser settings

Building without the custom Terser configuration did not fix the freeze. Minification was a production difference, but it was not the load-bearing difference.

### Adding an idempotent asynchronous bootstrap

An intermediate fix made the worker entry store a dynamic-import promise on the worker global before importing the render runtime. Its generated topology looked safer, but on the real iPhone the worker runtime did not start correctly: even a basic GLSL node rendered black with no preview or output.

The bootstrap added another asynchronous module boundary before `self.onmessage` installation. Bundle inspection alone could not prove that the worker had actually initialized on iOS Safari. Restoring the direct worker entry fixed startup.

This failed attempt reinforced an important rule: validate observable rendering, not only generated import structure.

### Relying on the simulator or desktop Safari

Neither environment reproduced the device-specific production behavior. The physical iPhone running the production build was the authoritative test target.

## The Proven Fallback

Setting `worker.rollupOptions.output.inlineDynamicImports` in Vite proved the diagnosis. The render worker remained the direct, side-effectful entry, but all internal renderer dependencies were emitted into one JavaScript module.

The resulting production artifact has:

- one `renderWorker-*.js` file;
- no internal render-worker chunk directory;
- no Hydra or ShaderPark module edge back to the worker entry;
- one `FBORenderer`, one message handler, and one render-loop owner per worker global.

On a physical iPhone running iOS Safari, GLSL, Hydra, and ShaderPark all rendered correctly. Diagnostics showed exactly one main instance and one worker runtime. Acknowledgements, heartbeats, render ticks, bitmap creation, frame receipt, and presentation all continued without errors or WebGL context loss. This established that the production chunk topology was the load-bearing cause.

The tradeoff was too large for the final implementation: the unminified production render worker grew to approximately 11.8 MB and stopped lazy-loading every renderer dependency.

## Preserving Lazy Loading

The refined fix combines ownership protection with explicit chunk topology:

1. `renderWorkerEntry.ts` is a small facade with no renderer state.
2. `renderWorker.ts` exposes one deep interface, `installRenderWorkerRuntime()`, which owns `FBORenderer`, `self.onmessage`, services, build serialization, and render-loop state.
3. `installRenderWorkerRuntimeOnce()` records installation on the worker global before calling the installer. Re-evaluating the entry cannot create a second runtime owner. Failed startup clears the flag so installation may be retried.
4. Rollup assigns `renderWorker.ts` and its static dependencies to a neutral manual chunk. Lazy renderer chunks may import this core, but cannot import the side-effectful entry facade.
5. The entry participates in the top-level-await dependency graph so the generated facade waits for the transformed core before calling its installer. This avoids the black-startup failure seen with the asynchronous dynamic-import bootstrap.

The refined production artifact restores the original loading profile:

- the entry facade is approximately 0.5 KB;
- the initial neutral core is approximately 1.35 MB, close to the original split worker;
- Hydra and ShaderPark remain separate lazy chunks;
- 34 internal lazy chunks remain available;
- no lazy chunk imports the entry facade;
- lazy chunks that need shared helpers import the neutral core instead;
- an automated ownership test verifies that two install attempts against the same worker global create one runtime.

This architecture addresses the problem at two levels. The chunk graph removes the known entry cycle, while the worker-global guard preserves one runtime owner if a browser or future build transformation evaluates the facade again.

The refined split-worker build was verified on a physical iPhone using the production preview. GLSL started normally, and adding Hydra and ShaderPark did not freeze previews, output, or controls. This confirmed that lazy loading could be preserved without reintroducing the duplicate-runtime failure.

## Debugging Practices That Worked

1. **Use the exact failing environment early.** Test the production artifact on the physical iPhone. Development, simulator, and desktop results were not interchangeable.
2. **Instrument boundaries, not just activity.** A render counter proves that something rendered. It does not prove that the active message handler and visible frame producer share the same state.
3. **Attach sequence and instance identities.** Message sequence numbers found the handoff point; main and worker IDs exposed duplicate ownership.
4. **Make diagnostics visible in the product.** An on-screen panel made repeated device testing and log capture possible without depending on remote inspection.
5. **Inspect generated code.** Source-level reasoning could not reveal the production chunk cycle. The emitted artifact was part of the program and needed direct inspection.
6. **Change one build variable at a time.** Testing no-Terser, bootstrap, and single-file builds independently identified chunk topology as the load-bearing variable.
7. **Verify both structure and behavior.** Artifact checks caught module topology; only a rendered GLSL/Hydra/ShaderPark test on the phone proved runtime correctness.
8. **Treat browser-bug theories as hypotheses.** A platform-specific result can still be caused by application bundle structure that only triggers a browser-specific execution path.

## What Could Be Better

- Add an automated production smoke test that creates a render worker, builds a simple GLSL graph, and asserts that a non-empty preview frame is presented. Current unit tests mock worker construction and cannot detect worker startup failures.
- Add a build-time artifact check for the render-worker invariant. This should inspect emitted Rollup metadata rather than assert source text.
- Make worker runtime ownership explicit in architecture so global message handlers, render-loop state, and graph state cannot be installed independently.
- Reduce the manual build-test cycle. A small production fixture containing GLSL, Hydra, and ShaderPark would make physical-device verification faster and more consistent.
- Revisit worker size only with a topology-aware design and real iOS production validation.

## Action Items

- Keep the worker entry facade separate from the neutral renderer core.
- Preserve the synchronous install-once guard; do not introduce a dynamic-import bootstrap before runtime installation.
- Keep lazy renderer chunks from importing the entry facade.
- Add a production render smoke-test seam when practical.
- Require emitted-graph inspection and physical iOS testing for GLSL, Hydra, ShaderPark, controls, preview, and fullscreen output when worker chunking changes.
