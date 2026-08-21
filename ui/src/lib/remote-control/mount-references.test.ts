import { describe, expect, it } from 'vitest';
import { objectPrompts } from '$lib/ai/object-prompts';
import { objectTypeToSlug } from '$lib/docs/object-slug';
import { mountPathToVfs } from '$lib/vfs/VfsMountTree';
import { mountReferences } from './mount-references';
import { posix } from 'node:path';

describe('mount-only references', () => {
  it('uses readable documentation names for operator prompts', () => {
    const files = new Map(mountReferences.map((entry) => [entry.path, entry.content]));

    expect(files.get('references/prompts/add.md')).toBe(objectPrompts['+']);
    expect(files.get('references/prompts/div.md')).toBe(objectPrompts['/']);
    expect(files.get('references/prompts/sub.md')).toBe(objectPrompts['-']);
    expect(files.get('references/prompts/mul.md')).toBe(objectPrompts['*']);
    expect(files.has('references/prompts/%2B.md')).toBe(false);
    expect(files.has('references/prompts/%2F.md')).toBe(false);
  });

  it('projects every source document and registered prompt without rewriting content', () => {
    const docs = import.meta.glob<string>('/static/content/**/*.md', {
      query: '?raw',
      import: 'default',
      eager: true
    });
    const files = new Map(
      mountReferences
        .filter((entry) => entry.kind === 'file')
        .map((entry) => [entry.path, entry.content])
    );

    for (const [path, content] of Object.entries(docs)) {
      expect(files.get(`references/docs/${path.slice('/static/content/'.length)}`)).toBe(content);
    }

    for (const [type, content] of Object.entries(objectPrompts)) {
      expect(files.get(`references/prompts/${objectTypeToSlug(type)}.md`)).toBe(content);
    }

    expect(files.size).toBe(Object.keys(docs).length + Object.keys(objectPrompts).length + 2);
    expect(mountReferences).toContainEqual({ path: 'references/docs/topics', kind: 'directory' });
  });

  it('rejects reference paths as VFS write targets', () => {
    expect(() => mountPathToVfs('references/docs/objects/glsl.md')).toThrow('Invalid mount path');
    expect(() => mountPathToVfs('.agents/skills/writing-patchies-object-code/SKILL.md')).toThrow(
      'Invalid mount path'
    );
  });

  it('ships a discoverable skill whose relative links resolve inside the mount', () => {
    const path = '.agents/skills/writing-patchies-object-code/SKILL.md';
    const entries = new Map(mountReferences.map((entry) => [entry.path, entry]));
    const skill = entries.get(path)!;

    expect(skill.kind).toBe('file');
    const links = [...skill.content!.matchAll(/\]\(([^)]+)\)/g)];
    expect(links.length).toBeGreaterThan(0);

    const mountedPaths = new Set([...entries.keys(), 'objects', 'patch']);
    for (const [, link] of links) {
      const resolved = posix.normalize(posix.join(posix.dirname(path), link)).replace(/\/$/, '');
      expect(mountedPaths.has(resolved), `Broken mounted skill link: ${link}`).toBe(true);
    }
  });
});
