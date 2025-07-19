# 5. Serializing graph and context for LLM understanding

We should be able to serialize the patcher graph to a format that an LLM understands.

## Tools to expose to LLMs

- `get_graph(graph: PatchGraph) -> JSON`: returns the structure and properties of the graph
  - Properties marked as `large` and known large data types (e.g. `bytes`) in the schema will be omitted from `get_graph`. LLM needs to call `get_object_prop` get those large properties instead.
  - Internal state of objects are not sent to LLMs.
- `get_object(graph: PatchGraph, object_id: string) -> JSON`: returns the serialized object's structure, current properties and current state.
- `get_object_prop(graph: PatchGraph, object_id: string, prop: string, limit?: number)`: returns the value of a property.
  - `limit` defines the length to truncate the property, as bytes could be enormous for instance,
  - This bypasses the large data type safeguards above.

We should expose these in tool call / MCP tool formats as well.
