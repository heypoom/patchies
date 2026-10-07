# LLM API

Call AI models from your patch with `llm()` for text, conversations, visual context,
and frontend tools.

## How It Works

`llm()` sends your input to the AI provider configured in Patchies and returns a
text reply.

For conversations, you have to maintain the history yourself. Use `llm.turn()`
to retain reasoning metadata and tool results alongside each reply.

An API key is needed. Configure the provider with `Ctrl/Cmd + K > AI Provider Settings`.

## Try It

1. Create a `js` object (`Enter` → type `js`).
2. Paste the first example below into its editor.
3. Run the object and read the generated colors in the console.

Call the configured AI provider from a patch:

```javascript
const result = await llm("Generate a JSON list of 5 colors");
console.log(result);
```

## Options

Select a provider and model for a specific call, or attach an image node's id:

```javascript
// Override the model for a specific call
const haiku = await llm("Write a haiku about recursion", {
  provider: "openrouter",
  model: "anthropic/claude-haiku-4-5",
});

// Choose which LLM provider to use
// Must be configured in AI provider settings
const haiku = await llm("Write a haiku about recursion", {
  provider: "openrouter",
  
  // you can also specify the model for the provider here
});

// Include a visual object's current frame as context
const description = await llm("What's in this frame?", {
  imageNodeId: "canvas-1",
});
```

## Conversations

Pass an array of turns to continue a conversation.

Start and end with a `user` turn and alternate `user` and `assistant` roles. `llm()` returns the next reply
as a string. You need to maintain the history yourself.

```javascript
const chat = [{ role: "user", content: "Suggest a name for a blue planet." }];
const reply = await llm(chat);

chat.push({ role: "assistant", content: reply });
chat.push({ role: "user", content: "Give it a shorter name." });

console.log(await llm(chat));
```

Use `llm.turn()` to preserve the provider's hidden reasoning state along with the
reply. It returns an assistant turn that you can append directly.

Keep its `state` unchanged and use the same provider and model on later calls.
Both helpers accept these returned turns.

```javascript
const options = { provider: "gemini", systemPrompt: "Keep your answers concise." };

const chat = [{ role: "user", content: "Suggest three colors for an ocean scene." }];
chat.push(await llm.turn(chat, options));
chat.push({ role: "user", content: "Make the second color brighter." });

const turn = await llm.turn(chat, options);
chat.push(turn);
console.log(turn.content);
```

- Calling `llm.turn()` does not modify your array or remember earlier calls.
  Each `llm.turn` request still needs to send all previous turns.
- Remove or summarize older turns when needed to fit your model's
  context limit.
- Text-only assistant turns retain their text but not hidden reasoning.
- Both `llm()` and `llm.turn()` support `provider`, `model`, `systemPrompt`, `temperature`, `topK`,
  `imageNodeId`, and `abortSignal`.
- The `imageNodeId` option captures the current frame for the
  last user turn. Chat history does not retain earlier frame captures.

## Streaming

Update a chat draft as text arrives with `onChunk(delta, text)`.

`delta` is the new fragment and `text` is the accumulated response for the
current model generation. Both `llm()` and `llm.turn()` accept this option.

```javascript
const history = [{ role: "user", content: "Tell me a short story about the ocean." }];

const turn = await llm.turn(history, {
  onChunk: (delta, text) => {
    send({ type: "chatDraft", text });
  },
});

history.push(turn);
send({ type: "chatReply", text: turn.content });
```

Each generation starts with `onChunk("", "")` to clear the draft. With tools,
this happens again after tool execution. Replace your draft with `text` to avoid
joining intermediate text onto the final answer. Append the completed turn to
history after awaiting it, preserving its reasoning state.

Callbacks run synchronously in your node. Throwing rejects the request. Cancelling
with `abortSignal` stops chunk delivery. The final awaited result stays the same, so
you can use it to commit the completed reply.

## Tools

Give the model tools to read or change your patch.

Define each tool with a name, a description, and a `run` handler. Parameter names map to types or JSON Schema
objects. Every declared parameter is required.

```javascript
const tools = {
  setBackground: {
    description: "Choose which visual node fills the background",
    parameters: { nodeId: "string" },
    run: ({ nodeId }) => {
      setBackgroundOutput(nodeId);
      
      return { applied: nodeId };
    }
  },
  readTempo: {
    description: "Read the patch tempo",
    run: () => ({ bpm: 120 })
  }
};

console.log(await llm("Use canvas-1 as the background", { tools }));
```

Shorthand types are `string`, `number`, `boolean`, `integer`, `object`, and `array`.
Use JSON Schema for enums, nested objects, and constraints:

```javascript
const tools = {
  chooseMood: {
    description: "Send a visual mood to connected nodes",
    parameters: {
      mood: {
        type: "string",
        enum: ["calm", "bright", "dark"]
      }
    },
    run: ({ mood }) => {
      send({ mood });
      
      return { selected: mood };
    }
  }
};

console.log(await llm("Choose a relaxing mood", { tools }));
```

Handlers run in your node's runtime and can be async. The `llm` function validates
tool arguments, awaits each handler, passes results back to the model, and continues
until it replies.

Return JSON-compatible values in tool call handlers. If a return value is missing,
the handler returns `null`. Unknown tools, invalid arguments, and handler errors
will fail the tool call.

Calls allow up to eight tool executions by default.

- Set `maxToolCalls` to another positive integer when needed.
- `abortSignal` stops the loop and stops waiting for handlers.
  It cannot stop a handler that is already running.

Use `llm.turn()` when continuing a tool conversation:

```javascript
const tools = {
  readTempo: {
    description: "Read the patch tempo",
    run: () => ({ bpm: 120 })
  }
};

const chat = [{ role: "user", content: "Read the tempo and suggest a visual rhythm." }];
chat.push(await llm.turn(chat, { tools }));
chat.push({ role: "user", content: "Suggest a slower variation." });
chat.push(await llm.turn(chat, { tools }));

console.log(chat.at(-1).content);
```

The returned state retains intermediate tool calls, results, and reasoning
metadata. Append it unchanged and keep using the same provider and model.

## See Also

- [Enabling AI](/docs/enabling-ai) — Configure your AI provider and API key.
- [JS Integrations](/docs/js-integrations) — Other APIs available in patch code.
- [JavaScript](/docs/javascript-runner) — Write and run JavaScript in your patch.
