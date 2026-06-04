import {
  HighlightStyle,
  LanguageSupport,
  StreamLanguage,
  syntaxHighlighting,
  type StreamParser,
  type StringStream
} from '@codemirror/language';
import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import type { PatchbayDiagnostic, PatchbaySection } from '$lib/patchbay/patchbay-parser';

export type PatchbayTokenStyle = 'comment' | 'keyword' | 'operator' | 'typeName' | 'variableName';

export type PatchbayLineToken = {
  text: string;
  style: PatchbayTokenStyle;
};

export type PatchbayDiagnosticRange = {
  from: number;
  to: number;
  className: string;
  message: string;
};

export type PatchbayChannelLinkRange = {
  from: number;
  to: number;
  className: string;
  channel: string;
  section: PatchbaySection;
  role: 'sender' | 'receiver' | 'both';
};

export type PatchbayLocalChannelRange = {
  from: number;
  to: number;
  className: string;
};

export type PatchbayObjectNameRange = {
  from: number;
  to: number;
  className: string;
};

export type PatchbayObjectKeywordRange = {
  from: number;
  to: number;
  className: string;
};

export type PatchbayObjectAssignmentRange = {
  from: number;
  to: number;
  className: string;
};

export type PatchbayObjectIdRange = {
  from: number;
  to: number;
  className: string;
};

export type PatchbayObjectLinkRange = {
  from: number;
  to: number;
  className: string;
  nodeId: string;
};

export type PatchbayChannelRoles = {
  senders: Set<string>;
  receivers: Set<string>;
};

export type PatchbayChannelRolesBySection = Partial<Record<PatchbaySection, PatchbayChannelRoles>>;

const identifierPattern = /^[A-Za-z0-9_.~/:-]+/;
const sectionPattern = /^\[(Message|Audio|Video)\]/i;
const sectionCompletionOptions: Completion[] = [
  { label: '[Audio]', type: 'namespace', detail: 'Audio routes' },
  { label: '[Video]', type: 'namespace', detail: 'Video routes' },
  { label: '[Message]', type: 'namespace', detail: 'Message routes' }
];
const objCompletionOption: Completion = {
  label: 'obj',
  type: 'keyword',
  detail: 'object endpoint'
};

export function tokenizePatchbayLine(line: string): PatchbayLineToken[] {
  const tokens: PatchbayLineToken[] = [];
  let rest = line.trimStart();

  while (rest.length > 0) {
    const before = rest;

    const token = readPatchbayTokenFromText(rest);
    if (!token) {
      rest = rest.slice(1).trimStart();
      continue;
    }

    tokens.push(token);
    rest = rest.slice(token.text.length).trimStart();

    if (rest === before) break;
  }

  return tokens;
}

export function getPatchbayDiagnosticRanges(
  source: string,
  diagnostics: PatchbayDiagnostic[]
): PatchbayDiagnosticRange[] {
  const lineStarts = getLineStarts(source);
  const lines = source.split(/\r?\n/);

  return diagnostics
    .filter(
      (diagnostic) =>
        diagnostic.severity === 'error' &&
        [
          'unknown-channel',
          'receiver-as-source',
          'sender-as-target',
          'unknown-object',
          'object-port-unavailable',
          'object-port-out-of-range'
        ].includes(diagnostic.code)
    )
    .flatMap((diagnostic) => {
      if (!diagnostic.name) return [];

      const lineIndex = diagnostic.line - 1;
      const line = lines[lineIndex];
      const lineStart = lineStarts[lineIndex];
      if (line === undefined || lineStart === undefined) return [];

      const column = line.indexOf(diagnostic.name);
      if (column === -1) return [];

      return [
        {
          from: lineStart + column,
          to: lineStart + column + diagnostic.name.length,
          className:
            diagnostic.code === 'unknown-channel'
              ? 'cm-patchbay-unknown-channel'
              : 'cm-patchbay-role-error',
          message: diagnostic.message
        }
      ];
    });
}

export function getPatchbayChannelLinkRanges(
  source: string,
  registryChannels: PatchbayChannelRoles | PatchbayChannelRolesBySection
): PatchbayChannelLinkRange[] {
  const lineStarts = getLineStarts(source);
  const localChannels = getPatchbayLocalChannels(source);
  const objectAliases = getPatchbayObjectAliases(source);
  const rolesBySection = normalizeRolesBySection(registryChannels);
  const ranges: PatchbayChannelLinkRange[] = [];
  let currentSection: PatchbaySection | undefined;

  source.split(/\r?\n/).forEach((line, lineIndex) => {
    const lineTokens = tokenizePatchbayLine(line);
    if (isObjectAliasDeclarationTokens(lineTokens)) return;

    let searchStart = 0;
    let skipObjectId = false;

    for (const token of lineTokens) {
      const column = line.indexOf(token.text, searchStart);
      if (column === -1) continue;

      searchStart = column + token.text.length;

      const section = parseSectionToken(token);
      if (section) {
        currentSection = section;
        continue;
      }

      if (token.text === 'obj' && token.style === 'keyword') {
        skipObjectId = true;
        continue;
      }

      if (token.style !== 'variableName') continue;
      if (skipObjectId) {
        skipObjectId = false;
        continue;
      }
      if (!currentSection) continue;
      if (objectAliases.has(getChannelKey(currentSection, token.text))) continue;
      if (localChannels.has(getChannelKey(currentSection, token.text))) continue;

      const sectionRoles = rolesBySection[currentSection];
      if (!sectionRoles) continue;

      const isSender = sectionRoles.senders.has(token.text);
      const isReceiver = sectionRoles.receivers.has(token.text);
      if (!isSender && !isReceiver) continue;

      const role = isSender && isReceiver ? 'both' : isSender ? 'sender' : 'receiver';
      const roleClass =
        role === 'both'
          ? 'cm-patchbay-bidirectional-channel'
          : role === 'sender'
            ? 'cm-patchbay-sender-channel'
            : 'cm-patchbay-receiver-channel';

      const from = lineStarts[lineIndex] + column;
      ranges.push({
        from,
        to: from + token.text.length,
        className: `cm-patchbay-channel-link ${roleClass}`,
        channel: token.text,
        section: currentSection,
        role
      });
    }
  });

  return ranges;
}

export function getPatchbayLocalChannelRanges(source: string): PatchbayLocalChannelRange[] {
  const lineStarts = getLineStarts(source);
  const localChannels = getPatchbayLocalChannels(source);
  const ranges: PatchbayLocalChannelRange[] = [];
  let currentSection: PatchbaySection | undefined;

  source.split(/\r?\n/).forEach((line, lineIndex) => {
    let searchStart = 0;
    let skipObjectId = false;

    for (const token of tokenizePatchbayLine(line)) {
      const column = line.indexOf(token.text, searchStart);
      if (column === -1) continue;

      searchStart = column + token.text.length;

      const section = parseSectionToken(token);
      if (section) {
        currentSection = section;
        continue;
      }

      if (token.text === 'obj' && token.style === 'keyword') {
        skipObjectId = true;
        continue;
      }

      if (token.style !== 'variableName') continue;
      if (skipObjectId) {
        skipObjectId = false;
        continue;
      }
      if (!currentSection) continue;
      if (!localChannels.has(getChannelKey(currentSection, token.text))) continue;

      const from = lineStarts[lineIndex] + column;
      ranges.push({
        from,
        to: from + token.text.length,
        className: 'cm-patchbay-local-channel'
      });
    }
  });

  return ranges;
}

export function getPatchbayObjectLinkRanges(source: string): PatchbayObjectLinkRange[] {
  const lineStarts = getLineStarts(source);
  const objectAliases = getPatchbayObjectAliases(source);
  const ranges: PatchbayObjectLinkRange[] = [];
  let currentSection: PatchbaySection | undefined;

  source.split(/\r?\n/).forEach((line, lineIndex) => {
    let searchStart = 0;
    let previousWasObjectKeyword = false;

    for (const token of tokenizePatchbayLine(line)) {
      const column = line.indexOf(token.text, searchStart);
      if (column === -1) continue;

      searchStart = column + token.text.length;

      const section = parseSectionToken(token);
      if (section) {
        currentSection = section;
        previousWasObjectKeyword = false;
        continue;
      }

      if (token.text === 'obj' && token.style === 'keyword') {
        previousWasObjectKeyword = true;
        continue;
      }

      if (!previousWasObjectKeyword && currentSection && token.style === 'variableName') {
        const nodeId = objectAliases.get(getChannelKey(currentSection, token.text));
        if (nodeId) {
          const from = lineStarts[lineIndex] + column;

          ranges.push({
            from,
            to: from + token.text.length,
            className: 'cm-patchbay-object-link',
            nodeId
          });
        }
      }

      if (previousWasObjectKeyword && token.style === 'variableName') {
        const nodeId = token.text.replace(/:\d+$/, '');
        const from = lineStarts[lineIndex] + column;

        ranges.push({
          from,
          to: from + nodeId.length,
          className: 'cm-patchbay-object-link',
          nodeId
        });
      }

      previousWasObjectKeyword = false;
    }
  });

  return ranges;
}

export function getPatchbayObjectKeywordRanges(source: string): PatchbayObjectKeywordRange[] {
  return getPatchbayObjectReferenceTokenRanges(source, 'keyword', 'cm-patchbay-object-keyword');
}

export function getPatchbayObjectAssignmentRanges(source: string): PatchbayObjectAssignmentRange[] {
  return getPatchbayObjectAliasTokenRanges(source, 1, 'cm-patchbay-object-assignment');
}

export function getPatchbayObjectNameRanges(source: string): PatchbayObjectNameRange[] {
  const lineStarts = getLineStarts(source);
  const objectAliases = getPatchbayObjectAliases(source);
  const ranges = getPatchbayObjectAliasTokenRanges(source, 0, 'cm-patchbay-object-name');
  const seenRanges = new Set(ranges.map((range) => `${range.from}:${range.to}`));
  let currentSection: PatchbaySection | undefined;

  source.split(/\r?\n/).forEach((line, lineIndex) => {
    const lineTokens = tokenizePatchbayLine(line);
    if (isObjectAliasDeclarationTokens(lineTokens)) return;

    let searchStart = 0;
    let skipObjectId = false;

    for (const token of lineTokens) {
      const column = line.indexOf(token.text, searchStart);
      if (column === -1) continue;

      searchStart = column + token.text.length;

      const section = parseSectionToken(token);
      if (section) {
        currentSection = section;
        continue;
      }

      if (token.text === 'obj' && token.style === 'keyword') {
        skipObjectId = true;
        continue;
      }

      if (token.style !== 'variableName') continue;
      if (skipObjectId) {
        skipObjectId = false;
        continue;
      }
      if (!currentSection) continue;
      if (!objectAliases.has(getChannelKey(currentSection, token.text))) continue;

      const from = lineStarts[lineIndex] + column;
      const rangeKey = `${from}:${from + token.text.length}`;
      if (seenRanges.has(rangeKey)) continue;

      seenRanges.add(rangeKey);
      ranges.push({
        from,
        to: from + token.text.length,
        className: 'cm-patchbay-object-name'
      });
    }
  });

  return ranges;
}

export function getPatchbayObjectIdRanges(source: string): PatchbayObjectIdRange[] {
  return getPatchbayObjectReferenceTokenRanges(source, 'id', 'cm-patchbay-object-id');
}

function getPatchbayObjectReferenceTokenRanges(
  source: string,
  tokenKind: 'keyword' | 'id',
  className: string
): Array<{ from: number; to: number; className: string }> {
  const lineStarts = getLineStarts(source);
  const ranges: Array<{ from: number; to: number; className: string }> = [];

  source.split(/\r?\n/).forEach((line, lineIndex) => {
    let searchStart = 0;
    let previousWasObjectKeyword = false;

    for (const token of tokenizePatchbayLine(line)) {
      const column = line.indexOf(token.text, searchStart);
      if (column === -1) continue;

      searchStart = column + token.text.length;

      if (token.text === 'obj' && token.style === 'keyword') {
        previousWasObjectKeyword = true;

        if (tokenKind === 'keyword') {
          const from = lineStarts[lineIndex] + column;
          ranges.push({ from, to: from + token.text.length, className });
        }

        continue;
      }

      if (previousWasObjectKeyword && token.style === 'variableName') {
        if (tokenKind === 'id') {
          const nodeId = token.text.replace(/:\d+$/, '');
          const from = lineStarts[lineIndex] + column;
          ranges.push({ from, to: from + nodeId.length, className });
        }

        previousWasObjectKeyword = false;
        continue;
      }

      previousWasObjectKeyword = false;
    }
  });

  return ranges;
}

function isObjectAliasDeclarationTokens(tokens: PatchbayLineToken[]): boolean {
  return (
    tokens[0]?.style === 'variableName' &&
    tokens[1]?.text === '=' &&
    tokens[1]?.style === 'operator' &&
    tokens[2]?.text === 'obj' &&
    tokens[2]?.style === 'keyword' &&
    tokens[3]?.style === 'variableName'
  );
}

function getPatchbayObjectAliasTokenRanges(
  source: string,
  tokenIndex: 0 | 1 | 2 | 3,
  className: string
): Array<{ from: number; to: number; className: string }> {
  const lineStarts = getLineStarts(source);
  const ranges: Array<{ from: number; to: number; className: string }> = [];
  let currentSection: PatchbaySection | undefined;

  source.split(/\r?\n/).forEach((line, lineIndex) => {
    const tokens = tokenizePatchbayLine(line);
    const section = parseSectionToken(tokens[0]);
    if (section) {
      currentSection = section;
      return;
    }

    if (!currentSection || !isObjectAliasDeclarationTokens(tokens)) {
      return;
    }

    const previousToken = tokenIndex > 0 ? tokens[tokenIndex - 1] : undefined;
    const token = tokens[tokenIndex];
    const searchStart = previousToken
      ? line.indexOf(previousToken.text) + previousToken.text.length
      : 0;
    const column = line.indexOf(token.text, searchStart);
    if (column === -1) return;

    const from = lineStarts[lineIndex] + column;
    ranges.push({
      from,
      to: from + token.text.length,
      className
    });
  });

  return ranges;
}

function getPatchbayObjectAliases(source: string): Map<string, string> {
  const aliases = new Map<string, string>();
  let currentSection: PatchbaySection | undefined;

  for (const line of source.split(/\r?\n/)) {
    const tokens = tokenizePatchbayLine(line);
    const section = parseSectionToken(tokens[0]);
    if (section) {
      currentSection = section;
      continue;
    }

    if (
      currentSection &&
      tokens[0]?.style === 'variableName' &&
      tokens[1]?.text === '=' &&
      tokens[1]?.style === 'operator' &&
      tokens[2]?.text === 'obj' &&
      tokens[2]?.style === 'keyword' &&
      tokens[3]?.style === 'variableName'
    ) {
      aliases.set(
        getChannelKey(currentSection, tokens[0].text),
        tokens[3].text.replace(/:\d+$/, '')
      );
    }
  }

  return aliases;
}

function getPatchbayLocalChannels(source: string): Set<string> {
  const channels = new Set<string>();
  let currentSection: PatchbaySection | undefined;

  for (const line of source.split(/\r?\n/)) {
    const tokens = tokenizePatchbayLine(line);
    const section = parseSectionToken(tokens[0]);
    if (section) {
      currentSection = section;
      continue;
    }

    if (tokens[0]?.text !== 'chan') continue;

    const channel = tokens[1];
    if (currentSection && channel?.style === 'variableName') {
      channels.add(getChannelKey(currentSection, channel.text));
    }
  }

  return channels;
}

function normalizeRolesBySection(
  registryChannels: PatchbayChannelRoles | PatchbayChannelRolesBySection
): PatchbayChannelRolesBySection {
  if ('senders' in registryChannels && 'receivers' in registryChannels) {
    return { message: registryChannels };
  }

  return registryChannels;
}

function parseSectionToken(token: PatchbayLineToken | undefined): PatchbaySection | undefined {
  if (!token || token.style !== 'typeName') return undefined;

  const section = token.text.slice(1, -1).toLowerCase();
  return section === 'message' || section === 'audio' || section === 'video' ? section : undefined;
}

function getChannelKey(section: PatchbaySection, channel: string): string {
  return `${section}\0${channel}`;
}

function getLineStarts(source: string): number[] {
  const starts = [0];

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') {
      starts.push(index + 1);
    }
  }

  return starts;
}

function readPatchbayTokenFromText(text: string): PatchbayLineToken | null {
  const comment = text.match(/^\/\/.*/);
  if (comment) return { text: comment[0], style: 'comment' };

  const section = text.match(sectionPattern);
  if (section) return { text: section[0], style: 'typeName' };

  const keyword = text.match(/^(chan|obj)\b/);
  if (keyword) return { text: keyword[0], style: 'keyword' };

  if (text.startsWith('->')) return { text: '->', style: 'operator' };
  if (text.startsWith('=')) return { text: '=', style: 'operator' };

  const identifier = text.match(identifierPattern);
  if (identifier) return { text: identifier[0], style: 'variableName' };

  return null;
}

const patchbayParser: StreamParser<null> = {
  name: 'patchbay',
  token(stream: StringStream) {
    if (stream.eatSpace()) return null;

    const text = stream.string.slice(stream.pos);
    const token = readPatchbayTokenFromText(text);

    if (token) {
      stream.pos += token.text.length;
      return token.style;
    }

    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: '//' }
  }
};

export const patchbayLanguage = StreamLanguage.define(patchbayParser);

export function patchbaySectionCompletions(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const linePrefix = line.text.slice(0, context.pos - line.from);
  const sectionResult = getPatchbaySectionCompletion(line.from, linePrefix);
  if (sectionResult) return sectionResult;

  return getPatchbayObjectKeywordCompletion(line.from, linePrefix);
}

function getPatchbaySectionCompletion(
  lineFrom: number,
  linePrefix: string
): CompletionResult | null {
  const match = linePrefix.match(/^(\s*)(\[[A-Za-z]*)$/);
  if (!match) return null;

  const typedText = match[2].toLowerCase();
  const options = sectionCompletionOptions.filter((option) =>
    option.label.toLowerCase().startsWith(typedText)
  );
  if (options.length === 0) return null;

  return {
    from: lineFrom + match[1].length,
    options,
    validFor: /^\[[A-Za-z]*$/
  };
}

function getPatchbayObjectKeywordCompletion(
  lineFrom: number,
  linePrefix: string
): CompletionResult | null {
  const match = linePrefix.match(/(?:^|\s)(o(?:bj)?)$/);
  if (!match || !objCompletionOption.label.startsWith(match[1])) return null;

  const typedStart = linePrefix.length - match[1].length;
  const beforeTypedText = linePrefix.slice(0, typedStart);
  if (!canStartObjectEndpoint(beforeTypedText)) return null;

  return {
    from: lineFrom + typedStart,
    options: [objCompletionOption],
    validFor: /^obj?$/
  };
}

function canStartObjectEndpoint(linePrefix: string): boolean {
  const trimmed = linePrefix.trimEnd();
  if (trimmed === '') return true;
  if (trimmed.endsWith('->') || trimmed.endsWith('=')) return true;

  return false;
}

const patchbayHighlightStyle = HighlightStyle.define([
  { tag: tags.typeName, color: '#7dcfff' },
  { tag: tags.keyword, color: '#bb9af7' },
  { tag: tags.operator, color: '#ff9e64' },
  { tag: tags.variableName, color: '#c0caf5' },
  { tag: tags.comment, color: '#565f89' }
]);

export function patchbay(): LanguageSupport {
  return new LanguageSupport(patchbayLanguage, [
    patchbayLanguage.data.of({ autocomplete: patchbaySectionCompletions }),
    syntaxHighlighting(patchbayHighlightStyle)
  ]);
}
