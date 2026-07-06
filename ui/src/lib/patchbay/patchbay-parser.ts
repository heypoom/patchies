import { hash } from 'ohash';
import { Parser } from 'expr-eval';
import { parseMultiOutletExpressions } from '$lib/utils/expr-parser';
import { transformFExprExpression } from '$lib/audio/fexpr-transform';
import { isUnmodifiableType, parseStringParamByType } from '$lib/objects/parse-object-param';
import { VIRTUAL_AUDIO_PROCESSOR_INLETS } from './virtual-audio-processors';

export type PatchbaySection = 'message' | 'audio' | 'video';

export type PatchbayRoute = {
  from: string;
  to: string;
  fromEndpoint?: PatchbayResolvedObjectEndpoint;
  toEndpoint?: PatchbayResolvedObjectEndpoint;
  fromVirtualExpression?: PatchbayVirtualAudioExpression;
  toVirtualExpression?: PatchbayVirtualAudioExpression;
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
  | 'object-port-out-of-range'
  | 'invalid-virtual-expression'
  | 'unsupported-virtual-audio-node';

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

export type PatchbayVirtualAudioExpression = {
  id: string;
  name?: string;
  type: string;
  rawArgs: string[];
  params: unknown[];
  expression: string;
  raw: string;
  line: number;
  anonymous: boolean;
};

export type PatchbayVirtualAudioExpressionEndpointRef = {
  kind: 'virtual-audio-expression';
  expression: PatchbayVirtualAudioExpression;
  raw: string;
  line: number;
};

export type PatchbayChannelEndpointRef = {
  kind: 'channel';
  name: string;
  raw: string;
  line: number;
};

export type PatchbayEndpointRef =
  | PatchbayChannelEndpointRef
  | PatchbayObjectEndpointRef
  | PatchbayVirtualAudioExpressionEndpointRef;

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
  virtualAudioExpressions: PatchbayVirtualAudioExpression[];
  channels: Record<PatchbaySection, Set<string>>;
};

type SectionState = {
  declarations: Map<string, number>;
  declarationUseCount: Map<string, number>;
  aliases: Map<string, PatchbayObjectEndpointRef>;
  virtualAudioExpressions: Map<string, PatchbayVirtualAudioExpression>;
  anonymousVirtualAudioExpressions: PatchbayVirtualAudioExpression[];
  routes: Array<{ line: number; endpoints: PatchbayEndpointRef[] }>;
};

type PatchbayChannelRoles = {
  sources: Set<string>;
  targets: Set<string>;
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
const AUDIO_EXPRESSION_PARAMETER_NAMES = [
  ...Array.from({ length: 9 }, (_, index) => `s${index + 1}`),
  's',
  'i',
  't',
  'channel',
  'bufferSize',
  'samples',
  'input',
  'inputs',
  ...Array.from({ length: 9 }, (_, index) => `x${index + 1}`)
];
const FILTER_AUDIO_EXPRESSION_PARAMETER_NAMES = [
  ...Array.from({ length: 9 }, (_, index) => `x${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `s${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `y${index + 1}`),
  'i',
  't',
  ...Array.from({ length: 9 }, (_, index) => `c${index + 1}`)
];
const VIRTUAL_AUDIO_PROCESSOR_TYPES = new Set([
  'expr~',
  'fexpr~',
  'osc~',
  'gain~',
  'lowpass~',
  'highpass~',
  'bandpass~',
  'notch~',
  'allpass~',
  'lowshelf~',
  'highshelf~',
  'peaking~',
  'compressor~',
  'delay~'
]);
const KNOWN_UNSUPPORTED_AUDIO_PROCESSOR_TYPES = new Set([
  'biquad~',
  'comb~',
  'convolver~',
  'mic~',
  'out~',
  'send~',
  'recv~',
  'soundfile~',
  'sampler~',
  'csound~',
  'waveshaper~'
]);

const createSectionState = (): SectionState => ({
  declarations: new Map(),
  declarationUseCount: new Map(),
  aliases: new Map(),
  virtualAudioExpressions: new Map(),
  anonymousVirtualAudioExpressions: [],
  routes: []
});

const formatSection = (section: PatchbaySection): string =>
  section[0].toUpperCase() + section.slice(1);

const createDiagnostic = (
  severity: PatchbayDiagnosticSeverity,
  code: PatchbayDiagnosticCode,
  line: number,
  message: string,
  options: Pick<PatchbayDiagnostic, 'section' | 'name'> = {}
): PatchbayDiagnostic => ({
  severity,
  code,
  line,
  message,
  ...options
});

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
    const invalidIdentifierError = createDiagnostic(
      'error',
      'invalid-identifier',
      line,
      `Invalid alias name "${name}".`,
      {
        section,
        name
      }
    );

    diagnostics.push(invalidIdentifierError);

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

function parseVirtualAudioProcessorDeclaration(
  raw: string,
  line: number,
  section: PatchbaySection,
  patchbayIdSeed: string,
  diagnostics: PatchbayDiagnostic[]
): { name: string; expression: PatchbayVirtualAudioExpression } | null {
  const match = raw.match(/^([^=\s]+)\s*=\s*([A-Za-z0-9_.~/:-]+)(?:\s+(.+))?$/);
  if (!match) return null;

  const name = match[1].trim();
  const type = match[2].trim();
  const rawArgs = splitVirtualAudioProcessorArgs(match[3] ?? '');
  const expression = isVirtualAudioExpressionType(type) ? rawArgs.join(' ').trim() : '';

  if (section !== 'audio') {
    diagnostics.push(
      createDiagnostic(
        'error',
        'invalid-virtual-expression',
        line,
        'Virtual audio processor declarations are only supported in [Audio].',
        { section, name }
      )
    );

    return null;
  }

  if (!IDENTIFIER_PATTERN.test(name)) {
    diagnostics.push(
      createDiagnostic('error', 'invalid-identifier', line, `Invalid alias name "${name}".`, {
        section,
        name
      })
    );

    return null;
  }

  if (!isSupportedVirtualAudioProcessorType(type)) {
    diagnostics.push(
      createDiagnostic(
        'error',
        'unsupported-virtual-audio-node',
        line,
        `Unsupported virtual audio processor "${type}".`,
        { section, name }
      )
    );

    return null;
  }

  if (expression.length === 0) {
    if (isVirtualAudioExpressionType(type)) {
      diagnostics.push(
        createDiagnostic(
          'error',
          'invalid-virtual-expression',
          line,
          `Virtual expression "${name}" needs a ${type} body.`,
          { section, name }
        )
      );

      return null;
    }
  }

  if (isVirtualAudioExpressionType(type)) {
    const validationError = validateVirtualAudioExpression(type, expression);

    if (validationError) {
      diagnostics.push(
        createDiagnostic('error', 'invalid-virtual-expression', line, validationError, {
          section,
          name
        })
      );
    }
  }

  return {
    name,
    expression: {
      id: `${patchbayIdSeed}:audio-virtual:${name}`,
      name,
      type,
      rawArgs,
      params: parseVirtualAudioProcessorParams(type, rawArgs),
      expression,
      raw: name,
      line,
      anonymous: false
    }
  };
}

function splitVirtualAudioProcessorArgs(rawArgs: string): string[] {
  return rawArgs.trim().length === 0 ? [] : rawArgs.trim().split(/\s+/);
}

function isSupportedVirtualAudioProcessorType(type: string): boolean {
  return VIRTUAL_AUDIO_PROCESSOR_TYPES.has(type);
}

function isKnownUnsupportedAudioProcessorType(type: string): boolean {
  return KNOWN_UNSUPPORTED_AUDIO_PROCESSOR_TYPES.has(type);
}

function isVirtualAudioExpressionType(type: string): type is 'expr~' | 'fexpr~' {
  return type === 'expr~' || type === 'fexpr~';
}

function parseVirtualAudioProcessorParams(type: string, rawArgs: string[]): unknown[] {
  if (isVirtualAudioExpressionType(type)) return [null, rawArgs.join(' ')];

  const inlets = VIRTUAL_AUDIO_PROCESSOR_INLETS.get(type);
  if (!inlets) return rawArgs;

  const params: unknown[] = [];
  let inputInletIndex = 0;

  for (const inlet of inlets) {
    const skipAsUnmodifiable = isUnmodifiableType(inlet.type) && !inlet.acceptsFloat;
    if (skipAsUnmodifiable) {
      params.push(null);
      continue;
    }

    if (inputInletIndex >= rawArgs.length) {
      params.push(inlet.defaultValue ?? null);
      inputInletIndex += 1;
      continue;
    }

    params.push(parseStringParamByType(inlet, rawArgs[inputInletIndex]));
    inputInletIndex += 1;
  }

  return params;
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
  state: SectionState,
  patchbayIdSeed: string,
  diagnostics: PatchbayDiagnostic[]
): PatchbayEndpointRef[] | null {
  const endpoints: PatchbayEndpointRef[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const rawEndpoint = parts[index];
    const virtualProcessorEndpoint = parseVirtualAudioProcessorEndpoint(
      rawEndpoint,
      line,
      section,
      index,
      state,
      patchbayIdSeed,
      diagnostics
    );

    if (virtualProcessorEndpoint) {
      endpoints.push(virtualProcessorEndpoint);
      continue;
    }

    const shorthandEndpoints = parseAudioShorthandEndpoint(
      rawEndpoint,
      line,
      section,
      index,
      state,
      patchbayIdSeed,
      diagnostics
    );

    if (shorthandEndpoints) {
      endpoints.push(...shorthandEndpoints);
      continue;
    }

    const endpoint = parseEndpoint(rawEndpoint, line);

    if (!endpoint || (endpoint.kind === 'channel' && !IDENTIFIER_PATTERN.test(endpoint.name))) {
      const channelError = createDiagnostic(
        'error',
        'invalid-identifier',
        line,
        `Invalid channel name "${rawEndpoint}".`,
        { section, name: rawEndpoint }
      );

      diagnostics.push(channelError);

      return null;
    }

    endpoints.push(endpoint);
  }

  return endpoints;
}

function parseVirtualAudioProcessorEndpoint(
  rawEndpoint: string,
  line: number,
  section: PatchbaySection,
  routePartIndex: number,
  state: SectionState,
  patchbayIdSeed: string,
  diagnostics: PatchbayDiagnostic[]
): PatchbayVirtualAudioExpressionEndpointRef | null {
  if (section !== 'audio') return null;
  if (rawEndpoint.startsWith('obj ')) return null;

  const match = rawEndpoint.match(/^([A-Za-z0-9_.~/:-]+)\s*(.*)$/);
  if (!match) return null;

  const type = match[1].trim();

  if (!isSupportedVirtualAudioProcessorType(type)) {
    if (isKnownUnsupportedAudioProcessorType(type) && /\s/.test(rawEndpoint)) {
      diagnostics.push(
        createDiagnostic(
          'error',
          'unsupported-virtual-audio-node',
          line,
          `Unsupported virtual audio processor "${type}".`,
          { section, name: type }
        )
      );
    }

    return null;
  }

  const rawArgs = splitVirtualAudioProcessorArgs(match[2] ?? '');
  const expression = isVirtualAudioExpressionType(type) ? rawArgs.join(' ').trim() : '';

  if (isVirtualAudioExpressionType(type)) {
    if (expression.length === 0) return null;

    const validationError = validateVirtualAudioExpression(type, expression);

    if (validationError) {
      diagnostics.push(
        createDiagnostic('error', 'invalid-virtual-expression', line, validationError, {
          section,
          name: rawEndpoint
        })
      );
    }
  }

  const id = `${patchbayIdSeed}:audio-virtual:inline:${hash({
    line,
    routePartIndex,
    type,
    rawArgs
  })}`;

  const virtualExpression: PatchbayVirtualAudioExpression = {
    id,
    type,
    rawArgs,
    params: parseVirtualAudioProcessorParams(type, rawArgs),
    expression,
    raw: rawEndpoint,
    line,
    anonymous: true
  };

  state.anonymousVirtualAudioExpressions.push(virtualExpression);

  return {
    kind: 'virtual-audio-expression',
    expression: virtualExpression,
    raw: virtualExpression.raw,
    line
  };
}

function parseAudioShorthandEndpoint(
  rawEndpoint: string,
  line: number,
  section: PatchbaySection,
  routePartIndex: number,
  state: SectionState,
  patchbayIdSeed: string,
  diagnostics: PatchbayDiagnostic[]
): PatchbayEndpointRef[] | null {
  if (section !== 'audio') return null;
  if (!/\s/.test(rawEndpoint)) return null;
  if (rawEndpoint.startsWith('obj ')) return null;
  if (rawEndpoint.startsWith('expr~ ')) return null;
  if (rawEndpoint.startsWith('fexpr~ ')) return null;

  const match = rawEndpoint.match(/^([A-Za-z0-9_.~/:-]+)\s+(.+)$/);
  if (!match) return null;

  const source = match[1].trim();
  const expressionTail = match[2].trim();
  if (!IDENTIFIER_PATTERN.test(source) || expressionTail.length === 0) return null;

  const expression = `s ${expressionTail}`;
  const validationError = validateVirtualAudioExpression('expr~', expression);

  if (validationError) {
    diagnostics.push(
      createDiagnostic('error', 'invalid-virtual-expression', line, validationError, {
        section,
        name: rawEndpoint
      })
    );
  }

  const id = `${patchbayIdSeed}:audio-virtual:inline:${hash({
    line,
    routePartIndex,
    source
  })}`;

  const virtualExpression: PatchbayVirtualAudioExpression = {
    id,
    type: 'expr~',
    rawArgs: [expression],
    params: parseVirtualAudioProcessorParams('expr~', [expression]),
    expression,
    raw: `expr~ ${expression}`,
    line,
    anonymous: true
  };

  state.anonymousVirtualAudioExpressions.push(virtualExpression);

  return [
    { kind: 'channel', name: source, raw: source, line },
    {
      kind: 'virtual-audio-expression',
      expression: virtualExpression,
      raw: virtualExpression.raw,
      line
    }
  ];
}

function validateVirtualAudioExpression(
  type: 'expr~' | 'fexpr~',
  expression: string
): string | null {
  const parsed = parseMultiOutletExpressions(expression);

  if (parsed.outletExpressions.length > 1) {
    return `Virtual ${type} expressions in patchbay can only produce one outlet.`;
  }

  try {
    const parser = new Parser({
      operators: {
        add: true,
        concatenate: true,
        conditional: true,
        divide: true,
        factorial: true,
        multiply: true,
        power: true,
        remainder: true,
        subtract: true,
        logical: true,
        comparison: true,
        in: true,
        assignment: true
      }
    });

    const renamedExpression =
      type === 'fexpr~'
        ? transformFExprExpression(expression.replace(/\n/g, ' '))
        : expression.replace(/\n/g, ';').replace(/\$(\d+)/g, 'x$1');
    const parameterNames =
      type === 'fexpr~'
        ? FILTER_AUDIO_EXPRESSION_PARAMETER_NAMES
        : AUDIO_EXPRESSION_PARAMETER_NAMES;
    const parsedExpression = parser.parse(renamedExpression);
    parsedExpression.toJSFunction(parameterNames.join(','));

    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return `Invalid ${type} expression: ${message}`;
  }
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
  roles?: PatchbayChannelRoles
): PatchbayRoute[] {
  const routes: PatchbayRoute[] = [];
  const routeKeys = new Set<string>();

  let hasErrors = diagnostics.some(
    (diagnostic) => diagnostic.severity === 'error' && diagnostic.section === section
  );

  for (const route of state.routes) {
    for (const endpoint of route.endpoints) {
      const objectEndpoint = getObjectEndpointRef(endpoint, state);
      const virtualExpressionEndpoint = getVirtualExpressionEndpointRef(endpoint, state);

      if (virtualExpressionEndpoint) continue;

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
      const fromVirtualExpression = getVirtualExpressionEndpointRef(fromEndpointRef, state);
      const toVirtualExpression = getVirtualExpressionEndpointRef(toEndpointRef, state);

      const from = fromEndpointRef.raw;
      const to = toEndpointRef.raw;

      const key = `${from}\0${to}`;

      if (routeKeys.has(key)) {
        const duplicateRouteError = createDiagnostic(
          'warning',
          'duplicate-route',
          route.line,
          `Duplicate ${section} route "${from} -> ${to}".`,
          { section, name: from }
        );

        diagnostics.push(duplicateRouteError);

        continue;
      }

      if (
        roles &&
        fromEndpointRef.kind === 'channel' &&
        !state.aliases.has(fromEndpointRef.name) &&
        !state.virtualAudioExpressions.has(fromEndpointRef.name) &&
        !state.declarations.has(fromEndpointRef.name) &&
        knownChannels.has(fromEndpointRef.name) &&
        !roles.sources.has(fromEndpointRef.name)
      ) {
        hasErrors = true;

        const receiverError = createDiagnostic(
          'error',
          'receiver-as-source',
          fromEndpointRef.line,
          `${formatSection(section)} channel "${fromEndpointRef.name}" is registered as a receiver, so it cannot be used as a route source.`,
          { section, name: fromEndpointRef.name }
        );

        diagnostics.push(receiverError);
      }

      if (
        roles &&
        toEndpointRef.kind === 'channel' &&
        !state.aliases.has(toEndpointRef.name) &&
        !state.virtualAudioExpressions.has(toEndpointRef.name) &&
        !state.declarations.has(toEndpointRef.name) &&
        knownChannels.has(toEndpointRef.name) &&
        !roles.targets.has(toEndpointRef.name)
      ) {
        hasErrors = true;

        const senderTargetError = createDiagnostic(
          'error',
          'sender-as-target',
          toEndpointRef.line,
          `${formatSection(section)} channel "${toEndpointRef.name}" is registered as a sender, so it cannot be used as a route target.`,
          { section, name: toEndpointRef.name }
        );

        diagnostics.push(senderTargetError);
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
      routes.push({
        from,
        to,
        fromEndpoint,
        toEndpoint,
        fromVirtualExpression,
        toVirtualExpression
      });
    }
  }

  if (!hasErrors && hasCycle(routes)) {
    hasErrors = true;

    const cycleError = createDiagnostic(
      'error',
      'cycle',
      1,
      `Cycle detected in ${formatSection(section)} routes.`,
      {
        section
      }
    );

    diagnostics.push(cycleError);
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

function buildChannelRoles(
  declarations: Map<string, number>,
  sources: Set<string> | undefined,
  targets: Set<string> | undefined
): PatchbayChannelRoles | undefined {
  if (!sources && !targets) return undefined;

  const declaredChannels = [...declarations.keys()];

  return {
    sources: new Set([...declaredChannels, ...(sources ?? [])]),
    targets: new Set([...declaredChannels, ...(targets ?? [])])
  };
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
    const objectNoPortError = createDiagnostic(
      'error',
      'object-port-unavailable',
      line,
      `Object "${endpoint.nodeId}" has no ${section} ${direction === 'source' ? 'outlet' : 'inlet'}.`,
      { section, name: endpoint.nodeId }
    );

    diagnostics.push(objectNoPortError);

    return undefined;
  }

  const handle = ports[endpoint.portIndex];

  if (!handle) {
    const objectNoHandleError = createDiagnostic(
      'error',
      'object-port-out-of-range',
      line,
      `Object "${endpoint.nodeId}" has no ${section} ${direction === 'source' ? 'outlet' : 'inlet'} at compatible port ${endpoint.portIndex}.`,
      { section, name: `${endpoint.nodeId}:${endpoint.portIndex}` }
    );

    diagnostics.push(objectNoHandleError);

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
  if (endpoint.kind !== 'channel') return undefined;

  return state.aliases.get(endpoint.name);
}

function getVirtualExpressionEndpointRef(
  endpoint: PatchbayEndpointRef,
  state: SectionState
): PatchbayVirtualAudioExpression | undefined {
  if (endpoint.kind === 'virtual-audio-expression') return endpoint.expression;
  if (endpoint.kind !== 'channel') return undefined;

  return state.virtualAudioExpressions.get(endpoint.name);
}

export function analyzePatchbay(
  source: string,
  knownChannels: PatchbayKnownChannels = {},
  patchbayIdSeed = 'patchbay'
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

    if (text.length === 0) {
      flushPendingRoute();

      return;
    }

    if (text.startsWith('//') || text.startsWith('# ')) {
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

      const statementOutsideSectionError = createDiagnostic(
        'error',
        'statement-outside-section',
        line,
        'Patchbay statements must appear inside a [Message], [Audio], or [Video] section.'
      );

      diagnostics.push(statementOutsideSectionError);

      return;
    }

    if (text.startsWith('chan ')) {
      flushPendingRoute();

      const name = text.slice('chan '.length).trim();

      if (!IDENTIFIER_PATTERN.test(name)) {
        const invalidIdentifierError = createDiagnostic(
          'error',
          'invalid-identifier',
          line,
          `Invalid channel name "${name}".`,
          {
            section: currentSection,
            name
          }
        );

        diagnostics.push(invalidIdentifierError);

        return;
      }

      const state = states[currentSection];

      if (
        state.declarations.has(name) ||
        state.aliases.has(name) ||
        state.virtualAudioExpressions.has(name)
      ) {
        const duplicateChannelError = createDiagnostic(
          'error',
          'duplicate-channel',
          line,
          `Duplicate ${currentSection} channel declaration "${name}".`,
          { section: currentSection, name }
        );

        diagnostics.push(duplicateChannelError);

        return;
      }

      state.declarations.set(name, line);
      state.declarationUseCount.set(name, 0);

      return;
    }

    if (/^[^=\s]+\s*=/.test(text)) {
      flushPendingRoute();

      const processorDeclarationMatch = text.match(/^[^=\s]+\s*=\s*([A-Za-z0-9_.~/:-]+)/);
      const processorType = processorDeclarationMatch?.[1];

      if (
        processorType &&
        (isSupportedVirtualAudioProcessorType(processorType) ||
          isKnownUnsupportedAudioProcessorType(processorType))
      ) {
        const virtualExpressionDeclaration = parseVirtualAudioProcessorDeclaration(
          text,
          line,
          currentSection,
          patchbayIdSeed,
          diagnostics
        );

        if (!virtualExpressionDeclaration) return;

        const state = states[currentSection];

        if (
          state.virtualAudioExpressions.has(virtualExpressionDeclaration.name) ||
          state.aliases.has(virtualExpressionDeclaration.name) ||
          state.declarations.has(virtualExpressionDeclaration.name)
        ) {
          diagnostics.push(
            createDiagnostic(
              'error',
              'duplicate-alias',
              line,
              `Duplicate ${currentSection} virtual expression alias "${virtualExpressionDeclaration.name}".`,
              { section: currentSection, name: virtualExpressionDeclaration.name }
            )
          );

          return;
        }

        state.virtualAudioExpressions.set(
          virtualExpressionDeclaration.name,
          virtualExpressionDeclaration.expression
        );

        return;
      }

      const aliasDeclaration = parseAliasDeclaration(text, line, currentSection, diagnostics);
      if (!aliasDeclaration) return;

      const state = states[currentSection];

      if (
        state.aliases.has(aliasDeclaration.name) ||
        state.virtualAudioExpressions.has(aliasDeclaration.name) ||
        state.declarations.has(aliasDeclaration.name)
      ) {
        const duplicateAliasError = createDiagnostic(
          'error',
          'duplicate-alias',
          line,
          `Duplicate ${currentSection} object alias "${aliasDeclaration.name}".`,
          { section: currentSection, name: aliasDeclaration.name }
        );

        diagnostics.push(duplicateAliasError);

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
        states[currentSection],
        patchbayIdSeed,
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

    const endpoints = parseEndpointParts(
      endpointParts,
      line,
      currentSection,
      states[currentSection],
      patchbayIdSeed,
      diagnostics
    );
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

  const messageRoles = buildChannelRoles(
    states.message.declarations,
    knownChannels.messageSources,
    knownChannels.messageTargets
  );

  const audioRoles = buildChannelRoles(
    states.audio.declarations,
    knownChannels.audioSources,
    knownChannels.audioTargets
  );

  const videoRoles = buildChannelRoles(
    states.video.declarations,
    knownChannels.videoSources,
    knownChannels.videoTargets
  );

  const messageRoutes = analyzeSection(
    'message',
    states.message,
    messageKnownChannels,
    knownChannels.objects,
    diagnostics,
    messageRoles
  );

  const audioRoutes = analyzeSection(
    'audio',
    states.audio,
    audioKnownChannels,
    knownChannels.objects,
    diagnostics,
    audioRoles
  );

  const videoRoutes = analyzeSection(
    'video',
    states.video,
    videoKnownChannels,
    knownChannels.objects,
    diagnostics,
    videoRoles
  );

  return {
    diagnostics,
    messageRoutes,
    audioRoutes,
    videoRoutes,
    virtualAudioExpressions: [
      ...states.audio.virtualAudioExpressions.values(),
      ...states.audio.anonymousVirtualAudioExpressions
    ],
    channels: {
      message: new Set(channels.message.keys()),
      audio: new Set(channels.audio.keys()),
      video: new Set(channels.video.keys())
    }
  };
}
