# 187. Pure Data Object

Patchies should load Pure Data patches through `libpd-wasm` so Pd can act as an audio processor with Patchies message and audio connections.

## Scope

Add a dedicated runtime-managed audio object named `pd`.

- The node loads a `.pd` entry file from the Patchies virtual filesystem.
- Dropping a `.pd` file from the desktop or Files sidebar creates a `pd` node with that file as its entry patch.
- Dropping a desktop or VFS `.pd` file onto an existing `pd` node replaces its entry patch. Desktop files are first stored in `user://` so the node retains a stable VFS path.
- `.pd` files are accepted as portable text files in the `patch://` namespace.
- `libpd-wasm` and its full worklet are loaded only while at least one `pd` node is present. Registering the object must not fetch or initialize libpd.
- The runtime uses the full build: vanilla Pd, Cyclone, and ELSE.
- The initial node surface has one control-message inlet, one stereo audio inlet, and one stereo audio outlet. Message inlet and outlet handles discovered from the patch are added when exposed; an empty node does not show a message outlet.
- The control-message inlet accepts `{ type: 'set', key, value }`. `key` is a non-empty Pd receiver name. A Patchies bang, `null`, or `undefined` sends a Pd bang; a finite number sends a float; a string sends a symbol; and an array containing only finite numbers and strings sends a list. Unsupported values are ignored.
- The message inlet accepts `{ type: 'load', src }` for a VFS path or HTTP(S) URL and `{ type: 'load', code }` for an inline Pd source string.
- The message outlet forwards values from explicitly exposed Pd senders. Pd bangs become Patchies bang messages, floats become numbers, symbols become strings, lists become arrays, and other selectors become `{ type, values }` messages.
- MIDI conversion is outside the first release.
- The node persists its VFS entry path or HTTP(S) URL, discovered port metadata, exposed port IDs, and whether the user has configured the exposure set. External patch source remains runtime-only until edited.
- The node has separate floating code and settings buttons. Its code editor shows the currently loaded entry source.
- The code editor is available before a source is loaded so a patch can be authored from an empty node.
- The compact node body shows the external filename, `Inline patch` for source without external provenance, `Loading…` while loading, and `Load error` after a failed load. It shows `Choose a patch` only when no source has been loaded.
- Every `pd` node exposes `obj://<node-id>/patch.pd` in the Objects VFS tree, even before source is available. It is initially empty, shows the resolved VFS or URL source while `sourceCode` is `null`, then switches to the persisted buffer after the first edit. Runtime source is keyed by the current external path or URL so a previous source is not shown after switching files.
- The code editor provides lightweight syntax highlighting for Pd directives, record kinds, object names, values, substitutions, escaped symbols, messages, and text comments.
- `Cmd-/` and `Ctrl-/` toggle Patchies-only `//` line comments in the code editor. Before loading, disabled Pd items become inert text records so object ordinals stay stable, and connections touching disabled items are omitted. Commenting the line again restores the original item and wiring. Structural canvas and restore records cannot be commented out.
- Editing source or loading `{ type: 'load', code }` persists the Pd source in `sourceCode`. Editing a VFS- or URL-loaded patch keeps its external source field as provenance and, for VFS patches, continues loading sibling abstractions from the original directory. Loading a new VFS path or HTTP(S) URL clears `sourceCode` to `null`, so the new external source becomes authoritative. Source selection prefers `sourceCode`, then `sourceUrl`, then `vfsPath`. Code edits from either the node editor or Objects VFS participate in undo and redo.
- The runtime survives Svelte view culling. Removing the node closes its Pd runtime without closing Patchies' shared `AudioContext`.

## Patch Interface Discovery

Patchies analyzes the entry patch before loading it.

- Root-canvas `inlet`, `inlet~`, `outlet`, and `outlet~` objects are reliable abstraction ports. Inputs and outputs are each ordered from left to right by canvas position, with Pd record order breaking ties. Stable identities use the input/output side and that ordered index.
- Literal `receive`/`r` and `send`/`s` names are offered as best-effort message endpoints.
- Dynamic names containing Pd substitutions such as `$0` or `$1` are not exposed automatically.
- Named sends and receives may be internal patch implementation details, so discovery never exposes them without the user selecting them.
- Ports without a Pd name use positional labels such as `message inlet 1` and `audio outlet 2`.

On first analysis, all root abstraction ports are exposed by default and named endpoints remain unselected. After the user changes the selection, Patchies preserves that explicit exposure set across reloads. Loading or editing a source resets the configured-state flag so the newly analyzed patch can establish a fresh default set.

The settings panel groups discovered message inputs, audio inputs, message outputs, and audio outputs. Checked message entries become handles on that `pd` node. A message arriving at an exposed named receiver handle is sent directly to that receiver; one arriving at an exposed abstraction inlet is sent through a generated host receiver. The first two selected abstraction audio inputs and outputs map, in discovered order, to the left and right channels of the node's fixed stereo audio handles. Additional selected audio ports remain visible in settings but are not connected.

## Runtime Wrapper

When any selected root-canvas abstraction port needs host wiring, Patchies generates a wrapper patch that instantiates the entry `.pd` file as an abstraction. It connects selected message inputs and outputs to node-specific host receivers and senders, and connects up to two selected audio inputs and outputs to `adc~ 1 2` and `dac~ 1 2`. Standalone patches without selected abstraction ports load directly, preserving their own `adc~` and `dac~` routing.

Literal named receivers do not need wrapper wiring: `{ type: 'set', key, value }` and exposed named-input handles send directly to the named Pd receiver. Selected named senders and wrapper senders are subscribed through libpd and routed to their corresponding Patchies message outlets.

For VFS sources, the Pd virtual filesystem contains the entry patch and all descendant `.pd` files beneath its containing directory, preserving relative paths so local abstractions resolve. An edited VFS entry replaces only that file in the collected bundle. URL and inline-code loads contain only the entry patch. Binary patch assets are outside the first release because the current library file API accepts patch source strings.

Patchies runs libpd's compatibility check against the compiled user entry and its sibling files, not the generated wrapper. Compatibility warnings are logged for diagnosis but do not prevent libpd from attempting to load the patch.

## Audio Worklet

The published `libpd-wasm` full worklet currently initializes libpd with zero audio inputs. Patchies carries a minimal dependency patch until upstream supports configurable input channels.

- The worklet initializes two Pd input and two Pd output channels.
- Web Audio input is copied into libpd's interleaved input buffer before each process call.
- Missing input channels are zero-filled.
- Libpd's stereo output is exposed through the Patchies audio outlet.
- The patched runtime caches worklet registration per `AudioContext` and worklet URL so multiple `pd` nodes do not call `audioWorklet.addModule()` repeatedly.
- Patchies passes its shared `AudioContext` to `createPd`; `pd.close()` must not close that context.

## Lazy Loading

The `pd` object module does not statically import `libpd-wasm` or its worklet asset. Creation dynamically imports both the JavaScript API and `libpd-worklet-full.js?url`. The application build may emit the worklet asset, but startup and patches without `pd` must not request or initialize it. The PWA asset manifest must not eagerly precache the worklet.

## Verification

- Unit-test root-canvas port discovery, named endpoint discovery, dynamic-name exclusion, stable port identities, and wrapper generation.
- Unit-test `set` conversion for bang, float, symbol, and list values, plus invalid receiver names and unsupported values.
- Unit-test Pd-to-Patchies bang, float, symbol, list, and arbitrary-selector conversion.
- Unit-test editor line-comment toggling, stable object ordinals, disabled connections, nested canvases, and structural-record rejection.
- Test VFS entry loading, sibling abstraction collection, missing files, and invalid patches.
- Test that VFS and HTTP(S) loads retain source only in runtime memory, code edits persist `sourceCode`, and later external loads clear it to `null`.
- Test the `obj://<node-id>/patch.pd` projection before load, after an external source resolves, after source switching, and after an edit commits the persisted buffer.
- Test async creation, repeated and concurrent loads, stale-load cleanup, and destruction without closing the shared audio context.
- Test settings selection persistence and undo/redo through rendered behavior.
- Run a browser smoke test with audio entering `[inlet~]`, leaving `[outlet~]`, a named receiver controlled by `set`, and a selected message outlet.
- Build the application and verify that the full worklet is split from the initial JavaScript and is not present in the PWA precache manifest.
