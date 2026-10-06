# 3. JavaScript Block

I want to build a new node that takes in JavaScript code, and runs it.

It should be almost exactly like the P5.js canvas node, but instead of a canvas, it should run JavaScript code and show it in a console.

I think instead of separate canvas and code areas, we can have the virtual console below the CodeEditor.

## Primary Button API

`js` exposes `setPrimaryButton('code' | 'settings' | 'run')` to user scripts.
The runtime persists the choice in `node.data.primaryButton` and notifies the UI,
including when code runs without a mounted view.

- `settings` makes settings the primary action when visible settings fields exist.
- `code` makes the code editor the primary action and is the default.
- `run` falls back to `code`, matching `worker`: the node body already runs code.
- Without visible settings fields, `settings` also displays the code action.

The API remains available in CodeMirror completions and the object documentation.
