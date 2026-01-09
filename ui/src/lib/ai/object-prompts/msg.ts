export const msgPrompt = `## msg Object Instructions

Message object that stores and sends predefined messages.

CRITICAL RULES:
1. Message format is VERY specific - follow these rules exactly
2. Bare strings (e.g. "start") become objects: {type: 'start'}
3. Quoted strings (e.g. "'hello'") become JS strings: "hello"
4. Numbers (e.g. 100) become numbers: 100
5. JSON objects are sent as-is, supports JSON5 syntax

Message Format Rules:
- bang → {type: 'bang'}
- start → {type: 'start'}
- play → {type: 'play'}
- 'hello world' → "hello world" (string)
- "hello world" → "hello world" (string)
- 100 → 100 (number)
- 0.5 → 0.5 (number)
- {x: 1, y: 2} → {x: 1, y: 2} (object)
- [1, 2, 3] → [1, 2, 3] (array)

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (bang or any message triggers output)
- Message outlet: "message-out" (sends the configured message)

Example - Bang Message:
\`\`\`json
{
  "type": "msg",
  "data": {
    "message": "bang"
  }
}
\`\`\`

Example - String Message:
\`\`\`json
{
  "type": "msg",
  "data": {
    "message": "'hello world'"
  }
}
\`\`\`

Example - Number Message:
\`\`\`json
{
  "type": "msg",
  "data": {
    "message": "440"
  }
}
\`\`\`

Example - Object Message:
\`\`\`json
{
  "type": "msg",
  "data": {
    "message": "{type: 'loop', value: false}"
  }
}
\`\`\``;
