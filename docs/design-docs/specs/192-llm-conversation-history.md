# 192. LLM Conversation History

## Behavior

`await llm(input, options?)` accepts a string or a non-empty conversation array of
`{ role: 'user' | 'assistant', content: string }` turns and returns the next reply
as a string. The caller appends replies and follow-up requests. Calls never mutate
or retain caller history. Strings remain one user request, as explicitly requested.

For a portable initial contract, conversations start and end with a user turn and
alternate roles. Validate entries with indexed errors before making a provider request.
Snapshot input before asynchronous work. Normalize assistant to the internal model role.

Both main-thread and worker runtimes use the same execution path and options:
`provider`, `model`, `temperature`, `topK`, `systemPrompt`, `imageNodeId`, and
`abortSignal`. Signals remain local to workers; cancellation messages abort the
main-thread request. Stopping, rerunning, or destroying a worker node also cancels
its pending requests, removes abort listeners, and rejects local promises.
Late responses and tool results from cancelled requests are ignored.

Capture `imageNodeId` once and attach it to the final user turn. Text history does
not retain historical frames. Full supplied history is sent on every call; callers
control removal or summarization when approaching the selected model's context limit.

## Reasoning state

`await llm.turn(input, options?)` returns an assistant turn with `content` and
opaque `state`. Callers append that turn unchanged. Both helpers accept retained
state and replay complete Gemini parts (including signatures) or OpenRouter
reasoning blocks through `streamTurn()`. State is bound to provider, model, and
original answer text; reject mismatches. Snapshot it before asynchronous work.
Preserve sampling and system options. Frontend tool execution is described below.

Gemini streaming must retain signed text parts and signature-only parts, not
reconstruct them from plain text. OpenRouter reuses its existing reasoning block
accumulator and replay logic. Treat retained state as opaque and do not edit it.

## Verification

Test string shorthand, ordered conversation forwarding, indexed validation failures,
input snapshots, final-turn image attachment, options parity, worker cancellation,
and provider errors. Provider adapters already accept normalized conversation arrays.

## References

- [Gemini conversations](https://ai.google.dev/gemini-api/docs/generate-content/text-generation)
- [Gemini thought signatures](https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures)
- [OpenRouter reasoning](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)

## Frontend tools

Both helpers accept `tools: { [name]: { description, parameters?, run } }`.
`parameters` maps argument names to `string`, `number`, `boolean`, `integer`,
`object`, `array`, or JSON Schema objects. Every declared argument is required;
undeclared arguments are rejected. Omitted parameters mean no arguments.
Validate schemas before requests and validate model arguments before handlers.
Treat JSON Schema `format` keywords as annotations; retain strict schema validation
and collect all argument errors.

Execute handlers sequentially in the calling node's runtime, awaiting async results.
Results must be JSON-compatible; an omitted return becomes null. Handler failures,
unknown tools, invalid arguments, and invalid results reject the helper call.
`maxToolCalls` defaults to 8 and bounds total handler calls per invocation. Reject
an oversized batch before executing any of its handlers. Cancellation stops waiting
for handlers and prevents subsequent calls; it cannot undo handler side effects.
Gemini receives object results directly; arrays, null, and primitive results are
wrapped in `{ value: result }` for its function-response object.

`llm.turn()` retains intermediate model tool calls, their raw signed/reasoning state,
and user tool results in opaque `state.steps`. Re-expand those steps before the final
assistant turn on subsequent requests. No caller history mutation is needed.
Worker requests transfer definitions only; callbacks remain local. Main-thread
provider execution requests handler invocations through the existing worker bridge.

## Runtime activity

Both `js` and `worker` show running activity while `delay()`, `llm()`, or
`llm.turn()` is pending, including frontend tool execution. Finite work clears
its activity on success or failure. Concurrent calls keep the node active until
all calls settle. Persistent callbacks keep their existing activity independently.
Stopping or rerunning resets activity; late completions from an earlier run must
not clear activity from a newer run.

## Reactive history

Conversation snapshots accept reactive arrays and nested reactive turn/state objects
from frontend frameworks without importing a framework-specific unwrapping API.
Materialize arrays and plain objects before cloning; retain complete reasoning
state and tool traces. Snapshot synchronously before lazy imports, frame capture,
or worker messaging so later caller mutations do not affect the request.

## Streaming callbacks

Both helpers accept synchronous `onChunk(delta, text)` callbacks. `delta` is the
new text fragment; `text` is accumulated text for the current model generation.
Each generation starts with `onChunk('', '')`, including generations after tool
execution. Final string/assistant-turn return values and retained state stay the
same. Callback exceptions reject the request. No callbacks run after cancellation,
completion, or failure. Running activity lasts until the final request settles.

Worker callbacks stay local. Request messages carry a streaming flag and no
functions; the main-thread proxy sends ordered request-scoped chunk messages.
Ignore messages for settled requests. A worker callback exception aborts the
provider request and rejects the local promise.
