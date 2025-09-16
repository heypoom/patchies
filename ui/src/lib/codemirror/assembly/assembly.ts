import { parser } from './syntax.js';
import {
	continuedIndent,
	indentNodeProp,
	foldNodeProp,
	foldInside,
	LRLanguage,
	LanguageSupport
} from '@codemirror/language';
import { styleTags, tags as t } from '@lezer/highlight';

export const assemblyLanguage = LRLanguage.define({
	name: 'assembly',
	parser: parser.configure({
		props: [
			indentNodeProp.add({
				Program: () => 0,
				StringDefinition: continuedIndent(),
				ValueDefinition: continuedIndent(),
				InstructionExpression: continuedIndent(),
				LabelDefinition: () => 0
			}),
			foldNodeProp.add({
				Program: foldInside
			}),
			styleTags({
				Comment: t.lineComment,
				Instruction: t.keyword,
				Identifier: t.variableName,
				String: t.string,
				Value: t.number,
				'hex_number bin_number': t.number,
				label: t.labelName,
				'.string .value': t.keyword
			})
		]
	}),
	languageData: {
		commentTokens: { line: ';' },
		closeBrackets: { brackets: ['(', '[', '{', '"'] }
	}
});

export function assembly() {
	return new LanguageSupport(assemblyLanguage);
}
