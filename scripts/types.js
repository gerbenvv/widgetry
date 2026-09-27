// Generates the TypeScript declarations in `dist/types/`. Run with `npm run types`.
//
// TypeScript derives declarations from the JSDoc of the sources, but it cannot see the properties
// that `defineProperties()` installs at runtime. This script adds them: for every class with
// declared properties, it merges an interface with the property accessors (and their docs) into
// the class declaration.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {string} */
const ROOT_PATH = fileURLToPath(new URL('..', import.meta.url));

/** @type {string} */
const SOURCE_PATH = join(ROOT_PATH, 'src');

/** @type {string} */
const TYPES_PATH = join(ROOT_PATH, 'dist', 'types');

function listSources(path) {
    const files = [];

    for (const entry of readdirSync(path, { withFileTypes: true })) {
        const entryPath = join(path, entry.name);

        if (entry.isDirectory() && entry.name !== 'tests') {
            files.push(...listSources(entryPath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(entryPath);
        }
    }

    return files;
}

/**
 * Finds the end of a balanced `{ ... }` block that starts at `start`.
 */
function findBlockEnd(text, start) {
    let depth = 0;
    let quote = null;

    for (let i = start; i < text.length; ++i) {
        const character = text[i];

        if (quote) {
            if (character === '\\') {
                ++i;
            } else if (character === quote) {
                quote = null;
            }

            continue;
        }

        if (character === "'" || character === '"' || character === '`') {
            quote = character;
        } else if (character === '/' && text[i + 1] === '/') {
            i = text.indexOf('\n', i);
        } else if (character === '/' && text[i + 1] === '*') {
            i = text.indexOf('*/', i) + 1;
        } else if (character === '{') {
            depth += 1;
        } else if (character === '}') {
            depth -= 1;

            if (depth === 0) {
                return i;
            }
        }
    }

    throw new Error('Unbalanced block.');
}

function inferType(spec) {
    const typeTag = spec.doc.match(/@type\s+\{([^}]+)\}/);
    if (typeTag) {
        return typeTag[1];
    }

    const value = spec.body.match(/^\s*value:\s*([^,\n]+)/m)?.[1]?.trim();
    if (value === undefined) {
        return 'any';
    }

    if (value === 'true' || value === 'false') {
        return 'boolean';
    }

    if (/^-?\d/.test(value)) {
        return 'number';
    }

    if (/^['"`]/.test(value)) {
        return 'string';
    }

    return 'any';
}

/**
 * Extracts the property declarations of every `defineProperties(Class, {...})` call.
 */
function extractProperties(text) {
    const classes = [];
    const pattern = /defineProperties\((\w+),\s*\{/g;

    let match;
    while ((match = pattern.exec(text))) {
        const blockStart = match.index + match[0].length - 1;
        const blockEnd = findBlockEnd(text, blockStart);
        const block = text.slice(blockStart + 1, blockEnd);

        const properties = [];
        const keyPattern = /^( {4})(\w+):\s*/gm;

        let key;
        while ((key = keyPattern.exec(block))) {
            const name = key[2];
            const after = key.index + key[0].length;

            // The spec body: a `{...}` block or a call such as `marginSide('top')`.
            let body = '';
            if (block[after] === '{') {
                const end = findBlockEnd(block, after);
                body = block.slice(after, end + 1);
                keyPattern.lastIndex = end;
            }

            // The doc comment right above the key, if any.
            const before = block.slice(0, key.index);
            const docMatch = before.match(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*$/);
            const doc = docMatch ? docMatch[1] : '';

            properties.push({ name, body, doc, readOnly: /\breadOnly:\s*true\b/.test(body) });
        }

        classes.push({ name: match[1], properties });
    }

    return classes;
}

/**
 * Returns the names of the members that a declaration file declares for a class.
 */
function getClassMembers(declarations, name) {
    const members = new Set();

    const match = new RegExp(`declare class ${name}\\b[^{]*\\{`).exec(declarations);
    if (!match) {
        return members;
    }

    const start = match.index + match[0].length - 1;
    const body = declarations.slice(start, findBlockEnd(declarations, start));

    for (const member of body.matchAll(/^ {4}(?:(?:readonly|static|get|set)\s+)*(\w+)[(:?<]/gm)) {
        members.add(member[1]);
    }

    return members;
}

function formatDoc(doc) {
    const lines = doc
        .split('\n')
        .map((x) => x.replace(/^\s*\* ?/, '').trimEnd())
        .filter((x, i, all) => x || (i > 0 && i < all.length - 1));

    if (!lines.length) {
        return '';
    }

    return ['    /**', ...lines.map((x) => `     * ${x}`.trimEnd()), '     */', ''].join('\n');
}

// Let TypeScript write the declarations of everything it can see.
execFileSync(join(ROOT_PATH, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.types.json'], {
    cwd: ROOT_PATH,
    stdio: 'inherit',
});

let count = 0;
for (const sourceFilePath of listSources(SOURCE_PATH)) {
    const classes = extractProperties(readFileSync(sourceFilePath, 'utf8'));
    if (!classes.length) {
        continue;
    }

    const typesFilePath = join(TYPES_PATH, relative(SOURCE_PATH, sourceFilePath)).replace(
        /\.js$/,
        '.d.ts'
    );
    let declarations = readFileSync(typesFilePath, 'utf8');

    for (const { name, properties } of classes) {
        // Skip properties that TypeScript already declared on the class itself.
        const declared = getClassMembers(declarations, name);

        const members = properties
            .filter((x) => !declared.has(x.name))
            .map((property) => {
                const modifier = property.readOnly ? 'readonly ' : '';

                return `${formatDoc(property.doc)}    ${modifier}${property.name}: ${inferType(property)};`;
            });

        declarations += `\n/** The declared properties of {@link ${name}}. */\nexport interface ${name} {\n${members.join('\n')}\n}\n`;
        count += properties.length;
    }

    writeFileSync(typesFilePath, declarations);
}

console.log(`Added ${count} property declarations.`);
