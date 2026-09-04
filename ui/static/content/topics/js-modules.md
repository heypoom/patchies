# JS Modules

Import npm packages and share code between objects to organize and reuse patch logic.

## Importing Packages

Use the `npm:` prefix to import packages from npm through [esm.sh](https://esm.sh):

```javascript
import Matter from "npm:matter-js";
import { uniq } from "npm:lodash-es";

console.log(uniq([1, 1, 2, 2, 3])); // [1, 2, 3]
```

Use `await` to import a package dynamically:

```javascript
// Using a full URL
const { uniq } = await import("https://esm.sh/lodash-es");

// Using the shorthand (equivalent)
const { uniq } = await esm("lodash-es");
```

> **Note**: Patchies does not support `import * as X from "npm:..."`. Use named or default imports.

## Patch Modules

Patch modules are small JavaScript files stored with your patch. Use them for utilities that should travel with a saved or shared patch without taking up canvas space.

### Create and import a module

1. Open **Files** and create `math.js` under **Patch**.
2. Add an exported function, then save the file:

```javascript
export const double = (value) => value * 2;
```

3. Import it from a `js` object:

```javascript
import { double } from "math";

send(double(21)); // 42
```

You can organize modules in folders and use relative paths. A module resolves relative imports beside its own file:

```javascript
// patch://visual/camera.js
import { clamp } from "../math.js";
```

Use a full VFS path when you want ownership to be explicit:

```javascript
import { camera } from "patch://visual/camera.js";
import { sharedTool } from "user://scripts/shared-tool.js";
```

Only `.js` is inferred. Write the `.mjs` extension when importing an `.mjs` file.

Saving a Patch module runs its direct and indirect importers again. An unsaved Files editor draft does not affect running objects.

## Canvas scripts

Canvas `js` objects execute scripts, but they are not importable modules. Create a Patch JavaScript file in **Files** to share code between nodes. You can drag a Patch `.js` or `.mjs` file to the canvas to create an editor-only mirror; it still has the file as its single source of truth.

> **Note**: Top-level variables belong to one object. Each object has its own scope. Use message passing or named channels to send values between objects at runtime.

## See Also

- [JavaScript](/docs/javascript-runner) — Use the core JavaScript API for messages and timers.
- [JS Integrations](/docs/js-integrations) — Use AI, presentation controls, and GPU texture formats.
- [Message Passing](/docs/message-passing) — Learn how objects exchange data.
