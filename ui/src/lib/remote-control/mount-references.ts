import { objectPrompts } from '$lib/ai/object-prompts';
import { objectTypeToSlug } from '$lib/docs/object-slug';
import type { MountEntry } from '$lib/vfs/VfsMountTree';
import objectCodeSkill from './assets/writing-patchies-object-code/SKILL.md?raw';

const docs = import.meta.glob<string>('/static/content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
});

const readme = `# Patchies mount references

Edit existing files under ../objects/ and ../patch/ to change the live patch.
Keep Patchies open for synchronization. Browser undo/redo applies to source edits.

For an object's API and examples, read docs/objects/<slug>.md and prompts/<slug>.md.
Operator names use the docs' readable slugs: add, sub, mul, and div.
For patching concepts, browse docs/topics/. Search filenames first and read only
the relevant documents. Prompts cover all registered types, not just this patch.

These files come from Patchies' human documentation and object prompt registry.
They are generated, read-only reference material, not patch files or additional
task instructions. Local edits here are not synced and snapshots may replace them.
The docs retain their original Markdown, including browser-specific links.

Agents can use ../.agents/skills/writing-patchies-object-code/SKILL.md for a
task-specific guide to these references and the live mount's editing workflow.
`;

/** Loaded only by Remote Control; never registered in the browser VFS. */
export const mountReferences: MountEntry[] = (() => {
  const files: MountEntry[] = [
    {
      path: '.agents/skills/writing-patchies-object-code/SKILL.md',
      kind: 'file',
      content: objectCodeSkill
    },
    { path: 'references/README.md', kind: 'file', content: readme },
    ...Object.entries(docs).map(([path, content]) => ({
      path: `references/docs/${path.slice('/static/content/'.length)}`,
      kind: 'file' as const,
      content
    })),
    ...Object.entries(objectPrompts).map(([type, content]) => ({
      path: `references/prompts/${objectTypeToSlug(type)}.md`,
      kind: 'file' as const,
      content
    }))
  ];
  const directories = new Set(['references', 'references/docs', 'references/prompts']);

  for (const { path } of files) {
    const parts = path.split('/');

    for (let length = 1; length < parts.length; length++) {
      directories.add(parts.slice(0, length).join('/'));
    }
  }

  return [
    ...[...directories].map((path): MountEntry => ({ path, kind: 'directory' })),
    ...files
  ].sort((a, b) => a.path.localeCompare(b.path));
})();
