# Patches Applied to @csound/browser

This document describes the patches applied to the upstream `@csound/browser` library to fix multi-instance support issues.

## Problem

The upstream library uses module-level globals in the AudioWorklet that get overwritten when multiple Csound instances are created. This causes:

- Previously running csound~ nodes to stop working
- Audio pops/glitches when new instances are created
- "Proxy has been released" errors

## Patches

### 1. `src/workers/worklet.singlethread.worker.js`

**Remove module-level globals** (around line 31-34):

```diff
- let renderSleep;
- let libraryCsound;
- let combined;
- const rtmidiQueue = [];
+ // PATCHED: Removed module-level globals that caused multi-instance issues
+ // These are now instance properties on the class
```

**Add instance properties in constructor** (after `this.rtmidiPort = undefined;`):

```javascript
// PATCHED: Instance-level state instead of module globals
this.renderSleep = undefined;
this.libraryCsound = undefined;
this.combined = undefined;
this.rtmidiQueue = [];
```

**Add instance method for callUncloned** (after constructor, before initialize):

```javascript
// PATCHED: callUncloned now uses instance's combined map
callUncl(k, arguments_) {
  const caller = this.combined.get(k);
  const returnValue = caller && caller.apply({}, arguments_ || []);
  return returnValue;
}
```

**Update initialize()** - change all `libraryCsound` to `this.libraryCsound` and `combined` to `this.combined`:

```diff
- libraryCsound = libcsoundFactory(wasm);
+ // PATCHED: Store libraryCsound on instance instead of module
+ this.libraryCsound = libcsoundFactory(wasm);

- this.callUncloned = callUncloned;
+ this.callUncloned = (k, args) => this.callUncl(k, args);

- this.csound = libraryCsound.csoundCreate(0);
+ this.csound = this.libraryCsound.csoundCreate(0);

- combined = new Map(Object.entries(allAPI));
+ // PATCHED: Store combined on instance instead of module
+ this.combined = new Map(Object.entries(allAPI));
```

**Update all other references** - Replace throughout the file:

- `libraryCsound.` → `this.libraryCsound.`
- `rtmidiQueue` → `this.rtmidiQueue`
- `renderSleep` → `this.renderSleep`

**Move singlethreadWorkerRender inside class** as an instance method:

```javascript
// PATCHED: Render function as instance method
async singlethreadWorkerRender(payload) {
  const csound = payload["csound"];
  const kr = this.libraryCsound.csoundGetKr(csound);
  // ... rest uses this.libraryCsound and this.renderSleep
}
```

**Update start() to use instance method**:

```diff
- singlethreadWorkerRender({
-   libraryCsound,
-   workerMessagePort: this.workerMessagePort,
-   wasi: this.wasi,
- })({ csound: cs })
+ // PATCHED: Render function now uses instance state
+ this.singlethreadWorkerRender({ csound: cs })
```

### 2. `src/mains/worklet.singlethread.main.js`

**Don't close AudioContext in terminateInstance()** (around line 78-82):

```diff
  async terminateInstance() {
    if (this.node) {
      this.node.disconnect();
      delete this.node;
    }
-   if (this.audioContext) {
-     if (this.audioContext.state !== "closed") {
-       await this.audioContext.close();
-     }
-     delete this.audioContext;
-   }
+   // PATCHED: Don't close the AudioContext - it was passed in from outside
+   // and the caller is responsible for its lifecycle
+   if (this.audioContext) {
+     delete this.audioContext;
+   }
```

## Rebuilding After Patches

After applying patches:

```bash
cd ui/packages/csound-browser
yarn install
yarn build:prod
```

## Syncing with Upstream

Run the sync script:

```bash
cd ui/packages/csound-browser
./sync-upstream.sh
```

This will:

1. Backup current patched files
2. Copy fresh source from upstream
3. Prompt you to re-apply patches
4. Rebuild
