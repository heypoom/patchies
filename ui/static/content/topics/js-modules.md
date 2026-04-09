# JS Modules

Import npm packages and share code between objects to keep your patches organized and reusable.

## Importing Packages

Use the `npm:` prefix to import any package from npm (powered by [esm.sh](https://esm.sh)):

```javascript
import Matter from "npm:matter-js";
import { uniq } from "npm:lodash-es";

console.log(uniq([1, 1, 2, 2, 3])); // [1, 2, 3]
```

Or import dynamically with `await`:

```javascript
// Using a full URL
const { uniq } = await import("https://esm.sh/lodash-es");

// Using the shorthand (equivalent)
const { uniq } = await esm("lodash-es");
```

> **Note**: `import * as X from "npm:..."` is not yet supported. Use named or default imports instead.

## Shared Libraries

![Shared JavaScript libraries example](/content/images/patchies-js-modules.png)

Share code between multiple `js` objects using the `// @lib <name>` comment at the top of a js object. This turns it into a library that others can import from:

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

The library object shows a package icon in the patch. Any change to it automatically re-runs all importers.

> **Note**: Top-level variables are *not* shared between objects — each object has its own isolated scope. Use message passing or named channels to communicate values between objects at runtime.

## See Also

- [JavaScript](/docs/javascript-runner) — Core JS API: messaging, timers, and more
- [JS Integrations](/docs/js-integrations) — AI, presentation controls, and GPU texture formats
- [Message Passing](/docs/message-passing) — How objects exchange data
