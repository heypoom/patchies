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

## Shared Libraries

![Shared JavaScript libraries example](/content/images/patchies-js-modules.png)

This patch shows a shared JavaScript library.

Add the `// @lib <name>` comment at the top of a `js` object to make a library. Other `js` objects can import code from the library:

```javascript
// In a js object — add "// @lib utils" at the very top
// @lib utils
export const rand = (min, max) => Math.random() * (max - min) + min;
export class Vector { /* ... */ }
```

```javascript
// In any other js object
import { rand, Vector } from 'utils';
console.log(rand(0, 10));
```

The library object shows a package icon in the patch. When you change it, Patchies runs all importers again.

> **Note**: Top-level variables belong to one object. Each object has its own scope. Use message passing or named channels to send values between objects at runtime.

## See Also

- [JavaScript](/docs/javascript-runner) — Use the core JavaScript API for messages and timers.
- [JS Integrations](/docs/js-integrations) — Use AI, presentation controls, and GPU texture formats.
- [Message Passing](/docs/message-passing) — Learn how objects exchange data.
