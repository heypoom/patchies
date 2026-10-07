/** Regenerate with `bun scripts/generate-p5-completions.ts` from ui/. */
import ts from 'typescript';
import { format } from 'prettier';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../node_modules/p5/types/p5.d.ts', import.meta.url));

const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);

const version = JSON.parse(
  readFileSync(new URL('../node_modules/p5/package.json', import.meta.url), 'utf8')
).version;

if (!version.startsWith('2.')) {
  throw new Error('P5 completions require v2 declarations.');
}

type Entry = [label: string, type: string, detail: string, info: string];

const entries = new Map<string, Entry>();
const declarations = new Map<string, ts.VariableDeclaration>();

for (const statement of source.statements) {
  if (!ts.isVariableStatement(statement)) continue;

  for (const declaration of statement.declarationList.declarations) {
    declarations.set(declaration.name.getText(source), declaration);
  }
}

const clean = (text: string) =>
  text
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function description(node: ts.Node): string {
  const comment = (node as ts.Node & { jsDoc?: ts.JSDoc[] }).jsDoc?.[0]?.comment;
  if (typeof comment !== 'string') return '';

  return clean(comment.split('\n\n')[0]).split(/(?<=\.)\s/)[0];
}

function addMember(member: ts.ClassElement, prefix = '') {
  if (!member.name) return;

  const name = member.name.getText(source);
  if (name.startsWith('_')) return;

  const label = `${prefix}${name}`;

  if (ts.isMethodDeclaration(member)) {
    const parameters = member.parameters
      .map((parameter) => parameter.getText(source).replace(/\s+/g, ' ').trim())
      .join(', ');

    const signature = `(${parameters}) => ${member.type?.getText(source) ?? 'void'}`;
    const existing = entries.get(label);

    if (existing) {
      existing[2] += ` | ${signature}`;

      return;
    }

    entries.set(label, [
      label,
      'function',
      signature,
      description(member) || `P5 ${name} function.`
    ]);
  } else if (ts.isPropertyDeclaration(member)) {
    const declaration = declarations.get(name);
    const type = declaration?.type?.getText(source) ?? member.type?.getText(source) ?? 'unknown';
    const constant = /^[A-Z][A-Z_\d]*$/.test(name);
    const info = declaration ? description(declaration.parent.parent) : description(member);

    entries.set(label, [
      label,
      constant ? 'constant' : 'variable',
      type,
      info || `P5 ${constant ? 'constant' : 'sketch state'}: ${name}.`
    ]);
  }
}

const p5Class = source.statements.find(
  (statement): statement is ts.ClassDeclaration =>
    ts.isClassDeclaration(statement) && statement.name?.text === 'p5'
);

if (!p5Class) {
  throw new Error('Missing P5 class declaration.');
}

for (const member of p5Class.members) {
  const isStatic =
    ts.canHaveModifiers(member) &&
    ts.getModifiers(member)?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword);

  // P5Manager exposes the constructor as `p5`, and sketch members as globals.
  addMember(
    member,
    isStatic || member.name?.getText(source) === 'disableFriendlyErrors' ? 'p5.' : ''
  );
}

const namespace = source.statements.find(
  (statement): statement is ts.ModuleDeclaration =>
    ts.isModuleDeclaration(statement) && statement.name.getText(source) === 'p5'
);

if (namespace?.body && ts.isModuleBlock(namespace.body)) {
  for (const statement of namespace.body.statements) {
    if (!ts.isClassDeclaration(statement) || !statement.name) continue;

    // The declarations use __Graphics for the runtime Graphics constructor.
    const name = statement.name.text === '__Graphics' ? 'Graphics' : statement.name.text;

    if (name.startsWith('_')) {
      continue;
    }

    entries.set(`p5.${name}`, [
      `p5.${name}`,
      'class',
      `p5.${name}`,
      description(statement) || `P5 ${name} constructor.`
    ]);

    for (const member of statement.members) {
      if (
        ts.canHaveModifiers(member) &&
        ts.getModifiers(member)?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)
      ) {
        addMember(member, `p5.${name}.`);
      }
    }
  }
}

const output = `// Generated from p5 ${version} (LGPL-2.1); see https://github.com/processing/p5.js.\n// Regenerate: bun scripts/generate-p5-completions.ts\n// Cross-check public API names at https://p5js.org/reference/.\nexport const p5ApiEntries: [label: string, type: string, detail: string, info: string][] = [\n${[...entries.values()].map((entry) => `  ${JSON.stringify(entry)}`).join(',\n')}\n];\n`;

writeFileSync(
  new URL('../src/lib/codemirror/p5-api.ts', import.meta.url),
  await format(output, {
    parser: 'typescript',
    singleQuote: true,
    trailingComma: 'none',
    printWidth: 100
  })
);

console.log(`Generated ${entries.size} P5 ${version} completions.`);
