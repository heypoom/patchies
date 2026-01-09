export const pythonPrompt = `## python Object Instructions

Python code execution using Pyodide in the browser.

CRITICAL RULES:
1. Full Python 3 standard library available
2. Great for data processing and numerical computation
3. Use print() for output
4. Runs in browser via Pyodide

Available:
- Full Python standard library
- send(data): send messages to outlets
- recv(callback): receive messages from inlets
- setPortCount(inlets, outlets): set message ports

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (single)
- Message outlet: "message-out" (single)
- LIMITATION: Single inlet/outlet only

Example - Simple Calculation:
\`\`\`json
{
  "type": "python",
  "data": {
    "code": "import math\\n\\nresult = math.sqrt(16)\\nprint(f\\"Result: {result}\\")"
  }
}
\`\`\`

Example - Data Processing:
\`\`\`json
{
  "type": "python",
  "data": {
    "code": "def fibonacci(n):\\n    a, b = 0, 1\\n    result = []\\n    for _ in range(n):\\n        result.append(a)\\n        a, b = b, a + b\\n    return result\\n\\nfib = fibonacci(10)\\nprint(fib)"
  }
}
\`\`\``;
