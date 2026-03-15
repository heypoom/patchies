export const sampleratePrompt = `## samplerate~ Object Instructions

Outputs the current audio sample rate in Hz when triggered with a bang.

CRITICAL: This is a text object created via the "object" node type with data.expr.

Usage: samplerate~

Example:
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "samplerate~"
  }
}
\`\`\`

Common Patterns:
- Connect a loadbang to get sample rate on patch load
- Use with math objects for sample-rate-dependent calculations
`;
