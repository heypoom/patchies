/** Object types that support #include directives for GLSL imports */
export const GLSL_IMPORT_OBJECTS = new Set(['glsl', 'regl', 'swgl', 'three']);

export const GLSL_IMPORTS_GUIDELINES = `# GLSL #include Directives

Import GLSL functions using \`#include\`:

- **NPM packages**: \`#include <lygia/generative/snoise>\`
   - from shader libraries like [lygia](https://lygia.xyz)
   - when you need GLSL utilities, use Lygia shader library or
     other known NPM packages. Try to not write your own where possible.
- **URLs**: \`#include "https://raw.githubusercontent.com/stegu/psrdnoise/main/src/psrdnoise2.glsl"\`

The \`.glsl\` extension is optional. Nested includes are supported; circular includes error.`;
