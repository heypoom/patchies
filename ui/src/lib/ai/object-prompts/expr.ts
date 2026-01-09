export const exprPrompt = `## expr Object Instructions

Mathematical expression evaluator at control rate. Perfect for parameter mapping and control signals.

CRITICAL RULES:
1. Use $1, $2, ... $9 to create dynamic inlets
2. Each $N variable creates an inlet automatically
3. Result is sent as message when any inlet receives a value
4. Uses expr-eval library - supports full mathematical expression syntax

Available operators and functions:
- Arithmetic: +, -, *, /, ^, %
- Trigonometry: sin(), cos(), tan(), asin(), acos(), atan(), atan2()
- Math: sqrt(), abs(), ceil(), floor(), round(), log(), exp(), min(), max()
- Logic: ==, !=, <, >, <=, >=, and, or, not
- Conditionals: condition ? true_val : false_val
- Constants: PI, E

Multi-line support:
- Use semicolons to separate statements
- Last expression is the output
- Define variables: a = $1 * 2; b = $2 + 3; a + b
- Define functions: add(a, b) = a + b; add($1, $2)

HANDLE IDS (Auto-generated):
- Message inlets: "message-in-0", "message-in-1", ... (multiple indexed)
- Message outlet: "message-out" (single)
- Each $N variable creates indexed inlet: "message-in-0" for $1, "message-in-1" for $2
- LIMITATION: Single outlet only, multiple inputs

Example - Simple Addition:
\`\`\`json
{
  "type": "expr",
  "data": {
    "expr": "$1 + $2"
  }
}
\`\`\`

Example - Scale and Offset:
\`\`\`json
{
  "type": "expr",
  "data": {
    "expr": "$1 * 100 + 50"
  }
}
\`\`\`

Example - Sine Wave Mapping:
\`\`\`json
{
  "type": "expr",
  "data": {
    "expr": "sin($1 * PI * 2) * 0.5 + 0.5"
  }
}
\`\`\`

Example - Multi-line with Variables:
\`\`\`json
{
  "type": "expr",
  "data": {
    "expr": "scaled = $1 * 10;\\noffset = $2;\\nscaled + offset"
  }
}
\`\`\``;
