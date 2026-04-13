# Enabling AI

## AI will always be optional

AI is optional with Patchies. By default, Patchies has no AI features enabled, and it has to be explicitly opted in.

We believe in giving users the choice to use AI as a tool for code generation without forcing it on everyone. AI-enabled features are either hidden or disabled unless an API key is present.

- You can toggle visibility in **Settings** (`Cmd/Ctrl + ,`) under **AI → Show AI features**.
- You can also use the command palette (`Cmd/Ctrl + K` → `Toggle AI Features`) to quickly toggle AI features.

## Be mindful about API key security

Your API keys are currently stored in your browser. We do not manage or have access to your keys in any way.

Therefore, they can be stolen by malicious patches you open. Use a separate API key with strict budget limits. Never load patches from strangers when an API key is set.

## Features using AI

These features use AI to help you with your patch:

- [Edits](/docs/ai-edits): Create and edit objects using natural language
- [Chat](/docs/ai-chat): Chat with an AI assistant about your patch
- [Patch to App](/docs/ai-patch-to-app): Convert your patch into a standalone HTML app

## Objects using AI

These objects use AI to generate content within your patch:

- [ai.tts](/docs/objects/ai.tts) - Text-to-speech synthesis
- [ai.stt](/docs/objects/ai.stt) - Speech-to-text transcription
- [ai.txt](/docs/objects/ai.txt) - Generate text using AI
- [ai.img](/docs/objects/ai.img) - Generate images using AI
- [ai.music](/docs/objects/ai.music) - Generate music using AI

Be mindful of copyright and ethical considerations when generating content with AI, especially for public or commercial projects that goes beyond private prototyping or experimentation.

## See Also

- [Adding Objects](/docs/adding-objects)
- [Demos](/docs/demos)
