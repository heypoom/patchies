export const stackPrompt = `## stack Object Instructions

LIFO (last-in, first-out) message buffer. Push messages onto a stack, bang to pop them off.

CRITICAL: This is a text object created via the "object" node type with data.expr.

Usage: stack

Inlets:
- Inlet 0: push any message onto the top of the stack
- Inlet 1 (hot): bang → pop top item and send to outlet; send "clear" to empty; send "size" to output count

Example:
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "stack"
  }
}
\`\`\`

Common Patterns:
- Connect a msg node sending { "type": "bang" } to inlet 1 to pop items
- Connect a msg node sending { "type": "clear" } to inlet 1 to empty the stack
- Connect a msg node sending { "type": "size" } to inlet 1 to get the current count
- Stack outputs nothing if empty when bang is received`;
