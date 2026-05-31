export const peppermintPrompt = `## peppermint Object Instructions

Peppermint is a pipe-first data transformation language running through Pyodide.

CRITICAL RULES:
1. Use input() to read the latest inbound Patchies message
2. input() returns none before the first message arrives
3. Use print(value) to emit a message from the outlet
4. print(value) returns value, so it can end a pipeline
5. The object re-runs automatically whenever a message arrives

Example - Filter Rows:
\`\`\`json
{
  "type": "peppermint",
  "data": {
    "code": "input()\\n  |> filter(it.age >= 18)\\n  |> print()"
  }
}
\`\`\`

Example - Handle Missing Input:
\`\`\`json
{
  "type": "peppermint",
  "data": {
    "code": "match(input(),\\n  none: print(\\"waiting for input\\"),\\n  _:    input() |> print()\\n)"
  }
}
\`\`\``;
