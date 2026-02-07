# 61. Visual `trigger` object with hover hints

I want to make the trigger (shorthand: t) a visual object with ample hints. Let me know if this makes sense

## Motivation

Our trigger/t textual object isn't super intuitive if you haven't used Max or Pd before. Our audiences are either creative coders using P5, Strudel or Hydra, programmers using JavaScript, so they likely have never heard of Pd and has no idea what "hot inlet", "cold inlet" and "trigger" remotely means.

As Patchies is likely the only webapp that follows the hot-cold Max/Pd convention, I'm sure this confuses the heck out of JavaScript users. We want to make it super visual and obvious.

## Design Idea

1. Hover on each item e.g. "b" and "a" to know what the heck these do. Max/Pd tend to do things like "t a b" and no one knows what that is. @ui/src/lib/components/nodes/ObjectNode.svelte already has the parameter hover mechanism for fixed parameters where it has both hover colors, underline and tooltip, so it makes it more friendly.
2. Add an inline help action button on the right side. (See pattern in nodes like `tone~` that shows code button on the right)
3. The new visual object must work with `t` too, not just `trigger`. We might need to store the original instantiated name. Defaults to nothing (falls back to "trigger"), while if u use shorthand u can set `shorthand: true` flag that shows `t`

---

4. Optional/later: some sort of button to trigger a visual simulation in the "Help" panel on the right side, so it can flash each parameter from right to left, and send a mock message?
