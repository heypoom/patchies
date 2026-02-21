/**
 * Uiua Primitive Documentation
 *
 * Adapted from array-box (https://github.com/codereport/array-box)
 * Original source: https://raw.githubusercontent.com/uiua-lang/uiua/main/site/primitives.json
 *
 * LICENSE ATTRIBUTION:
 * The documentation content in this file is derived from the Uiua project.
 * Copyright (c) 2023 Kai Schmidt
 * Repository: https://github.com/uiua-lang/uiua
 * License: MIT License
 */

/** Delay in ms before showing glyph tooltips (shared by CodeMirror and preview mode) */
export const UIUA_TOOLTIP_DELAY_MS = 300;

export interface UiuaGlyphDoc {
  glyph: string;
  type: string;
  name: string;
  description: string;
  signature: string;
  docUrl: string;
}

export const uiuaGlyphDocs: Record<string, UiuaGlyphDoc> = {
  '⌵': {
    glyph: '⌵',
    type: 'monadic function',
    name: 'absolute value',
    description: 'Get the absolute value of a number',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/absolute-value'
  },
  '+': {
    glyph: '+',
    type: 'dyadic function',
    name: 'add',
    description: 'Add values',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/add'
  },
  '⌝': {
    glyph: '⌝',
    type: 'monadic modifier',
    name: 'anti',
    description: 'Invert the behavior of a function, treating its first argument as a constant',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/anti'
  },
  '?': {
    glyph: '?',
    type: 'stack',
    name: 'args',
    description: 'Debug print all arguments without consuming them',
    signature: '0 → 0',
    docUrl: 'https://www.uiua.org/docs/args'
  },
  '⍤': {
    glyph: '⍤',
    type: 'dyadic function',
    name: 'assert',
    description: 'Throw an error if a condition is not met',
    signature: '2 → 0',
    docUrl: 'https://www.uiua.org/docs/assert'
  },
  '∠': {
    glyph: '∠',
    type: 'dyadic function',
    name: 'atangent',
    description: 'Take the arctangent of two numbers',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/atangent'
  },
  '˜': {
    glyph: '˜',
    type: 'monadic modifier',
    name: 'backward',
    description: 'Call a function with its arguments swapped',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/backward'
  },
  '⊥': {
    glyph: '⊥',
    type: 'dyadic function',
    name: 'base',
    description: 'Get the base digits of a number',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/base'
  },
  '◡': {
    glyph: '◡',
    type: 'monadic modifier',
    name: 'below',
    description: 'Keep all arguments to a function after the outputs',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/below'
  },
  '⋯': {
    glyph: '⋯',
    type: 'monadic function',
    name: 'bits',
    description: 'Encode an array as bits (LSB-first)',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/bits'
  },
  '∩': {
    glyph: '∩',
    type: 'monadic modifier',
    name: 'both',
    description: 'Call a function on two sets of values',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/both'
  },
  '□': {
    glyph: '□',
    type: 'monadic function',
    name: 'box',
    description: 'Turn an array into a box',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/box'
  },
  '⊓': {
    glyph: '⊓',
    type: 'dyadic modifier',
    name: 'bracket',
    description: 'Call two functions on two distinct sets of values',
    signature: '|2|',
    docUrl: 'https://www.uiua.org/docs/bracket'
  },
  '⊸': {
    glyph: '⊸',
    type: 'monadic modifier',
    name: 'by',
    description: 'Call a function but keep its last argument after its outputs',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/by'
  },
  '⍩': {
    glyph: '⍩',
    type: 'monadic modifier',
    name: 'case',
    description: 'Call a pattern matching case',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/case'
  },
  '⌈': {
    glyph: '⌈',
    type: 'monadic function',
    name: 'ceiling',
    description: 'Round to the nearest integer towards ∞',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/ceiling'
  },
  '⊛': {
    glyph: '⊛',
    type: 'monadic function',
    name: 'classify',
    description: 'Assign a unique index to each unique row in an array',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/classify'
  },
  ℂ: {
    glyph: 'ℂ',
    type: 'dyadic function',
    name: 'complex',
    description: 'Make a complex number',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/complex'
  },
  '◇': {
    glyph: '◇',
    type: 'monadic modifier',
    name: 'content',
    description: 'Unbox the arguments to a function before calling it',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/content'
  },
  '⊟': {
    glyph: '⊟',
    type: 'dyadic function',
    name: 'couple',
    description: 'Combine two arrays as rows of a new array',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/couple'
  },
  '◴': {
    glyph: '◴',
    type: 'monadic function',
    name: 'deduplicate',
    description: 'Remove duplicate rows from an array',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/deduplicate'
  },
  '∂': {
    glyph: '∂',
    type: 'monadic modifier',
    name: 'derivative',
    description: 'Calculate the derivative of a mathematical expression',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/derivative'
  },
  '♭': {
    glyph: '♭',
    type: 'monadic function',
    name: 'deshape',
    description: 'Make an array 1-dimensional',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/deshape'
  },
  '⊙': {
    glyph: '⊙',
    type: 'monadic modifier',
    name: 'dip',
    description: 'Skip the first argument and call a function on later arguments',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/dip'
  },
  '÷': {
    glyph: '÷',
    type: 'dyadic function',
    name: 'divide',
    description: 'Divide values',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/divide'
  },
  '⍢': {
    glyph: '⍢',
    type: 'dyadic modifier',
    name: 'do',
    description: 'Repeat a function while a condition holds',
    signature: '|2|',
    docUrl: 'https://www.uiua.org/docs/do'
  },
  '↘': {
    glyph: '↘',
    type: 'dyadic function',
    name: 'drop',
    description: 'Drop the first n rows of an array',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/drop'
  },
  '=': {
    glyph: '=',
    type: 'dyadic function',
    name: 'equals',
    description: 'Compare for equality',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/equals'
  },
  η: {
    glyph: 'η',
    type: 'constant',
    name: 'eta',
    description: 'The number of radians in a quarter circle',
    signature: '0 → 1',
    docUrl: 'https://www.uiua.org/docs/eta'
  },
  '⧋': {
    glyph: '⧋',
    type: 'monadic modifier',
    name: 'evert',
    description: "Call a function with its arguments' axes reversed",
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/evert'
  },
  ₑ: {
    glyph: 'ₑ',
    type: 'monadic function',
    name: 'exponential',
    description: 'Get the exponential of a number',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/exponential'
  },
  '⍖': {
    glyph: '⍖',
    type: 'monadic function',
    name: 'fall',
    description: 'Get the indices into an array if it were sorted descending',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/fall'
  },
  '⬚': {
    glyph: '⬚',
    type: 'dyadic modifier',
    name: 'fill',
    description: 'Set the fill value for a function',
    signature: '|2|',
    docUrl: 'https://www.uiua.org/docs/fill'
  },
  '⌕': {
    glyph: '⌕',
    type: 'dyadic function',
    name: 'find',
    description: 'Find the occurrences of one array in another',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/find'
  },
  '⊢': {
    glyph: '⊢',
    type: 'monadic function',
    name: 'first',
    description: 'Get the first row of an array',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/first'
  },
  '¤': {
    glyph: '¤',
    type: 'monadic function',
    name: 'fix',
    description: 'Add a length-1 axis to an array',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/fix'
  },
  '⌊': {
    glyph: '⌊',
    type: 'monadic function',
    name: 'floor',
    description: 'Round to the nearest integer towards ¯∞',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/floor'
  },
  '∧': {
    glyph: '∧',
    type: 'monadic modifier',
    name: 'fold',
    description: 'Apply a function to aggregate arrays',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/fold'
  },
  '⊃': {
    glyph: '⊃',
    type: 'dyadic modifier',
    name: 'fork',
    description: 'Call two functions on the same values',
    signature: '|2|',
    docUrl: 'https://www.uiua.org/docs/fork'
  },
  '⋅': {
    glyph: '⋅',
    type: 'monadic modifier',
    name: 'gap',
    description: 'Discard the first argument then call a function',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/gap'
  },
  '⩜': {
    glyph: '⩜',
    type: 'monadic modifier',
    name: 'geometric',
    description: 'Convert an operation to be in geometric algebra',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/geometric'
  },
  '≥': {
    glyph: '≥',
    type: 'dyadic function',
    name: 'greater or equal',
    description: 'Compare for greater than or equal',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/greater-or-equal'
  },
  '>': {
    glyph: '>',
    type: 'dyadic function',
    name: 'greater than',
    description: 'Compare for greater than',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/greater-than'
  },
  '⊕': {
    glyph: '⊕',
    type: 'monadic modifier',
    name: 'group',
    description: 'Group elements of an array into buckets by index',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/group'
  },
  '∘': {
    glyph: '∘',
    type: 'stack',
    name: 'identity',
    description: 'Do nothing with one value',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/identity'
  },
  '⨂': {
    glyph: '⨂',
    type: 'dyadic function',
    name: 'indexin',
    description: 'Find the first index in an array of each row of another array',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/indexin'
  },
  '∞': {
    glyph: '∞',
    type: 'constant',
    name: 'infinity',
    description: 'The biggest number',
    signature: '0 → 1',
    docUrl: 'https://www.uiua.org/docs/infinity'
  },
  '∫': {
    glyph: '∫',
    type: 'monadic modifier',
    name: 'integral',
    description: 'Calculate an antiderivative of a mathematical expression',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/integral'
  },
  '⍚': {
    glyph: '⍚',
    type: 'monadic modifier',
    name: 'inventory',
    description: 'Apply a function to each unboxed row of an array and re-box the results',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/inventory'
  },
  '⊂': {
    glyph: '⊂',
    type: 'dyadic function',
    name: 'join',
    description: 'Append two arrays end-to-end',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/join'
  },
  '▽': {
    glyph: '▽',
    type: 'dyadic function',
    name: 'keep',
    description: 'Discard or copy some rows of an array',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/keep'
  },
  '⊣': {
    glyph: '⊣',
    type: 'monadic function',
    name: 'last',
    description: 'Get the last row of an array',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/last'
  },
  '⧻': {
    glyph: '⧻',
    type: 'monadic function',
    name: 'length',
    description: 'Get the number of rows in an array',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/length'
  },
  '≤': {
    glyph: '≤',
    type: 'dyadic function',
    name: 'less or equal',
    description: 'Compare for less than or equal',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/less-or-equal'
  },
  '<': {
    glyph: '<',
    type: 'dyadic function',
    name: 'less than',
    description: 'Compare for less than',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/less-than'
  },
  '⦷': {
    glyph: '⦷',
    type: 'dyadic function',
    name: 'mask',
    description: 'Mask the occurrences of one array in another',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/mask'
  },
  '≍': {
    glyph: '≍',
    type: 'dyadic function',
    name: 'match',
    description: 'Check if two arrays are exactly the same',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/match'
  },
  '↥': {
    glyph: '↥',
    type: 'dyadic function',
    name: 'maximum',
    description: 'Take the maximum of two arrays',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/maximum'
  },
  '∊': {
    glyph: '∊',
    type: 'dyadic function',
    name: 'memberof',
    description: 'Check if each row of one array exists in another',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/memberof'
  },
  '↧': {
    glyph: '↧',
    type: 'dyadic function',
    name: 'minimum',
    description: 'Take the minimum of two arrays',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/minimum'
  },
  '◿': {
    glyph: '◿',
    type: 'dyadic function',
    name: 'modulo',
    description: 'Modulo values',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/modulo'
  },
  '×': {
    glyph: '×',
    type: 'dyadic function',
    name: 'multiply',
    description: 'Multiply values',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/multiply'
  },
  '¯': {
    glyph: '¯',
    type: 'monadic function',
    name: 'negate',
    description: 'Negate a number',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/negate'
  },
  '¬': {
    glyph: '¬',
    type: 'monadic function',
    name: 'not',
    description: 'Logical not',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/not'
  },
  '≠': {
    glyph: '≠',
    type: 'dyadic function',
    name: 'not equals',
    description: 'Compare for inequality',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/not-equals'
  },
  '⌅': {
    glyph: '⌅',
    type: 'monadic modifier',
    name: 'obverse',
    description: 'Define the various inverses of a function',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/obverse'
  },
  '⧆': {
    glyph: '⧆',
    type: 'monadic function',
    name: 'occurrences',
    description: 'Mark each row of an array with its occurrence count',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/occurrences'
  },
  '⤚': {
    glyph: '⤚',
    type: 'monadic modifier',
    name: 'off',
    description: 'Call a function but keep its first argument after its outputs',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/off'
  },
  '⟜': {
    glyph: '⟜',
    type: 'monadic modifier',
    name: 'on',
    description: 'Call a function but keep its first argument before its outputs',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/on'
  },
  '∨': {
    glyph: '∨',
    type: 'dyadic function',
    name: 'or',
    description: 'Logical OR and greatest common divisor',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/or'
  },
  '⤸': {
    glyph: '⤸',
    type: 'dyadic function',
    name: 'orient',
    description: 'Change the order of the axes of an array',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/orient'
  },
  '⋕': {
    glyph: '⋕',
    type: 'monadic function',
    name: 'parse',
    description: 'Parse a string as a number',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/parse'
  },
  '⊜': {
    glyph: '⊜',
    type: 'monadic modifier',
    name: 'partition',
    description: 'Group sequential sections of an array',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/partition'
  },
  π: {
    glyph: 'π',
    type: 'constant',
    name: 'pi',
    description: "The ratio of a circle's circumference to its diameter",
    signature: '0 → 1',
    docUrl: 'https://www.uiua.org/docs/pi'
  },
  '⊡': {
    glyph: '⊡',
    type: 'dyadic function',
    name: 'pick',
    description: 'Index a row or elements from an array',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/pick'
  },
  '◌': {
    glyph: '◌',
    type: 'stack',
    name: 'pop',
    description: 'Discard the first argument',
    signature: '1 → 0',
    docUrl: 'https://www.uiua.org/docs/pop'
  },
  ⁿ: {
    glyph: 'ⁿ',
    type: 'dyadic function',
    name: 'power',
    description: 'Raise a value to a power',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/power'
  },
  '⚂': {
    glyph: '⚂',
    type: 'monadic function',
    name: 'random',
    description: 'Generate a random number in the range [0, 1)',
    signature: '0 → 1',
    docUrl: 'https://www.uiua.org/docs/random'
  },
  '⇡': {
    glyph: '⇡',
    type: 'monadic function',
    name: 'range',
    description: 'Make an array of all natural numbers less than a number',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/range'
  },
  '∪': {
    glyph: '∪',
    type: 'monadic modifier',
    name: 'reach',
    description: 'Call a function skipping the second argument',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/reach'
  },
  '⨪': {
    glyph: '⨪',
    type: 'monadic function',
    name: 'reciprocal',
    description: 'Get the reciprocal of a number',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/reciprocal'
  },
  '/': {
    glyph: '/',
    type: 'monadic modifier',
    name: 'reduce',
    description: 'Apply a reducing function to an array',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/reduce'
  },
  '⍥': {
    glyph: '⍥',
    type: 'monadic modifier',
    name: 'repeat',
    description: 'Repeat a function a number of times',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/repeat'
  },
  '↯': {
    glyph: '↯',
    type: 'dyadic function',
    name: 'reshape',
    description: 'Change the shape of an array',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/reshape'
  },
  '⇌': {
    glyph: '⇌',
    type: 'monadic function',
    name: 'reverse',
    description: 'Reverse the rows of an array',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/reverse'
  },
  '⍏': {
    glyph: '⍏',
    type: 'monadic function',
    name: 'rise',
    description: 'Get the indices into an array if it were sorted ascending',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/rise'
  },
  '↻': {
    glyph: '↻',
    type: 'dyadic function',
    name: 'rotate',
    description: 'Rotate the elements of an array by n',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/rotate'
  },
  '⁅': {
    glyph: '⁅',
    type: 'monadic function',
    name: 'round',
    description: 'Round to the nearest integer',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/round'
  },
  '≡': {
    glyph: '≡',
    type: 'monadic modifier',
    name: 'rows',
    description: 'Apply a function to each row of an array or arrays',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/rows'
  },
  '\\': {
    glyph: '\\',
    type: 'monadic modifier',
    name: 'scan',
    description: 'Reduce, but keep intermediate values',
    signature: '|1| 1 → 1',
    docUrl: 'https://www.uiua.org/docs/scan'
  },
  '⊏': {
    glyph: '⊏',
    type: 'dyadic function',
    name: 'select',
    description: 'Select multiple rows from an array',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/select'
  },
  '˙': {
    glyph: '˙',
    type: 'monadic modifier',
    name: 'self',
    description: 'Call a function with the same array as all arguments',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/self'
  },
  '△': {
    glyph: '△',
    type: 'monadic function',
    name: 'shape',
    description: 'Get the dimensions of an array',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/shape'
  },
  '±': {
    glyph: '±',
    type: 'monadic function',
    name: 'sign',
    description: 'Numerical sign (1, ¯1, or 0)',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/sign'
  },
  '∿': {
    glyph: '∿',
    type: 'monadic function',
    name: 'sine',
    description: 'Get the sine of a number',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/sine'
  },
  '⍆': {
    glyph: '⍆',
    type: 'monadic function',
    name: 'sort',
    description: 'Sort an array',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/sort'
  },
  '√': {
    glyph: '√',
    type: 'monadic function',
    name: 'sqrt',
    description: 'Take the square root of a number',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/sqrt'
  },
  '⧈': {
    glyph: '⧈',
    type: 'monadic modifier',
    name: 'stencil',
    description: 'Call a function on windows of an array',
    signature: '|1| 2 → 1',
    docUrl: 'https://www.uiua.org/docs/stencil'
  },
  '-': {
    glyph: '-',
    type: 'dyadic function',
    name: 'subtract',
    description: 'Subtract values',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/subtract'
  },
  '⨬': {
    glyph: '⨬',
    type: 'dyadic modifier',
    name: 'switch',
    description: 'Call the function at the given index',
    signature: '|2|',
    docUrl: 'https://www.uiua.org/docs/switch'
  },
  '⊞': {
    glyph: '⊞',
    type: 'monadic modifier',
    name: 'table',
    description: 'Apply a function to each combination of rows of some arrays',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/table'
  },
  '↙': {
    glyph: '↙',
    type: 'dyadic function',
    name: 'take',
    description: 'Take the first n rows of an array',
    signature: '2 → 1',
    docUrl: 'https://www.uiua.org/docs/take'
  },
  τ: {
    glyph: 'τ',
    type: 'constant',
    name: 'tau',
    description: "The ratio of a circle's circumference to its radius",
    signature: '0 → 1',
    docUrl: 'https://www.uiua.org/docs/tau'
  },
  '⍉': {
    glyph: '⍉',
    type: 'monadic function',
    name: 'transpose',
    description: 'Rotate the shape of an array',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/transpose'
  },
  '⍣': {
    glyph: '⍣',
    type: 'dyadic modifier',
    name: 'try',
    description: 'Call a function and catch errors',
    signature: '|2|',
    docUrl: 'https://www.uiua.org/docs/try'
  },
  '⧅': {
    glyph: '⧅',
    type: 'monadic modifier',
    name: 'tuples',
    description: 'Get permutations or combinations of an array',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/tuples'
  },
  '°': {
    glyph: '°',
    type: 'monadic modifier',
    name: 'un',
    description: 'Invert the behavior of a function',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/un'
  },
  '⍜': {
    glyph: '⍜',
    type: 'dyadic modifier',
    name: 'under',
    description: 'Operate on a transformed array, then reverse the transformation',
    signature: '|2|',
    docUrl: 'https://www.uiua.org/docs/under'
  },
  '⊚': {
    glyph: '⊚',
    type: 'monadic function',
    name: 'where',
    description: 'Get indices where array values are not equal to zero',
    signature: '1 → 1',
    docUrl: 'https://www.uiua.org/docs/where'
  },
  '⤙': {
    glyph: '⤙',
    type: 'monadic modifier',
    name: 'with',
    description: 'Call a function but keep its last argument before its outputs',
    signature: '|1|',
    docUrl: 'https://www.uiua.org/docs/with'
  }
};

/**
 * Get documentation for a Uiua glyph
 */
export function getUiuaGlyphDoc(glyph: string): UiuaGlyphDoc | undefined {
  return uiuaGlyphDocs[glyph];
}
