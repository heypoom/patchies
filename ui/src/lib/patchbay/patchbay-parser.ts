export type PatchbaySection = 'message' | 'audio' | 'video';

export type PatchbayRoute = {
  from: string;
  to: string;
  fromEndpoint?: PatchbayResolvedObjectEndpoint;
  toEndpoint?: PatchbayResolvedObjectEndpoint;
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
  | 'sender-as-target'
  | 'duplicate-alias'
  | 'unknown-object'
  | 'object-port-unavailable'
  | 'object-port-out-of-range';

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
  objects?: PatchbayObjectPorts;
  messageSources?: Set<string>;
  messageTargets?: Set<string>;
  audioSources?: Set<string>;
  audioTargets?: Set<string>;
  videoSources?: Set<string>;
  videoTargets?: Set<string>;
};

export type PatchbayObjectDirection = 'source' | 'target';

export type PatchbayObjectPortSet = Partial<
  Record<PatchbaySection, { inlets?: string[]; outlets?: string[] }>
>;

export type PatchbayObjectPorts = Map<string, PatchbayObjectPortSet>;

export type PatchbayObjectEndpointRef = {
  kind: 'object';
  nodeId: string;
  portIndex: number;
  raw: string;
  line: number;
};

export type PatchbayChannelEndpointRef = {
  kind: 'channel';
  name: string;
  raw: string;
  line: number;
};

export type PatchbayEndpointRef = PatchbayChannelEndpointRef | PatchbayObjectEndpointRef;

export type PatchbayResolvedObjectEndpoint = {
  kind: 'object';
  nodeId: string;
  portIndex: number;
  handle: string;
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
  aliases: Map<string, PatchbayObjectEndpointRef>;
  routes: Array<{ line: number; endpoints: PatchbayEndpointRef[] }>;
};

type PendingRoute = {
  section: PatchbaySection;
  line: number;
  raw: string;
  endpoints: PatchbayEndpointRef[];
  waitingForEndpoint: boolean;
};

const SECTION_NAMES: Record<string, PatchbaySection> = {
  message: 'message',
  audio: 'audio',
  video: 'video'
};

const IDENTIFIER_PATTERN = /^[A-Za-z0-9_.~/:-]+$/;
const OBJECT_ID_PATTERN = /^[A-Za-z0-9_.~/-]+$/;

function createSectionState(): SectionState {
  return {
    declarations: new Map(),
    declarationUseCount: new Map(),
    aliases: new Map(),
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
  if (parts.length < 2 || parts.slice(0, -1).some((part) => part.length === 0)) {
    return null;
  }

  return parts;
}

function parseEndpoint(raw: string, line: number): PatchbayEndpointRef | null {
  const objectMatch = raw.match(/^obj\s+(.+)$/);
  if (!objectMatch) return { kind: 'channel', name: raw, raw, line };

  const objectText = objectMatch[1].trim();
  const portMatch = objectText.match(/^(.+):(\d+)$/);
  const nodeId = (portMatch ? portMatch[1] : objectText).trim();
  const portIndex = portMatch ? Number(portMatch[2]) : 0;

  if (!OBJECT_ID_PATTERN.test(nodeId)) return null;

  return { kind: 'object', nodeId, portIndex, raw, line };
}

function parseAliasDeclaration(
  raw: string,
  line: number,
  section: PatchbaySection,
  diagnostics: PatchbayDiagnostic[]
): { name: string; endpoint: PatchbayObjectEndpointRef } | null {
  const match = raw.match(/^([^=\s]+)\s*=\s*(.+)$/);
  if (!match) return null;

  const name = match[1].trim();
  const endpointText = match[2].trim();
  const endpoint = parseEndpoint(endpointText, line);

  if (!IDENTIFIER_PATTERN.test(name)) {
    diagnostics.push(
      createDiagnostic('error', 'invalid-identifier', line, `Invalid alias name "${name}".`, {
        section,
        name
      })
    );
    return null;
  }

  if (!endpoint || endpoint.kind !== 'object') {
    diagnostics.push(
      createDiagnostic(
        'error',
        'invalid-identifier',
        line,
        `Invalid object alias "${raw}". Use Name = obj node-id.`,
        { section, name }
      )
    );
    return null;
  }

  return { name, endpoint };
}

function splitRouteContinuation(raw: string): string[] | null {
  if (!raw.startsWith('->')) return null;

  const parts = raw.split('->').map((part) => part.trim());
  if (parts[0] !== '' || parts.length < 2 || parts.slice(1, -1).some((part) => part.length === 0)) {
    return null;
  }

  return parts.slice(1);
}

function parseEndpointParts(
  parts: string[],
  line: number,
  section: PatchbaySection,
  diagnostics: PatchbayDiagnostic[]
): PatchbayEndpointRef[] | null {
  const endpoints: PatchbayEndpointRef[] = [];

  for (const rawEndpoint of parts) {
    const endpoint = parseEndpoint(rawEndpoint, line);
    if (!endpoint || (endpoint.kind === 'channel' && !IDENTIFIER_PATTERN.test(endpoint.name))) {
      diagnostics.push(
        createDiagnostic(
          'error',
          'invalid-identifier',
          line,
          `Invalid channel name "${rawEndpoint}".`,
          { section, name: rawEndpoint }
        )
      );
      return null;
    }

    endpoints.push(endpoint);
  }

  return endpoints;
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
  objects: PatchbayObjectPorts | undefined,
  diagnostics: PatchbayDiagnostic[],
  roles?: { sources: Set<string>; targets: Set<string> }
): PatchbayRoute[] {
  const routes: PatchbayRoute[] = [];
  const routeKeys = new Set<string>();
  let hasErrors = false;

  for (const route of state.routes) {
    for (const endpoint of route.endpoints) {
      const objectEndpoint = getObjectEndpointRef(endpoint, state);

      if (objectEndpoint) {
        if (!objects?.has(objectEndpoint.nodeId)) {
          hasErrors = true;
          diagnostics.push(
            createDiagnostic(
              'error',
              'unknown-object',
              objectEndpoint.line,
              `Unknown object "${objectEndpoint.nodeId}". Use an existing object id after obj.`,
              { section, name: objectEndpoint.nodeId }
            )
          );
        }

        continue;
      }

      if (endpoint.kind !== 'channel') continue;

      const channel = endpoint.name;
      if (!state.declarations.has(channel) && !knownChannels.has(channel)) {
        hasErrors = true;
        diagnostics.push(
          createDiagnostic(
            'error',
            'unknown-channel',
            endpoint.line,
            `Unknown ${section} channel "${channel}". Declare it with chan ${channel} or create a matching ${section} channel object.`,
            { section, name: channel }
          )
        );
      }

      if (state.declarations.has(channel)) {
        state.declarationUseCount.set(channel, (state.declarationUseCount.get(channel) ?? 0) + 1);
      }
    }

    for (let index = 0; index < route.endpoints.length - 1; index += 1) {
      const fromEndpointRef = route.endpoints[index];
      const toEndpointRef = route.endpoints[index + 1];
      const fromObjectRef = getObjectEndpointRef(fromEndpointRef, state);
      const toObjectRef = getObjectEndpointRef(toEndpointRef, state);
      const from = fromEndpointRef.raw;
      const to = toEndpointRef.raw;
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
        fromEndpointRef.kind === 'channel' &&
        !state.aliases.has(fromEndpointRef.name) &&
        !state.declarations.has(fromEndpointRef.name) &&
        knownChannels.has(fromEndpointRef.name) &&
        !roles.sources.has(fromEndpointRef.name)
      ) {
        hasErrors = true;
        diagnostics.push(
          createDiagnostic(
            'error',
            'receiver-as-source',
            fromEndpointRef.line,
            `${formatSection(section)} channel "${fromEndpointRef.name}" is registered as a receiver, so it cannot be used as a route source.`,
            { section, name: fromEndpointRef.name }
          )
        );
      }

      if (
        roles &&
        toEndpointRef.kind === 'channel' &&
        !state.aliases.has(toEndpointRef.name) &&
        !state.declarations.has(toEndpointRef.name) &&
        knownChannels.has(toEndpointRef.name) &&
        !roles.targets.has(toEndpointRef.name)
      ) {
        hasErrors = true;
        diagnostics.push(
          createDiagnostic(
            'error',
            'sender-as-target',
            toEndpointRef.line,
            `${formatSection(section)} channel "${toEndpointRef.name}" is registered as a sender, so it cannot be used as a route target.`,
            { section, name: toEndpointRef.name }
          )
        );
      }

      const fromEndpoint = resolveObjectEndpoint(
        fromObjectRef,
        section,
        'source',
        objects,
        fromEndpointRef.line,
        diagnostics
      );
      const toEndpoint = resolveObjectEndpoint(
        toObjectRef,
        section,
        'target',
        objects,
        toEndpointRef.line,
        diagnostics
      );

      if ((fromObjectRef && !fromEndpoint) || (toObjectRef && !toEndpoint)) {
        hasErrors = true;
      }

      routeKeys.add(key);
      routes.push({ from, to, fromEndpoint, toEndpoint });
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

function resolveObjectEndpoint(
  endpoint: PatchbayObjectEndpointRef | undefined,
  section: PatchbaySection,
  direction: PatchbayObjectDirection,
  objects: PatchbayObjectPorts | undefined,
  line: number,
  diagnostics: PatchbayDiagnostic[]
): PatchbayResolvedObjectEndpoint | undefined {
  if (!endpoint) return undefined;

  const objectPorts = objects?.get(endpoint.nodeId);
  if (!objectPorts) return undefined;

  const ports =
    direction === 'source'
      ? (objectPorts[section]?.outlets ?? [])
      : (objectPorts[section]?.inlets ?? []);

  if (ports.length === 0) {
    diagnostics.push(
      createDiagnostic(
        'error',
        'object-port-unavailable',
        line,
        `Object "${endpoint.nodeId}" has no ${section} ${direction === 'source' ? 'outlet' : 'inlet'}.`,
        { section, name: endpoint.nodeId }
      )
    );
    return undefined;
  }

  const handle = ports[endpoint.portIndex];
  if (!handle) {
    diagnostics.push(
      createDiagnostic(
        'error',
        'object-port-out-of-range',
        line,
        `Object "${endpoint.nodeId}" has no ${section} ${direction === 'source' ? 'outlet' : 'inlet'} at compatible port ${endpoint.portIndex}.`,
        { section, name: `${endpoint.nodeId}:${endpoint.portIndex}` }
      )
    );
    return undefined;
  }

  return {
    kind: 'object',
    nodeId: endpoint.nodeId,
    portIndex: endpoint.portIndex,
    handle
  };
}

function getObjectEndpointRef(
  endpoint: PatchbayEndpointRef,
  state: SectionState
): PatchbayObjectEndpointRef | undefined {
  if (endpoint.kind === 'object') return endpoint;
  return state.aliases.get(endpoint.name);
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
  let pendingRoute: PendingRoute | null = null;

  function flushPendingRoute(): void {
    if (!pendingRoute) return;

    if (pendingRoute.endpoints.length < 2 || pendingRoute.waitingForEndpoint) {
      diagnostics.push(
        createDiagnostic(
          'error',
          'malformed-route',
          pendingRoute.line,
          `Malformed route "${pendingRoute.raw}". Use Source -> Destination.`,
          { section: pendingRoute.section }
        )
      );
    } else {
      states[pendingRoute.section].routes.push({
        line: pendingRoute.line,
        endpoints: pendingRoute.endpoints
      });
    }

    pendingRoute = null;
  }

  source.split(/\r?\n/).forEach((rawLine, index) => {
    const line = index + 1;
    const text = rawLine.trim();

    if (text.length === 0 || text.startsWith('//') || text.startsWith('# ')) {
      flushPendingRoute();
      return;
    }

    const sectionMatch = text.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      flushPendingRoute();
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
      flushPendingRoute();
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
      flushPendingRoute();
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
      if (state.declarations.has(name) || state.aliases.has(name)) {
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

    if (/^[^=\s]+\s*=/.test(text)) {
      flushPendingRoute();
      const aliasDeclaration = parseAliasDeclaration(text, line, currentSection, diagnostics);
      if (!aliasDeclaration) return;

      const state = states[currentSection];

      if (
        state.aliases.has(aliasDeclaration.name) ||
        state.declarations.has(aliasDeclaration.name)
      ) {
        diagnostics.push(
          createDiagnostic(
            'error',
            'duplicate-alias',
            line,
            `Duplicate ${currentSection} object alias "${aliasDeclaration.name}".`,
            { section: currentSection, name: aliasDeclaration.name }
          )
        );
        return;
      }

      state.aliases.set(aliasDeclaration.name, aliasDeclaration.endpoint);
      return;
    }

    const continuationParts = splitRouteContinuation(text);
    if (continuationParts) {
      if (!pendingRoute || pendingRoute.section !== currentSection) {
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

      const waitingForEndpoint = continuationParts.at(-1) === '';
      const endpoints = parseEndpointParts(
        waitingForEndpoint ? continuationParts.slice(0, -1) : continuationParts,
        line,
        currentSection,
        diagnostics
      );
      if (!endpoints) return;

      pendingRoute.endpoints.push(...endpoints);
      pendingRoute.waitingForEndpoint = waitingForEndpoint;
      return;
    }

    const routeParts = splitRoute(text);
    if (!routeParts) {
      const endpoint = parseEndpoint(text, line);
      if (!endpoint || (endpoint.kind === 'channel' && !IDENTIFIER_PATTERN.test(endpoint.name))) {
        flushPendingRoute();
        diagnostics.push(
          createDiagnostic('error', 'invalid-identifier', line, `Invalid channel name "${text}".`, {
            section: currentSection,
            name: text
          })
        );
        return;
      }

      if (pendingRoute?.waitingForEndpoint && pendingRoute.section === currentSection) {
        pendingRoute.endpoints.push(endpoint);
        pendingRoute.waitingForEndpoint = false;
      } else {
        flushPendingRoute();
        pendingRoute = {
          section: currentSection,
          line,
          raw: text,
          endpoints: [endpoint],
          waitingForEndpoint: false
        };
      }
      return;
    }

    const waitingForEndpoint = routeParts.at(-1) === '';
    const endpointParts = waitingForEndpoint ? routeParts.slice(0, -1) : routeParts;
    const endpoints = parseEndpointParts(endpointParts, line, currentSection, diagnostics);
    if (!endpoints) return;

    if (pendingRoute?.waitingForEndpoint && pendingRoute.section === currentSection) {
      pendingRoute.endpoints.push(...endpoints);
      pendingRoute.waitingForEndpoint = waitingForEndpoint;
    } else {
      flushPendingRoute();
      pendingRoute = {
        section: currentSection,
        line,
        raw: text,
        endpoints,
        waitingForEndpoint
      };
    }
  });

  flushPendingRoute();

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
      knownChannels.objects,
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
      knownChannels.objects,
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
      knownChannels.objects,
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
