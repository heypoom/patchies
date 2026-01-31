export const rubyPrompt = `## ruby Object Instructions

Ruby code execution using ruby.wasm in the browser.

CRITICAL RULES:
1. Full Ruby standard library available
2. Use \`emit\` instead of \`send\` (Ruby's built-in \`send\` conflicts with JS interop)
3. Use puts/p/warn for console output
4. Data from JS is auto-converted to Ruby types (numbers, strings, arrays, hashes)

Available Functions:
- emit(data): send data to all outlets
- emit(data, to: n): send data to specific outlet (0-indexed)
- recv { |data, meta| ... }: receive messages (data auto-converted to Ruby types)
- set_port_count(inlets, outlets): configure number of ports
- set_title("title"): set the node's display title
- flash: flash the node visually
- puts(*args), p(*args), warn(*args): console output

HANDLE IDS (Auto-generated):
- Message inlet: "message-in" (single by default)
- Message outlet: "message-out" (single by default)
- Use set_port_count to add more inlets/outlets

Example - Double incoming numbers:
\`\`\`json
{
  "type": "ruby",
  "data": {
    "code": "recv { |data, meta| emit(data * 2) }"
  }
}
\`\`\`

Example - Filter and transform:
\`\`\`json
{
  "type": "ruby",
  "data": {
    "code": "recv do |data, meta|\\n  if data.is_a?(Numeric) && data > 10\\n    emit(data ** 2)\\n  end\\nend"
  }
}
\`\`\`

Example - Multiple outlets:
\`\`\`json
{
  "type": "ruby",
  "data": {
    "code": "set_port_count(1, 2)\\n\\nrecv do |data, meta|\\n  emit(data, to: 0)      # original\\n  emit(data * 2, to: 1)  # doubled\\nend"
  }
}
\`\`\`

Example - Working with arrays:
\`\`\`json
{
  "type": "ruby",
  "data": {
    "code": "recv do |data, meta|\\n  if data.is_a?(Array)\\n    emit(data.map { |x| x * 2 })\\n  end\\nend"
  }
}
\`\`\``;
