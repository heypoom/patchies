import { match } from 'ts-pattern';

export interface ChatNodeContext {
  nodeId: string;
  nodeType: string;
  nodeData?: Record<string, unknown>;
  consoleErrors?: string[];
}

export interface SelectedChatNodeInfo {
  type: string;
  id: string;
  data?: Record<string, unknown>;
}

export const buildChatNodeContexts = (
  selectedNodes: SelectedChatNodeInfo[] | null | undefined,
  getErrors: (nodeId: string) => string[]
): ChatNodeContext[] =>
  (selectedNodes ?? []).map((node) => {
    const errors = getErrors(node.id);

    return {
      nodeId: node.id,
      nodeType: node.type,
      nodeData: node.data,
      consoleErrors: errors.length > 0 ? errors : undefined
    };
  });

export const getNodeContextLabel = (context: ChatNodeContext): string =>
  (context.nodeData?.name as string | undefined) ||
  (context.nodeData?.title as string | undefined) ||
  context.nodeType;

export const formatNodeContextLabel = (contexts: ChatNodeContext[]): string =>
  match(contexts.length)
    .with(0, () => '')
    .with(1, () => getNodeContextLabel(contexts[0]))
    .with(2, () => `${getNodeContextLabel(contexts[0])} and ${getNodeContextLabel(contexts[1])}`)
    .otherwise(
      (count) =>
        `${getNodeContextLabel(contexts[0])}, ${getNodeContextLabel(contexts[1])} and ${count - 2} more`
    );

export const buildNodeContextSystemInstruction = (contexts: ChatNodeContext[]): string =>
  match(contexts.length)
    .with(0, () => '')
    .with(1, () => buildSingleNodeInstruction(contexts[0]))
    .otherwise((count) => {
      const selectedNodes = contexts
        .map((context, index) => buildSelectedNodeEntry(context, index + 1))
        .join('\n\n');

      return `\n\nThe user currently has ${count} nodes selected. When performing canvas actions on one of these nodes, use the matching node ID.\n\nSelected nodes:\n${selectedNodes}`;
    });

function buildSingleNodeInstruction(context: ChatNodeContext): string {
  let instruction = `\n\nThe user currently has a "${context.nodeType}" node selected (ID: "${context.nodeId}"). When performing canvas actions on this node, use nodeId "${context.nodeId}".`;

  instruction += buildNodeDataInstruction(context, 'Current node data:');
  instruction += buildConsoleErrorsInstruction(context);

  return instruction;
}

function buildSelectedNodeEntry(context: ChatNodeContext, index: number): string {
  let entry = `${index}. "${context.nodeType}" node (ID: "${context.nodeId}")`;

  entry += buildNodeDataInstruction(context, 'Node data:');
  entry += buildConsoleErrorsInstruction(context);

  return entry;
}

function buildNodeDataInstruction(context: ChatNodeContext, label: string): string {
  if (!context.nodeData || Object.keys(context.nodeData).length === 0) {
    return '';
  }

  try {
    const serialized = JSON.stringify(context.nodeData, null, 2);

    return `\n${label}\n${serialized}`;
  } catch {
    return '';
  }
}

function buildConsoleErrorsInstruction(context: ChatNodeContext): string {
  if (!context.consoleErrors || context.consoleErrors.length === 0) {
    return '';
  }

  return `\n\nThe selected "${context.nodeType}" node (ID: "${context.nodeId}") has console errors:\n${context.consoleErrors.map((e) => `- ${e}`).join('\n')}`;
}
