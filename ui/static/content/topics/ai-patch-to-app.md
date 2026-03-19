# Patch to App

![Patch to App dialog](/content/images/patch-to-app.webp)

Convert your patch into a standalone HTML application. This feature analyzes your patch's objects, connections, and code to generate a self-contained app.

## How to Use

1. Press `Ctrl/Cmd + K > Patch to App`. Alternatively, use the expand button on the sidebar and select "Patch to App"
2. Optionally describe what you want to build in the steering prompt (e.g., "Simple HTML page with sliders, dark theme")
3. Choose one of:
   - _Copy Spec_ - Copy the spec to use with other AI tools
   - _Generate App_ - Generate and the app directly in Patchies

## Refine with AI

Check the "Refine spec with AI" option for better results. This uses AI to improve the specification before generating, making the output more accurate (but slower).

## App Preview

After generating, the app appears in the sidebar preview tab where you can:

- View the live preview in an embedded iframe
- Describe changes in natural language (e.g., "Make the background gradient", "Add a reset button")
- Reload the preview
- Export the HTML or Markdown specification
- View the app full-screen

## Tips

- Use the 🎲 button to get random example prompts for inspiration
- Edit the generated spec manually before generating if needed
- The "Refine first" option is slower but produces better results
- You can iterate on the generated app using AI Edit without regenerating from scratch

## See Also

- [Enabling AI](/docs/enabling-ai)
- [AI Edits](/docs/ai-edits)
- [Chat](/docs/ai-chat)
