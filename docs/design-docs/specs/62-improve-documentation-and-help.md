# 62. Improve Documentation for Patchies

## Motivation & Pain Points

- Our README.md is 2,400 lines long. This makes it impossible to read without using CTRL+F and searching for specific objects, even worse than using man pages.
- I want to have documentation sites similar to Max and Pd, but don't want to duplicate the content. Patchies already runs on the web using SvelteKit, after all!
- We are a bit _inconsistent_ in how we document things in-app:
  - `trigger` uses a help button that opens a side panel.
  - `mqtt`, `ai.tts`, `tts`, `vdo.ninja.pull` and `vdo.ninja.push` uses a tooltip that quickly shows the inlet and outlet messages.
  - I honestly love both patterns: small tooltip for really accessible messages, and help button that lets you read things without opening the docs. I just wish its applied more consistently, without duplicating information.

## Design Ideas

Here are some rough design ideas worth discussing:

- In-app help sidebar for objects.
  - We already have a sidebar with 4 tabs: files, presets, saves and packs. I think adding a `help` tab might be a good idea?
- In-app tooltip inlet for in/out messages
  - We already do this for `mqtt`, `ai.tts`, `tts`, `vdo.ninja.pull` and `vdo.ninja.push`. It's good to serve as a quick reference when the message names are already self-explanatory (e.g. `subscribe`), and you just need a quick way to jog the memory without diving into `help`.
- Single source of truth for all features
  - For in and out messages in particular, I feel that we can define the schema ONCE and use it everywhere: in the ts-pattern handleMessage matcher (so docs and object stays consistent always, never out-of-sync), in the quick message reference tooltip, in the help sidebar, etc.
- Interactive help files for each objects
  - Max and Pd does this, and it's wonderful. Instead of reading text or static images and videos, you can actually PLAY with Patches.
  - The way Max does it is that `help <object-name>` opens the Help patch for the object, and it shows multiple tabs each with its own use cases. Last tab is `?` which opens the reference in the web browser.
  - We are already on the web though, and we are using SvelteKit (quite powerful for working with content!), so maybe the reference can either be _in-app_ (e.g. sidebar, modal) or in a separate SvelteKit route? Either way, it can share the same information by e.g. reading from Markdown using some SvelteKit mechanism.
  - We kinda already have this in the form of _demo_ patch in `ExamplesTab.ts`, but it needs to be per-object.
  - Tricky part is that right now Patchies doesn't have a Tab system, and opening a patch in other tab might accidentally override each other's `autosave` in localStorage as we only have a single `autosave` key I think. (Maybe we need to isolate the localStorages?)
