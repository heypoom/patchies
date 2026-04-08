/**
 * Shared instruction builder for AI resolvers.
 * Conditionally combines JS runtime, UI design, GLSL imports, and object-specific docs.
 * Used by single-object, multi-object, and edit resolvers to avoid duplication.
 */

import { JS_ENABLED_OBJECTS, jsRunnerInstructions } from './shared-jsrunner';
import { UI_DESIGN_OBJECTS, UI_DESIGN_GUIDELINES } from './ui-design-guidelines';
import { GLSL_IMPORT_OBJECTS, GLSL_IMPORTS_GUIDELINES } from './glsl-imports-guidelines';
import { getObjectSpecificInstructions } from '../object-descriptions';

/**
 * Builds combined instruction sections for a single object type.
 * Conditionally includes JS runtime, UI design, GLSL imports, and object-specific docs.
 */
export function buildObjectTypeInstructions(objectType: string): string {
  const parts: string[] = [];

  if (JS_ENABLED_OBJECTS.has(objectType)) {
    parts.push(`## Common JSRunner Runtime Functions\n\n${jsRunnerInstructions}`);
  }

  if (UI_DESIGN_OBJECTS.has(objectType)) {
    parts.push(UI_DESIGN_GUIDELINES);
  }

  if (GLSL_IMPORT_OBJECTS.has(objectType)) {
    parts.push(GLSL_IMPORTS_GUIDELINES);
  }

  parts.push(getObjectSpecificInstructions(objectType));

  return parts.join('\n\n---\n\n');
}

/**
 * Builds combined instruction sections for multiple object types (deduplicated).
 * Useful for multi-object generation where we want to inject shared sections only once.
 * Returns object with separate sections for flexible composition.
 */
export function buildMultiObjectInstructionParts(objectTypes: string[]): {
  jsInstructions: string;
  uiDesignInstructions: string;
  glslImportInstructions: string;
  objectInstructions: string;
} {
  const uniqueObjectTypes = [...new Set(objectTypes)];
  const jsEnabledTypes = uniqueObjectTypes.filter((t) => JS_ENABLED_OBJECTS.has(t));
  const uiDesignTypes = uniqueObjectTypes.filter((t) => UI_DESIGN_OBJECTS.has(t));
  const glslImportTypes = uniqueObjectTypes.filter((t) => GLSL_IMPORT_OBJECTS.has(t));

  return {
    jsInstructions:
      jsEnabledTypes.length > 0
        ? `## Common JSRunner Runtime Functions (applies to: ${jsEnabledTypes.join(', ')})\n\n${jsRunnerInstructions}`
        : '',

    uiDesignInstructions: uiDesignTypes.length > 0 ? UI_DESIGN_GUIDELINES : '',

    glslImportInstructions: glslImportTypes.length > 0 ? GLSL_IMPORTS_GUIDELINES : '',

    objectInstructions: uniqueObjectTypes
      .map((type) => getObjectSpecificInstructions(type))
      .join('\n\n---\n\n')
  };
}
