# 24. Python Node via Pyodide

We want to add a browser Python environment to Patchies, using the Pyodide library <https://pyodide.org>

- Use the `PyodideSystem` singleton to provision the Pyodide environment for each nodes.
  - Use `PyodideSystem.create(nodeId, { messageContext })` to retrieve a Pyodide instance for a specific node.
  - See other nodes on how to create a MessageContext.
- This should be a visual node called `PythonNode.svelte`, and should the node be named `python`

Features:

- Allows you to run multiple isolated instances of Python code in the browser, using Pyodide.
- Uses the `CodeEditor.svelte` Svelte component to provide a code editor.
- Should have a console that logs what we printed.
  - We emitted the `pyodideConsoleOutput` event via the event bus, so you can listen to that in the Svelte component. Make sure to filter by your `nodeId`.
  - Should be able to clear the console.

Future Features:

- Implement `stdin` via the component.
- Python REPL.
- 2D and 3D Canvases.
