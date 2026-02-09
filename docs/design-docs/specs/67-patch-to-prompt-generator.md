# 67. Patch-to-Prompt Generator

Generate LLM-friendly prompts/specifications from patches, enabling users to recreate patch functionality in their own projects (websites, workshops, standalone apps).

## Pain Point / Motivation

Users often ask:

- "How do I turn this into a simpler UI for my workshop?"
- "I like this patch! How do I implement this in my website?"

The headless API for seamless embedding is far out, but LLMs can bridge this gap now. Given a well-structured prompt with patch context, coding assistants like Claude Code can implement equivalent functionality.

## User Flow

1. User has a working patch they want to export
2. Opens "Generate Prompt" dialog (via command palette or menu)
3. Enters a **steering prompt** describing what they want (blank input, freeform)
4. System immediately generates a **direct template** (no LLM, instant)
5. User can:
   - View the generated prompt
   - Edit it (unlock with pencil button, read-only by default)
   - Copy to clipboard
   - Download as `.txt` or `.md` file
6. Optionally: click "Clean up with AI" to have Gemini refine into a more concise spec
7. Copy/download the refined version

## Requirements

### Steering Input

- Blank textbox for freeform steering prompt
- **Dice button**: randomizes from a pool of example prompts
- No validation - user can type anything (or leave empty)
- Examples shown in placeholder or documentation:
  - "Simple HTML page with sliders, dark theme"
  - "React component with Tailwind styling"
  - "Vanilla JavaScript, no dependencies, minimal UI"
  - "p5.js standalone sketch"
  - "Workshop handout explaining the audio synthesis"

### Direct Template (Instant, No AI)

Generated immediately from:

1. **Cleaned patch JSON** - strip visual-only fields (position, selected, measured, etc.)
2. **Object context** - inject relevant descriptions from existing AI prompts
3. **User's steering prompt** - included verbatim

Template structure:

```markdown
# Patch Implementation Specification

## User Requirements

[User's steering prompt, if any]

## Patch Overview

[Auto-generated summary: X nodes, Y connections, node types used]

## Data Flow Graph

[Cleaned JSON representation of nodes and edges]

## Node Details

[For each unique node type: description, inputs, outputs, key parameters]

## Implementation Notes

[Platform hints based on node types: Web Audio API, Canvas, etc.]
```

### AI-Cleaned Spec (Optional, Requires Gemini)

- Button: "Clean up with AI" or "Refine with Gemini"
- Only available if user has Gemini API key set
- Calls Gemini to:
  - Interpret the patch semantically
  - Generate a more human-readable specification
  - Tailor to user's steering prompt
  - Remove JSON verbosity where possible
- Shows loading state during generation
- Result replaces or appears alongside direct template

### Output Actions

Both versions support:

- **Copy to clipboard** - single click, show toast confirmation
- **Download as file** - `.txt` or `.md`, filename like `patch-spec-{timestamp}.md`

### Editability

- Preview area is **read-only by default**
- **Unlock button** (pencil icon) enables editing
- Edits persist until dialog closes
- User can edit before copying/downloading

## Technical Design

### Patch Transformation

```ts
interface CleanedPatch {
  nodes: CleanedNode[];
  edges: CleanedEdge[];
  metadata?: {
    nodeCount: number;
    edgeCount: number;
    nodeTypes: string[];
  };
}

interface CleanedNode {
  id: string;
  type: string;
  data: unknown; // Keep semantic data, strip UI state
  // Omit: position, selected, measured, dragging, etc.
}

interface CleanedEdge {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  // Omit: id, type, selected, animated, style, etc.
}
```

**Fields to strip from nodes:**

- `position`, `positionAbsolute`
- `selected`, `dragging`, `draggable`
- `measured`, `width`, `height`
- `zIndex`, `parentId`, `expandParent`

**Fields to strip from edges:**

- `id` (use source/target as identifier)
- `selected`, `animated`
- `style`, `markerEnd`, `markerStart`
- `type` (edge rendering type, not semantic)

### Context Injection

Reuse existing infrastructure from `multi-object-resolver.ts`:

- `getObjectSpecificInstructions(type)` - detailed prompts per object
- `OBJECT_TYPE_LIST` - available object types
- `jsRunnerInstructions` - for JS-enabled nodes

For each unique node type in the patch, include its object description.

### Size Management

If total prompt exceeds threshold (e.g., 50KB):

1. First pass: trim verbose code from node data (e.g., large GLSL shaders)
2. Second pass: summarize rather than include full object descriptions
3. Third pass: truncate JSON with `[... N more nodes]` indicator

### File Structure

```
src/lib/ai/patch-to-prompt/
  patch-transformer.ts     # Clean patch JSON
  context-injector.ts      # Gather object descriptions
  template-builder.ts      # Assemble direct template
  spec-refiner.ts          # LLM refinement - uses Gemini
  code-generator.ts        # HTML code generation - uses Gemini
  example-prompts.ts       # Pool for dice button
  index.ts                 # Main exports

src/lib/components/dialogs/
  PatchToPromptDialog.svelte  # Main UI

src/lib/components/sidebar/
  AppPreviewView.svelte    # Preview iframe in sidebar

src/stores/
  app-preview.store.ts     # Generated HTML storage
```

## UI Components

### PatchToPromptDialog

```svelte
<!-- Trigger via command palette: "Generate Implementation Prompt" -->
<Dialog>
  <DialogHeader>
    <h2>Generate Implementation Prompt</h2>
  </DialogHeader>

  <DialogBody>
    <!-- Steering input -->
    <div class="steering-section">
      <label>Describe what you want to build:</label>
      <div class="input-row">
        <textarea placeholder="e.g., Simple HTML page with sliders..." />
        <button title="Random example"><Dice /></button>
      </div>
    </div>

    <!-- Generated prompt preview -->
    <div class="preview-section">
      <div class="preview-header">
        <span>Generated Prompt</span>
        <button title="Edit" on:click={toggleEdit}><Pencil /></button>
      </div>
      <textarea readonly={!editing} value={generatedPrompt} />
    </div>
  </DialogBody>

  <DialogFooter>
    <button on:click={refineWithAI} disabled={!hasApiKey}>
      Clean up with AI
    </button>
    <button on:click={copyToClipboard}><Copy /> Copy</button>
    <button on:click={downloadFile}><Download /> Download</button>
  </DialogFooter>
</Dialog>
```

## Example Output

### Direct Template Example

````markdown
# Patch Implementation Specification

## User Requirements

Simple HTML page with sliders controlling oscillator frequency and volume, dark theme

## Patch Overview

- 4 nodes: slider, slider, tone~, object (out~)
- 3 connections
- Node types: slider, tone~, object

## Data Flow Graph

```json
{
  "nodes": [
    {
      "id": "n1",
      "type": "slider",
      "data": { "min": 20, "max": 2000, "value": 440 }
    },
    {
      "id": "n2",
      "type": "slider",
      "data": { "min": 0, "max": 1, "value": 0.5 }
    },
    { "id": "n3", "type": "tone~", "data": { "waveform": "sine" } },
    { "id": "n4", "type": "object", "data": { "expr": "out~" } }
  ],
  "edges": [
    { "source": "n1", "target": "n3", "targetHandle": "message-in-0" },
    { "source": "n2", "target": "n3", "targetHandle": "message-in-1" },
    {
      "source": "n3",
      "target": "n4",
      "sourceHandle": "audio-out",
      "targetHandle": "audio-in-0"
    }
  ]
}
```
````

## Node Details

### slider

A horizontal slider that outputs numeric values...
[Full description from object prompts]

### tone~

An audio oscillator node using Tone.js...
[Full description from object prompts]

### object (out~)

Audio output to speakers via Web Audio API...
[Full description from object prompts]

## Implementation Notes

- Requires Web Audio API (AudioContext)
- Consider Tone.js library for oscillator abstraction
- Slider → Oscillator frequency mapping: 20-2000 Hz range

````

### AI-Cleaned Example

```markdown
# Theremin-Style Synthesizer

## What It Does
A simple synthesizer with two sliders:
- **Frequency slider** (20-2000 Hz): Controls the oscillator pitch
- **Volume slider** (0-1): Controls the output volume

The oscillator produces a sine wave that plays through the speakers.

## Implementation Guide

### HTML Structure
- Two range inputs with labels
- Play/Stop button (audio context requires user gesture)

### JavaScript
1. Create AudioContext on user interaction
2. Create OscillatorNode (sine wave)
3. Create GainNode for volume control
4. Connect: Oscillator → Gain → Destination
5. Map slider values:
   - Frequency: `oscillator.frequency.value = freqSlider.value`
   - Volume: `gain.gain.value = volSlider.value`

### Styling (Dark Theme)
- Background: #18181b (zinc-900)
- Text: #fafafa (zinc-50)
- Sliders: Custom styling with accent color

### Code Skeleton
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: #18181b; color: #fafafa; font-family: system-ui; }
    /* ... */
  </style>
</head>
<body>
  <div class="synth">
    <label>Frequency: <input type="range" id="freq" min="20" max="2000" value="440"></label>
    <label>Volume: <input type="range" id="vol" min="0" max="1" step="0.01" value="0.5"></label>
    <button id="toggle">Play</button>
  </div>
  <script>
    // Web Audio setup...
  </script>
</body>
</html>
````

````

## Implementation Plan

### Phase 1: Core Utilities ✅

1. **patch-transformer.ts** ✅
   - `cleanPatch(nodes, edges)` → `CleanedPatch`
   - Strip visual-only fields
   - Generate metadata (counts, types)

2. **context-injector.ts** ✅
   - `getContextForTypes(types: string[])` → object descriptions
   - Reuse `getObjectSpecificInstructions` from multi-object-resolver

3. **template-builder.ts** ✅
   - `buildDirectTemplate(patch, steering, context)` → string
   - Markdown formatted output

4. **example-prompts.ts** ✅
   - Array of example steering prompts
   - `getRandomPrompt()` function

### Phase 2: UI ✅

5. **PatchToPromptDialog.svelte** ✅
   - Steering input with dice button
   - Preview area (read-only/editable toggle)
   - Copy/download buttons
   - Wire up to template builder

6. **Command palette integration** ✅
   - Add "Patch to Prompt" command
   - Opens dialog with current patch

### Phase 3: AI Refinement ✅

7. **spec-refiner.ts** ✅
   - `refineSpec(patch, options)` → refined spec
   - Uses Gemini 2.0 Flash model
   - Error handling for missing API key

8. **Update dialog** ✅
   - Added "Refine" button with Sparkles icon
   - Loading state during generation (spinner)
   - "AI Refined" badge when refinement is complete
   - Opens GeminiApiKeyDialog if no API key is set

### Phase 4: Polish (TODO)

9. **Size management**
   - Detect oversized prompts
   - Implement trimming strategies

10. **UX refinements**
    - Toast on copy success ✅
    - Filename with patch name if available ✅
    - Keyboard shortcuts (Cmd+C to copy)

### Phase 5: Generate & Preview ✅

11. **code-generator.ts** ✅
    - `generateCode(spec)` → HTML string
    - Uses Gemini 2.0 Flash
    - Extracts HTML from markdown code blocks

12. **app-preview.store.ts** ✅
    - Stores generated HTML
    - `hasAppPreview` derived store

13. **AppPreviewView.svelte** ✅
    - Sidebar view for preview
    - Uses iframe with srcdoc
    - Refresh, copy HTML, open in new tab buttons

14. **SidebarPanel updates** ✅
    - Preview tab icon (AppWindow) appears only when content exists
    - 'preview' added to SidebarView type

15. **Dialog updates** ✅
    - Generate button (green, Code icon) next to Refine
    - Opens sidebar to preview tab on success

## Example Steering Prompts (for dice button)

```ts
const EXAMPLE_PROMPTS = [
  "Simple HTML page with sliders, dark theme",
  "React component with Tailwind CSS",
  "Vanilla JavaScript, no dependencies",
  "p5.js standalone sketch",
  "Svelte component for portfolio embedding",
  "Workshop handout with code explanations",
  "Node.js script for headless audio processing",
  "Vue 3 component with composition API",
  "Single HTML file, CDN dependencies only",
  "TypeScript module with full type definitions",
  "Minimal implementation, just the core logic",
  "Mobile-friendly responsive design",
];
````

## Decisions

1. **Trigger**: Command palette only (no toolbar button)
2. **Patch name**: Include in output header if available
3. **Steering persistence**: No, don't persist between sessions
