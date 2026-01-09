export const markdownPrompt = `## markdown Object Instructions

Markdown text renderer for documentation and formatted content.

CRITICAL RULES:
1. No code needed - markdown content only
2. Supports full Markdown syntax
3. Great for patch documentation

Messages:
- string: set markdown content

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (receives markdown string)
- LIMITATION: Display only, no outlets

HANDLE IDS (Auto-generated):
- LIMITATION: Display only, no inlets or outlets
- Configure via node data only

Example - Documentation:
\`\`\`json
{
  "type": "markdown",
  "data": {
    "content": "# My Patch\\n\\nThis patch does **amazing** things:\\n\\n- Feature 1\\n- Feature 2\\n- Feature 3"
  }
}
\`\`\`

Example - Instructions:
\`\`\`json
{
  "type": "markdown",
  "data": {
    "content": "## How to use\\n\\n1. Connect the slider to the frequency inlet\\n2. Press the button to start\\n3. Adjust parameters to taste"
  }
}
\`\`\``;
