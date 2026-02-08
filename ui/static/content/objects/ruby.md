Run Ruby code directly in the browser using
[ruby.wasm](https://ruby.github.io/ruby.wasm/).

Full Ruby standard library available.

## Available Functions

- `emit data` - send data to all outlets
- `emit data, to: n` - send data to specific outlet (0-indexed)
- `recv { |data, meta| ... }` - receive messages (auto-converted to Ruby types)
- `set_port_count(inlets, outlets)` - configure number of ports
- `set_title "title"` - set the node's title
- `flash` - flash the node
- `puts`, `p`, `warn` - console output

> **Note**: Use `emit` instead of `send` (Ruby's built-in `send` method
> conflicts with JS interop).

## Example

```ruby
# Double incoming numbers
recv { |data, meta| emit(data * 2) }
```

## See Also

- [python](/docs/objects/python) - Python code environment
- [js](/docs/objects/js) - JavaScript code block
