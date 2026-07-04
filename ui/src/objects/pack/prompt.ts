export const packPrompt = `## pack Object Instructions

Collect multiple inlet values and output them as one array/list. This is the complement of unpack.

CRITICAL: This is a text object created via the "object" node type with data.expr.

Usage:
- pack
- pack f s
- pack 440 symbol float

Supported arguments:
- f or float: float inlet initialized to 0
- s or symbol: symbol inlet initialized to an empty string
- a or any: any-message inlet initialized to null
- number: float inlet initialized to that number

Inlets:
- Inlet 0 is hot: number/symbol/any input updates the stored value and outputs the full list; bang outputs the current list
- Later inlets are cold: update stored values without output

Example:
\`\`\`json
{
  "type": "object",
  "data": {
    "expr": "pack f s"
  }
}
\`\`\`

Common Patterns:
- Use pack f f to combine x/y coordinates into [x, y]
- Use pack f s to combine numeric control values with symbolic labels
- Use pack f a to attach arbitrary metadata objects to a numeric value
- Send bang to inlet 0 to repeat the current packed list
- Pair with unpack when you need to split the list again downstream`;
