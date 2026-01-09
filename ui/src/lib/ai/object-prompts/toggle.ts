export const togglePrompt = `## toggle Object Instructions

Boolean toggle switch for on/off control.

CRITICAL RULES:
1. No code needed - configuration only
2. Outputs true/false boolean values
3. Visual state changes on click

Messages:
- Receives: boolean (sets toggle state)
- Receives: bang (toggles state)
- Outputs: boolean (true/false)

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (boolean or bang to toggle)
- Message outlet: "message-out" (sends boolean true/false)

Example - Toggle Switch:
\`\`\`json
{
  "type": "toggle",
  "data": {
    "value": false
  }
}
\`\`\``;
