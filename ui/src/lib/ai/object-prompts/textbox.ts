export const textboxPrompt = `## textbox Object Instructions

Multi-line text input for user text entry.

CRITICAL RULES:
1. No code needed - configuration only
2. Outputs current text on bang
3. Accepts string input to set text

Messages:
- Receives: bang (outputs current text)
- Receives: string (sets text content)
- Outputs: string (current text)

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (receives text to set content)
- Message outlet: "message-out" (sends current text on bang)
- LIMITATION: Single I/O ports

Example - Text Input:
\`\`\`json
{
  "type": "textbox",
  "data": {
    "text": "Enter your text here..."
  }
}
\`\`\``;
