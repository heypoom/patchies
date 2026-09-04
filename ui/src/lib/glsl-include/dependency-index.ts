import { resolveVfsIncludeCandidates } from './vfs-paths';

const QUOTED_INCLUDE_RE = /^[ \t]*#include\s+"([^"]+)"/gm;

export type GlslConsumer = {
  id: string;
  code: string;
};

type ReadSource = (path: string) => string | undefined;

export function findQuotedGlslIncludes(source: string): string[] {
  const includes: string[] = [];
  QUOTED_INCLUDE_RE.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = QUOTED_INCLUDE_RE.exec(source)) !== null) {
    includes.push(match[1]);
  }

  return includes;
}

export class GlslDependencyIndex {
  private consumersByPath = new Map<string, Set<string>>();

  rebuild(consumers: GlslConsumer[], readSource: ReadSource): void {
    this.consumersByPath.clear();

    for (const consumer of consumers) {
      this.collectConsumerDependencies(consumer, readSource);
    }
  }

  getConsumers(path: string): Set<string> {
    return new Set(this.consumersByPath.get(path) ?? []);
  }

  private collectConsumerDependencies(consumer: GlslConsumer, readSource: ReadSource): void {
    const visited = new Set<string>();

    const visit = (source: string, importerPath: string) => {
      for (const specifier of findQuotedGlslIncludes(source)) {
        if (
          specifier.startsWith('http://') ||
          specifier.startsWith('https://') ||
          (!specifier.startsWith('./') &&
            !specifier.startsWith('../') &&
            !specifier.startsWith('patch://') &&
            !specifier.startsWith('user://'))
        ) {
          continue;
        }

        const candidates = resolveVfsIncludeCandidates(specifier, importerPath);
        let dependency: string | undefined;
        let dependencySource: string | undefined;

        for (const candidate of candidates) {
          let consumers = this.consumersByPath.get(candidate);
          if (!consumers) {
            consumers = new Set();
            this.consumersByPath.set(candidate, consumers);
          }

          consumers.add(consumer.id);

          const source = readSource(candidate);
          if (source !== undefined) {
            dependency = candidate;
            dependencySource = source;
            break;
          }
        }

        dependency ??= candidates[0];

        if (visited.has(dependency)) continue;
        visited.add(dependency);

        if (dependencySource !== undefined) visit(dependencySource, dependency);
      }
    };

    visit(consumer.code, 'patch://');
  }
}
