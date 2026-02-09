/**
 * Builds the direct template prompt from patch data.
 * No LLM call needed - this is instant.
 */

import type { CleanedPatch } from './patch-transformer';
import { patchToJson } from './patch-transformer';
import { getContextForTypes, getImplementationHints } from './context-injector';

export interface TemplateOptions {
  patchName?: string;
  steeringPrompt?: string;
}

/**
 * Builds a complete LLM-ready prompt/specification from a cleaned patch.
 */
export function buildDirectTemplate(patch: CleanedPatch, options: TemplateOptions = {}): string {
  const { patchName, steeringPrompt } = options;
  const { metadata } = patch;

  const sections: string[] = [];

  // Title
  const title = patchName
    ? `# ${patchName} - Implementation Specification`
    : '# Patch Implementation Specification';
  sections.push(title);

  // User requirements (steering prompt)
  if (steeringPrompt?.trim()) {
    sections.push(`## User Requirements\n\n${steeringPrompt.trim()}`);
  }

  // Patch overview
  const nodeTypeSummary = metadata.nodeTypes.join(', ');
  sections.push(`## Patch Overview

- **${metadata.nodeCount} nodes**: ${nodeTypeSummary}
- **${metadata.edgeCount} connections**
- **Node types**: ${nodeTypeSummary}`);

  // Data flow graph (JSON)
  const patchJson = patchToJson(patch);
  sections.push(`## Data Flow Graph

\`\`\`json
${patchJson}
\`\`\``);

  // Node details
  const nodeContext = getContextForTypes(metadata.nodeTypes);
  sections.push(`## Node Details

${nodeContext}`);

  // Implementation hints
  const hints = getImplementationHints(metadata.nodeTypes);
  if (hints.length > 0) {
    const hintsList = hints.map((h) => `- ${h}`).join('\n');
    sections.push(`## Implementation Notes

${hintsList}`);
  }

  return sections.join('\n\n');
}

/**
 * Estimates the size of the generated template in characters.
 * Useful for deciding if we need to trim content.
 */
export function estimateTemplateSize(patch: CleanedPatch, options: TemplateOptions = {}): number {
  const template = buildDirectTemplate(patch, options);
  return template.length;
}

/**
 * Size threshold in characters (50KB).
 * If template exceeds this, we should consider trimming.
 */
export const SIZE_THRESHOLD = 50 * 1024;

/**
 * Checks if the template is too large and may need trimming.
 */
export function isTemplateTooLarge(patch: CleanedPatch, options: TemplateOptions = {}): boolean {
  return estimateTemplateSize(patch, options) > SIZE_THRESHOLD;
}
