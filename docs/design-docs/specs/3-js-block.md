# 3. JavaScript Block

I want to build a new node that takes in JavaScript code, and runs it.

It should be almost exactly like the P5.js canvas node, but instead of a canvas, it should run JavaScript code and show it in a console.

I think instead of separate canvas and code areas, we can have the virtual console below the CodeEditor.

## Primary Button API

`js` exposes `setPrimaryButton('code' | 'settings' | 'run')` to user scripts.
The runtime persists the choice in `node.data.primaryButton` and notifies the UI,
including when code runs without a mounted view.

| Mode | Large body button | Secondary floating button | Overflow actions |
| ---- | ----------------- | ------------------------- | ---------------- |
| Default / `run` | Run / Pause | Edit code | Settings, console |
| `settings` | Settings | Run / Pause | Edit code, console |
| `code` | Edit code | Run / Pause | Settings, console |

Settings actions appear only when visible settings fields exist. A requested
`settings` mode without visible fields uses the default run layout until fields
become available. The stored choice remains `settings`.

With the virtual console visible, execution stays in the console:

| Mode | Console action | Floating button | Overflow actions |
| ---- | -------------- | --------------- | ---------------- |
| Default / `run` / `code` | Run / Pause | Edit code | Settings, console |
| `settings` | Run / Pause | Settings | Settings, Edit code, console |

Without visible settings fields, expanded `settings` mode shows the Edit code
floating button until fields become available.

Run / Pause uses the existing execution and cleanup behavior, including active
message, timer, and graph subscriptions. Code and settings actions use existing
editor/sidebar preferences. Switching layouts preserves the stored mode. Explicit
`run` is stored as `run`; an unset mode defaults to `run` for `js`.

This layout applies only to `js`. Other code-block objects keep their current
body run button and floating primary action. CodeMirror completion hints, the
AI prompt, and object documentation describe the `js` modes.
