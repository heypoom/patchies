export type PatchbaySection = 'message' | 'audio' | 'video';

export type PatchbayRoute = {
  from: string;
  to: string;
};

export type PatchbayDiagnosticSeverity = 'error' | 'warning';

export type PatchbayDiagnosticCode =
  | 'unknown-section'
  | 'statement-outside-section'
  | 'invalid-identifier'
  | 'unknown-channel'
  | 'duplicate-channel'
  | 'cycle'
  | 'malformed-route'
  | 'unused-channel'
  | 'duplicate-route'
  | 'receiver-as-source'
  | 'sender-as-target';

export type PatchbayDiagnostic = {
  severity: PatchbayDiagnosticSeverity;
  code: PatchbayDiagnosticCode;
  message: string;
  line: number;
  section?: PatchbaySection;
  name?: string;
};

export type PatchbayKnownChannels = Partial<Record<PatchbaySection, Set<string>>> & {
  objectTitles?: Set<string>;
  messageSources?: Set<string>;
  messageTargets?: Set<string>;
  audioSources?: Set<string>;
  audioTargets?: Set<string>;
  videoSources?: Set<string>;
  videoTargets?: Set<string>;
};

export type PatchbayAnalysis = {
  diagnostics: PatchbayDiagnostic[];
  messageRoutes: PatchbayRoute[];
  audioRoutes: PatchbayRoute[];
  videoRoutes: PatchbayRoute[];
  channels: Record<PatchbaySection, Set<string>>;
};

type SectionState = {
  declarations: Map<string, number>;
  declarationUseCount: Map<string, number>;
  routes: Array<{ line: number; channels: string[] }>;
};

const SECTION_NAMES: Record<string, PatchbaySection> = {
  message: 'message',
  audio: 'audio',
  video: 'video'
};

const IDENTIFIER_PATTERN = /^[A-Za-z0-9_.~/:-]+$/;

function createSectionState(): SectionState {
  return {
    declarations: new Map(),
    declarationUseCount: new Map(),
    routes: []
  };
}

function formatSection(section: PatchbaySection): string {
  return section[0].toUpperCase() + section.slice(1);
}

function createDiagnostic(
  severity: PatchbayDiagnosticSeverity,
  code: PatchbayDiagnosticCode,
  line: number,
  message: string,
  options: Pick<PatchbayDiagnostic, 'section' | 'name'> = {}
): PatchbayDiagnostic {
  return {
    severity,
    code,
    line,
    message,
    ...options
  };
}

function splitRoute(raw: string): string[] | null {
  if (!raw.includes('->')) return null;

  const parts = raw.split('->').map((part) => part.trim());
  if (parts.length < 2 || parts.some((part) => part.length === 0)) {
    return null;
  }

  return parts;
}

function hasCycle(routes: PatchbayRoute[]): boolean {
  const graph = new Map<string, Set<string>>();

  for (const { from, to } of routes) {
    if (!graph.has(from)) graph.set(from, new Set());
    graph.get(from)!.add(to);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(channel: string): boolean {
    if (visiting.has(channel)) return true;
    if (visited.has(channel)) return false;

    visiting.add(channel);

    for (const next of graph.get(channel) ?? []) {
      if (visit(next)) return true;
    }

    visiting.delete(channel);
    visited.add(channel);
    return false;
  }

  for (const channel of graph.keys()) {
    if (visit(channel)) return true;
  }

  return false;
}

function analyzeSection(
  section: PatchbaySection,
  state: SectionState,
  knownChannels: Set<string>,
  diagnostics: PatchbayDiagnostic[],
  roles?: { sources: Set<string>; targets: Set<string> }
): PatchbayRoute[] {
  const routes: PatchbayRoute[] = [];
  const routeKeys = new Set<string>();
  let hasErrors = false;

  for (const route of state.routes) {
    for (const channel of route.channels) {
      if (!state.declarations.has(channel) && !knownChannels.has(channel)) {
        hasErrors = true;
        diagnostics.push(
          createDiagnostic(
            'error',
            'unknown-channel',
            route.line,
            `Unknown ${section} channel "${channel}". Declare it with chan ${channel} or create a matching ${section} channel object.`,
            { section, name: channel }
          )
        );
      }

      if (state.declarations.has(channel)) {
        state.declarationUseCount.set(channel, (state.declarationUseCount.get(channel) ?? 0) + 1);
      }
    }

    for (let index = 0; index < route.channels.length - 1; index += 1) {
      const from = route.channels[index];
      const to = route.channels[index + 1];
      const key = `${from}\0${to}`;

      if (routeKeys.has(key)) {
        diagnostics.push(
          createDiagnostic(
            'warning',
            'duplicate-route',
            route.line,
            `Duplicate ${section} route "${from} -> ${to}".`,
            { section, name: from }
          )
        );
        continue;
      }

      if (
        roles &&
        !state.declarations.has(from) &&
        knownChannels.has(from) &&
        !roles.sources.has(from)
      ) {
        hasErrors = true;
        diagnostics.push(
          createDiagnostic(
            'error',
            'receiver-as-source',
            route.line,
            `${formatSection(section)} channel "${from}" is registered as a receiver, so it cannot be used as a route source.`,
            { section, name: from }
          )
        );
      }

      if (roles && !state.declarations.has(to) && knownChannels.has(to) && !roles.targets.has(to)) {
        hasErrors = true;
        diagnostics.push(
          createDiagnostic(
            'error',
            'sender-as-target',
            route.line,
            `${formatSection(section)} channel "${to}" is registered as a sender, so it cannot be used as a route target.`,
            { section, name: to }
          )
        );
      }

      routeKeys.add(key);
      routes.push({ from, to });
    }
  }

  if (!hasErrors && hasCycle(routes)) {
    hasErrors = true;
    diagnostics.push(
      createDiagnostic('error', 'cycle', 1, `Cycle detected in ${formatSection(section)} routes.`, {
        section
      })
    );
  }

  for (const [channel, line] of state.declarations) {
    if ((state.declarationUseCount.get(channel) ?? 0) === 0) {
      diagnostics.push(
        createDiagnostic(
          'warning',
          'unused-channel',
          line,
          `Declared ${section} channel "${channel}" is unused.`,
          { section, name: channel }
        )
      );
    }
  }

  return hasErrors ? [] : routes;
}

export function analyzePatchbay(
  source: string,
  knownChannels: PatchbayKnownChannels = {}
): PatchbayAnalysis {
  const diagnostics: PatchbayDiagnostic[] = [];
  const states: Record<PatchbaySection, SectionState> = {
    message: createSectionState(),
    audio: createSectionState(),
    video: createSectionState()
  };
  let currentSection: PatchbaySection | undefined;

  source.split(/\r?\n/).forEach((rawLine, index) => {
    const line = index + 1;
    const text = rawLine.trim();

    if (text.length === 0 || text.startsWith('//') || text.startsWith('# ')) return;

    const sectionMatch = text.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1].trim().toLowerCase();
      currentSection = SECTION_NAMES[sectionName];

      if (!currentSection) {
        diagnostics.push(
          createDiagnostic(
            'error',
            'unknown-section',
            line,
            `Unknown patchbay section "${sectionMatch[1]}". Use [Message], [Audio], or [Video].`,
            { name: sectionMatch[1] }
          )
        );
      }
      return;
    }

    if (!currentSection) {
      diagnostics.push(
        createDiagnostic(
          'error',
          'statement-outside-section',
          line,
          'Patchbay statements must appear inside a [Message], [Audio], or [Video] section.'
        )
      );
      return;
    }

    if (text.startsWith('chan ')) {
      const name = text.slice('chan '.length).trim();

      if (!IDENTIFIER_PATTERN.test(name)) {
        diagnostics.push(
          createDiagnostic('error', 'invalid-identifier', line, `Invalid channel name "${name}".`, {
            section: currentSection,
            name
          })
        );
        return;
      }

      const state = states[currentSection];
      if (state.declarations.has(name)) {
        diagnostics.push(
          createDiagnostic(
            'error',
            'duplicate-channel',
            line,
            `Duplicate ${currentSection} channel declaration "${name}".`,
            { section: currentSection, name }
          )
        );
        return;
      }

      state.declarations.set(name, line);
      state.declarationUseCount.set(name, 0);
      return;
    }

    const channels = splitRoute(text);
    if (!channels) {
      diagnostics.push(
        createDiagnostic(
          'error',
          'malformed-route',
          line,
          `Malformed route "${text}". Use Source -> Destination.`,
          { section: currentSection }
        )
      );
      return;
    }

    for (const channel of channels) {
      if (!IDENTIFIER_PATTERN.test(channel)) {
        diagnostics.push(
          createDiagnostic(
            'error',
            'invalid-identifier',
            line,
            `Invalid channel name "${channel}".`,
            { section: currentSection, name: channel }
          )
        );
        return;
      }
    }

    states[currentSection].routes.push({ line, channels });
  });

  const channels = {
    message: states.message.declarations,
    audio: states.audio.declarations,
    video: states.video.declarations
  };
  const messageKnownChannels =
    knownChannels.message ??
    new Set([...(knownChannels.messageSources ?? []), ...(knownChannels.messageTargets ?? [])]);
  const audioKnownChannels =
    knownChannels.audio ??
    new Set([...(knownChannels.audioSources ?? []), ...(knownChannels.audioTargets ?? [])]);
  const videoKnownChannels =
    knownChannels.video ??
    new Set([...(knownChannels.videoSources ?? []), ...(knownChannels.videoTargets ?? [])]);

  return {
    diagnostics,
    messageRoutes: analyzeSection(
      'message',
      states.message,
      messageKnownChannels,
      diagnostics,
      knownChannels.messageSources || knownChannels.messageTargets
        ? {
            sources: new Set([
              ...states.message.declarations.keys(),
              ...(knownChannels.messageSources ?? [])
            ]),
            targets: new Set([
              ...states.message.declarations.keys(),
              ...(knownChannels.messageTargets ?? [])
            ])
          }
        : undefined
    ),
    audioRoutes: analyzeSection(
      'audio',
      states.audio,
      audioKnownChannels,
      diagnostics,
      knownChannels.audioSources || knownChannels.audioTargets
        ? {
            sources: new Set([
              ...states.audio.declarations.keys(),
              ...(knownChannels.audioSources ?? [])
            ]),
            targets: new Set([
              ...states.audio.declarations.keys(),
              ...(knownChannels.audioTargets ?? [])
            ])
          }
        : undefined
    ),
    videoRoutes: analyzeSection(
      'video',
      states.video,
      videoKnownChannels,
      diagnostics,
      knownChannels.videoSources || knownChannels.videoTargets
        ? {
            sources: new Set([
              ...states.video.declarations.keys(),
              ...(knownChannels.videoSources ?? [])
            ]),
            targets: new Set([
              ...states.video.declarations.keys(),
              ...(knownChannels.videoTargets ?? [])
            ])
          }
        : undefined
    ),
    channels: {
      message: new Set(channels.message.keys()),
      audio: new Set(channels.audio.keys()),
      video: new Set(channels.video.keys())
    }
  };
}
