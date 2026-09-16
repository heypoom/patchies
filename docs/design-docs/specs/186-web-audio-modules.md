# 186. Web Audio Modules

Patchies should load Web Audio Modules (WAM 2) as audio objects so a patch can use third-party instruments and effects without a bespoke object integration.

## Scope

Add a dedicated visual audio object named `wam~`.

- The object is runtime-managed by Audio V2 and remains active while its Svelte view is culled.
- It accepts one audio signal input, emits one audio signal output, and accepts MIDI plus WAM control messages on a message inlet.
- The view has a mount point for the WAM-provided GUI. Module URL, load, and save-state controls live in the standard settings menu.
- The settings menu makes the dynamic WAM community registry browser the primary loading path. It presents registry thumbnails when available; selecting a plugin copies its resolved entry URL into the module URL field and loads it. An opt-in custom URL field supports arbitrary WAM entry URLs.
- The settings menu and node context menu both control whether the selected node exposes resize handles.
- The settings menu includes a persisted mute-output toggle. It silences the host output gain without stopping the WAM.
- The settings menu has a flush, full-width **General** and **Parameters** tab rail at the top of the panel, with the standard floating close control outside the panel. General contains the module identity and runtime status followed by module loading and output/canvas controls. Parameters combines full-state save/copy actions with the dynamic parameter inspector, using the panel's full content area without a nested disclosure or scroll region.
- The same live General and Parameters interface is registered as the node's Settings sidebar target. Selecting a `wam~` node makes that interface available in the sidebar, and the node's Settings action follows the user's preferred floating-or-sidebar destination.
- The parameter inspector reads WAM parameter metadata and current values. Each parameter can be edited manually, and each parameter ID plus the current serializable WAM state can be copied to the clipboard. Manual parameter edits affect the live WAM instance and follow the same explicit **Save state** persistence model as edits made in the plugin GUI. Saving state refreshes the inspector so every displayed parameter reflects the values captured from the WAM.
- The settings menu uses a compact instrument-panel hierarchy: the top-level tabs separate routine setup from parameter work, module identity and runtime status appear only in General, community browsing is the primary source action, and output controls use labeled switches.
- Loading a WAM GUI fits the visual node to its measured dimensions; loading a different WAM clears the previous dimensions and recalculates the size. User-set width and height remain persisted in the patch until the WAM URL changes.
- Resizing the visual node scales the mounted WAM GUI to fill its available width and height while preserving the WAM GUI's aspect ratio. Resize handles cannot make the node smaller than the WAM GUI's measured native dimensions.
- WAM GUIs and their floating controls, such as popovers, may render outside the visual node bounds.
- The audio runtime creates one WAM host group per `AudioContext`, loads the WAM module, creates an instance, and destroys it with the Audio V2 node.
- Async work is scoped to the WAM instance that started it. A pending state save or replacement must not persist after another WAM becomes active, a superseded module load must destroy its late instance, and a GUI created after its mount was cancelled must be destroyed instead of attached.
- The persisted node data is `{ url, state, muted, resizable }`. `state` is an explicit snapshot from the WAM `getState()` API, `muted` controls Patchies' host output gain, and `resizable` controls whether the selected node exposes resize handles. Width and height remain standard node geometry.
- Patchies converts `noteOn`, `noteOff`, `controlChange`, `programChange`, `pitchBend`, `channelPressure`, `polyPressure`, and `raw` messages into WAM MIDI events. A Patchies message `time` is an absolute `AudioContext.currentTime` timestamp.
- The message inlet uses five commands: `set`, `save`, `load`, `mute`, and `unmute`. Its schema lists these WAM controls before the lower-priority MIDI message forms. `{ type: 'set', key, value }` changes one parameter, while `{ type: 'set', params }` changes several. A keyed `set` with `time` uses a WAM automation event; its optional `timeMode` matches Patchies parameter automation (`absolute` by default, or `relative`). `{ type: 'save' }` snapshots the current WAM state into the patch. `load` accepts `{ url }`, `{ state }`, or both: a URL-only load clears the previous module's saved state, a state-only load applies and persists that state on the current WAM, and a combined load creates the requested WAM with the supplied state and persists both. `{ type: 'mute' }` and `{ type: 'unmute' }` control the host output gain.

## First release limits

- `wam~` is an experimental remote-module loader. It does not validate URLs, pin versions, sandbox GUI code, or install and manage plugins. The community browser is discovery over the remote WAM registry, not a local package manager.
- Plugin audio ports are represented as one Patchies input and one output. Multi-bus routing and WAM event-to-Patchies-message output are future work.
- WAM state is saved only when the user clicks **Save state**, sends `{ type: 'save' }`, or explicitly supplies state in a `load` message. Generic plugin GUIs do not provide one dependable cross-plugin state-change subscription.
- The WAM GUI is a view attachment. Unmounting it must not destroy the audio runtime; remounting recreates the GUI through the live WAM instance.

## Object surface

```text
[audio] → [wam~] → [audio]
             ↑
           MIDI
```

The default URL points to the WAM community Big Muff effect, a known working WAM 2 module. Instrument WAMs can receive Patchies MIDI messages through the same message inlet.

## Verification

- Unit-test the simplified control-message schemas and dispatch, parameter automation timing, Patchies MIDI conversion, state persistence, and mute behavior with fake WAM instances.
- Verify community registry URL resolution, display-name fallback, GUI scaling, minimum dimensions, and size reset when the WAM URL changes.
- Verify the runtime node exists independently of the Svelte GUI, supports GUI detach/remount, destroys a late-created GUI after unmount, and ignores stale async state completions after replacing a WAM.
- Manually load the default remote WAM, confirm its GUI mounts, and route an audio signal through it.
