export const queuePrompt = `## queue Object Instructions

FIFO (first-in, first-out) message buffer. Enqueue messages, bang to dequeue them in order.

CRITICAL: This is a text object created via the "object" node type with data.expr.

Usage: queue

Inlets:
- Inlet 0: enqueue any message at the back of the queue
- Inlet 1 (hot): bang → dequeue front item and send to outlet; send "clear" to empty; send "size" to output count

Example:
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "queue"
  }
}
\`\`\`

Common Patterns:
- Connect a msg node sending { "type": "bang" } to inlet 1 to dequeue items
- Connect a msg node sending { "type": "clear" } to inlet 1 to empty the queue
- Connect a msg node sending { "type": "size" } to inlet 1 to get the current count
- Queue outputs nothing if empty when bang is received
- Use with metro to drain the queue at a steady rate`;
