import {
  HighlightStyle,
  LanguageSupport,
  StreamLanguage,
  syntaxHighlighting,
  type StreamParser,
  type StringStream
} from '@codemirror/language';
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

export type PatchbayChannelRoles = {
  senders: Set<string>;
  receivers: Set<string>;
};

export type PatchbayChannelRolesBySection = Partial<Record<PatchbaySection, PatchbayChannelRoles>>;

const identifierPattern = /^[A-Za-z0-9_.~/:-]+/;
const sectionPattern = /^\[(Message|Audio|Video)\]/i;

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
        ['unknown-channel', 'receiver-as-source', 'sender-as-target'].includes(diagnostic.code)
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
  const rolesBySection = normalizeRolesBySection(registryChannels);
  const ranges: PatchbayChannelLinkRange[] = [];
  let currentSection: PatchbaySection | undefined;

  source.split(/\r?\n/).forEach((line, lineIndex) => {
    let searchStart = 0;

    for (const token of tokenizePatchbayLine(line)) {
      const column = line.indexOf(token.text, searchStart);
      if (column === -1) continue;

      searchStart = column + token.text.length;

      const section = parseSectionToken(token);
      if (section) {
        currentSection = section;
        continue;
      }

      if (token.style !== 'variableName') continue;
      if (!currentSection) continue;
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

    for (const token of tokenizePatchbayLine(line)) {
      const column = line.indexOf(token.text, searchStart);
      if (column === -1) continue;

      searchStart = column + token.text.length;

      const section = parseSectionToken(token);
      if (section) {
        currentSection = section;
        continue;
      }

      if (token.style !== 'variableName') continue;
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

  const keyword = text.match(/^chan\b/);
  if (keyword) return { text: keyword[0], style: 'keyword' };

  if (text.startsWith('->')) return { text: '->', style: 'operator' };

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

const patchbayHighlightStyle = HighlightStyle.define([
  { tag: tags.typeName, color: '#7dcfff' },
  { tag: tags.keyword, color: '#bb9af7' },
  { tag: tags.operator, color: '#ff9e64' },
  { tag: tags.variableName, color: '#c0caf5' },
  { tag: tags.comment, color: '#565f89' }
]);

export function patchbay(): LanguageSupport {
  return new LanguageSupport(patchbayLanguage, [syntaxHighlighting(patchbayHighlightStyle)]);
}
