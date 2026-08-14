import {
  CompletionContext as CMCompletionContext,
  type Completion
} from '@codemirror/autocomplete';

const asmCompletions: Completion[] = [
  {
    label: 'noop',
    type: 'keyword',
    detail: '( -- )',
    info: 'Do nothing.',
    apply: 'noop'
  },
  {
    label: 'push',
    type: 'keyword',
    detail: '( -- n )',
    info: 'Push a value onto the stack.',
    apply: 'push 0'
  },
  {
    label: 'pop',
    type: 'keyword',
    detail: '( a -- )',
    info: 'Remove the top stack value.',
    apply: 'pop'
  },
  {
    label: 'dup',
    type: 'keyword',
    detail: '( a -- a a )',
    info: 'Duplicate the top stack value.',
    apply: 'dup'
  },
  {
    label: 'swap',
    type: 'keyword',
    detail: '( a b -- b a )',
    info: 'Swap the top two stack values.',
    apply: 'swap'
  },
  {
    label: 'over',
    type: 'keyword',
    detail: '( a b -- a b a )',
    info: 'Copy the second stack value to the top.',
    apply: 'over'
  },
  {
    label: 'rotate',
    type: 'keyword',
    detail: '( a b c -- b c a )',
    info: 'Rotate the top three stack values.',
    apply: 'rotate'
  },
  {
    label: 'nip',
    type: 'keyword',
    detail: '( a b -- b )',
    info: 'Remove the second stack value.',
    apply: 'nip'
  },
  {
    label: 'tuck',
    type: 'keyword',
    detail: '( a b -- b a b )',
    info: 'Copy the top stack value below the second.',
    apply: 'tuck'
  },
  {
    label: 'pick',
    type: 'keyword',
    detail: '( -- v )',
    info: 'Copy the nth stack value to the top (0 is dup, 1 is over).',
    apply: 'pick 0'
  },
  {
    label: 'inc',
    type: 'keyword',
    detail: '( a -- a + 1 )',
    info: 'Increment the top stack value.',
    apply: 'inc'
  },
  {
    label: 'dec',
    type: 'keyword',
    detail: '( a -- a - 1 )',
    info: 'Decrement the top stack value.',
    apply: 'dec'
  },
  {
    label: 'add',
    type: 'keyword',
    detail: '( a b -- a + b )',
    info: 'Add the top two stack values.',
    apply: 'add'
  },
  {
    label: 'sub',
    type: 'keyword',
    detail: '( a b -- a - b )',
    info: 'Subtract the top stack value from the next.',
    apply: 'sub'
  },
  {
    label: 'mul',
    type: 'keyword',
    detail: '( a b -- a * b )',
    info: 'Multiply the top two stack values.',
    apply: 'mul'
  },
  {
    label: 'div',
    type: 'keyword',
    detail: '( a b -- a / b )',
    info: 'Divide the next stack value by the top value.',
    apply: 'div'
  },
  {
    label: 'mod',
    type: 'keyword',
    detail: '( a b -- a % b )',
    info: 'Take the modulo of the top two stack values.',
    apply: 'mod'
  },
  {
    label: 'equal',
    type: 'keyword',
    detail: '( a b -- flag )',
    info: 'Push 1 when the top two stack values are equal, otherwise 0.',
    apply: 'equal'
  },
  {
    label: 'not_equal',
    type: 'keyword',
    detail: '( a b -- flag )',
    info: 'Push 1 when the top two stack values are not equal, otherwise 0.',
    apply: 'not_equal'
  },
  {
    label: 'less_than',
    type: 'keyword',
    detail: '( a b -- flag )',
    info: 'Push 1 when a is less than b, otherwise 0.',
    apply: 'less_than'
  },
  {
    label: 'less_than_or_equal',
    type: 'keyword',
    detail: '( a b -- flag )',
    info: 'Push 1 when a is less than or equal to b, otherwise 0.',
    apply: 'less_than_or_equal'
  },
  {
    label: 'greater_than',
    type: 'keyword',
    detail: '( a b -- flag )',
    info: 'Push 1 when a is greater than b, otherwise 0.',
    apply: 'greater_than'
  },
  {
    label: 'greater_than_or_equal',
    type: 'keyword',
    detail: '( a b -- flag )',
    info: 'Push 1 when a is greater than or equal to b, otherwise 0.',
    apply: 'greater_than_or_equal'
  },
  {
    label: 'and',
    type: 'keyword',
    detail: '( a b -- a & b )',
    info: 'Bitwise AND the top two stack values.',
    apply: 'and'
  },
  {
    label: 'or',
    type: 'keyword',
    detail: '( a b -- a | b )',
    info: 'Bitwise OR the top two stack values.',
    apply: 'or'
  },
  {
    label: 'xor',
    type: 'keyword',
    detail: '( a b -- a ^ b )',
    info: 'Bitwise XOR the top two stack values.',
    apply: 'xor'
  },
  {
    label: 'not',
    type: 'keyword',
    detail: '( a -- ~a )',
    info: 'Bitwise NOT the top stack value.',
    apply: 'not'
  },
  {
    label: 'left_shift',
    type: 'keyword',
    detail: '( a b -- a << b )',
    info: 'Shift a left by b bits.',
    apply: 'left_shift'
  },
  {
    label: 'right_shift',
    type: 'keyword',
    detail: '( a b -- a >> b )',
    info: 'Shift a right by b bits.',
    apply: 'right_shift'
  },
  {
    label: 'jump',
    type: 'keyword',
    detail: '( -- )',
    info: 'Unconditionally jump to a label or address.',
    apply: 'jump label'
  },
  {
    label: 'jump_zero',
    type: 'keyword',
    detail: '( a -- )',
    info: 'Jump to a label or address when the top stack value is 0.',
    apply: 'jump_zero label'
  },
  {
    label: 'jump_not_zero',
    type: 'keyword',
    detail: '( a -- )',
    info: 'Jump to a label or address when the top stack value is not 0.',
    apply: 'jump_not_zero label'
  },
  {
    label: 'call',
    type: 'keyword',
    detail: '( -- )',
    info: 'Save the program counter and jump to a label or address.',
    apply: 'call function'
  },
  {
    label: 'return',
    type: 'keyword',
    detail: '( -- )',
    info: 'Return to the instruction after the last call.',
    apply: 'return'
  },
  {
    label: 'halt',
    type: 'keyword',
    detail: '( -- )',
    info: 'Stop program execution.',
    apply: 'halt'
  },
  {
    label: 'load',
    type: 'keyword',
    detail: '( -- v )',
    info: 'Push the value at an address onto the stack.',
    apply: 'load 0xF00'
  },
  {
    label: 'store',
    type: 'keyword',
    detail: '( v -- )',
    info: 'Pop a stack value and store it at an address.',
    apply: 'store 0xF00'
  },
  {
    label: 'read',
    type: 'keyword',
    detail: '( addr -- v1..vn )',
    info: 'Read n values from the address on the stack.',
    apply: 'read 1'
  },
  {
    label: 'write',
    type: 'keyword',
    detail: '( v1..vn addr -- )',
    info: 'Write n stack values to the address on the stack.',
    apply: 'write 1'
  },
  {
    label: 'load_string',
    type: 'keyword',
    detail: '( -- bytes.. )',
    info: 'Push a null-terminated string from an address or .string key.',
    apply: 'load_string text'
  },
  {
    label: 'send',
    type: 'keyword',
    detail: '( v1..vn -- )',
    info: 'Send n stack values to an outlet port.',
    apply: 'send 0 1'
  },
  {
    label: 'recv',
    type: 'keyword',
    detail: '( -- v )',
    info: 'Wait for an input value and push it onto the stack.',
    apply: 'recv'
  },
  {
    label: 'print',
    type: 'keyword',
    detail: '( bytes.. -- )',
    info: 'Pop bytes through a null terminator and print them to the console.',
    apply: 'print'
  },
  {
    label: 'sleep_tick',
    type: 'keyword',
    detail: '( n -- )',
    info: 'Sleep for n clock ticks.',
    apply: 'sleep_tick'
  },
  {
    label: 'sleep_ms',
    type: 'keyword',
    detail: '( n -- )',
    info: 'Sleep for n milliseconds.',
    apply: 'sleep_ms'
  },
  {
    label: '.string',
    type: 'keyword',
    detail: '.string key "value"',
    info: 'Define a null-terminated string constant.',
    apply: '.string text ""'
  },
  {
    label: '.value',
    type: 'keyword',
    detail: '.value key value',
    info: 'Define a numeric constant.',
    apply: '.value value 0'
  }
];

const keywordOnlyAsmCompletions = asmCompletions.map(
  ({ apply: _apply, ...completion }) => completion
);

function isInsideAssemblyComment(context: CMCompletionContext): boolean {
  const line = context.state.doc.lineAt(context.pos);
  const commentStart = line.text.indexOf(';');

  return commentStart !== -1 && context.pos - line.from > commentStart;
}

export function createAsmCompletionSource() {
  return (context: CMCompletionContext) => {
    const word = context.matchBefore(/\.?[A-Za-z_][\w_]*/);

    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;
    if (isInsideAssemblyComment(context)) return null;

    const typedText = context.state.doc.sliceString(word.from, word.to).toLowerCase();

    return {
      from: word.from,
      options: keywordOnlyAsmCompletions.filter((completion) =>
        completion.label.startsWith(typedText)
      ),
      validFor: /\.?[A-Za-z_][\w_]*$/
    };
  };
}

export const asmCompletionsSource = createAsmCompletionSource();

export const getAsmCompletionByLabel = (label: string): Completion | undefined =>
  asmCompletions.find((completion) => completion.label === label);
