export const buttonPrompt = `## button Object Instructions

Simple button that sends a bang message when clicked.

CRITICAL RULES:
1. No code needed - configuration only
2. Outputs {type: 'bang'} when clicked
3. Flashes when receiving any message input

Messages:
- Receives: any message (triggers flash and outputs bang)
- Outputs: {type: 'bang'}

Example - Simple Button:
\`\`\`json
{
  "type": "button",
  "data": {}
}
\`\`\``;
