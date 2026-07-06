export const numericOperatorsPrompt = `## Numeric Operator Object Instructions

Text objects for simple numeric arithmetic on control messages:
- + n adds n to incoming numbers
- - n subtracts n from incoming numbers
- * n multiplies incoming numbers by n
- / n divides incoming numbers by n

Inlet 0 is hot: a number is transformed and emitted immediately.
Inlet 1 is cold: a number updates the right operand without outputting.
Division by zero outputs 0.

Examples:
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "* 0.5"
  }
}
\`\`\`

\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "+ 12"
  }
}
\`\`\`

Common Patterns:
- Use * 0.5 to scale a control value down
- Use + 1 or - 1 to offset counters and indexes
- Use / 2 to halve values without writing an expr object
- Use expr for formulas that need multiple variables or more than one operation`;
