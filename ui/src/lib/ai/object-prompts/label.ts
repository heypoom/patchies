export const labelPrompt = `## label Object Instructions

Simple text label for displaying static text or annotations in your patch.

CRITICAL RULES:
1. No code needed - configuration only
2. No inlets or outlets - purely for display
3. Double-click to edit the label text
4. Supports multi-line text with newlines

Text Display:
- Shows the 'message' field as static text
- Editable via double-click or edit button
- Monospace font rendering
- Preserves whitespace and newlines

HANDLE IDS:
- None - label has no inlets or outlets

Example - Simple Label:
\`\`\`json
{
  "type": "label",
  "data": {
    "message": "label"
  }
}
\`\`\`

Example - Multi-line Label:
\`\`\`json
{
  "type": "label",
  "data": {
    "message": "Audio Section\\n-----------\\nMix controls"
  }
}
\`\`\`

Example - Comment/Annotation:
\`\`\`json
{
  "type": "label",
  "data": {
    "message": "TODO: Connect to reverb"
  }
}
\`\`\``;
