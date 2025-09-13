import { describe, expect, it } from 'vitest';

import { isSnippetModule, getLibName } from './js-module-utils';

describe('js module utils', () => {
	const ism = isSnippetModule;

	it('should detect es module', () => {
		expect(ism('import { a } from "b"')).toBe(true);
		expect(ism('export const a = 1')).toBe(true);
		expect(ism('const a = 1')).toBe(false);
		expect(ism('const obj = { a: 1, b: 2 }; export default obj;')).toBe(true);
		expect(ism('// imma import this\ncool()')).toBe(false);
		expect(ism('// imma import this\nimport { a } from "foo"')).toBe(true);
	});

	it('should extract lib name from @lib comment', () => {
		expect(getLibName('// @lib lodash\nconst a = 1')).toBe('lodash');
		expect(getLibName('// @lib react-dom\nexport const Component = () => {}')).toBe('react-dom');
		expect(getLibName('const a = 1')).toBe(null);
		expect(getLibName('// some other comment\nconst a = 1')).toBe(null);
		expect(getLibName('//   @lib   three   \nconst scene = new THREE.Scene()')).toBe('three');
	});
});
