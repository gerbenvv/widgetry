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

/**
 * Returns the type of the values of a frozen enum object, `'string'` or `'number'`, keyed by the
 * enum name, for every `export const Name = Object.freeze({...})` in the sources.
 */
function extractEnums(text) {
    const enums = new Map();
    const pattern = /export const (\w+) = Object\.freeze\(\{/g;

    let match;
    while ((match = pattern.exec(text))) {
        const blockStart = match.index + match[0].length - 1;
        const block = text.slice(blockStart + 1, findBlockEnd(text, blockStart));
        const values = [...block.matchAll(/^\s*[\w'"-]+:\s*([^,\n]+),/gm)].map((x) => x[1].trim());

        if (values.length && values.every((x) => /^['"]/.test(x))) {
            enums.set(match[1], 'string');
        } else if (values.length && values.every((x) => /^[-\d(]/.test(x))) {
            enums.set(match[1], 'number');
        }
    }

    return enums;
}

/**
 * Infers the type of a property from its spec alone: its `@type` tag, its default value or its
 * `coerce`. Returns `null` when the spec does not tell.
 */
function inferOwnType(spec, enums) {
    const typeTag = spec.doc.match(/@type\s+\{([^}]+)\}/);
    if (typeTag) {
        return typeTag[1];
    }

    // Specs made by a helper, such as `marginSide('top')` or `adjustmentProperty('value')`.
    if (/^(?:marginSide|adjustmentProperty)\(/.test(spec.call)) {
        return 'number';
    }

    const value = spec.body.match(/^ {8}value:\s*([^,\n]+)/m)?.[1]?.trim();
    const coerce = spec.body.match(/^ {8}coerce(?::\s*(\w+)|\([^)]*\)\s*\{)/m);
    let coerceBody = '';
    if (coerce && !coerce[1]) {
        const start = spec.body.indexOf('{', coerce.index);
        coerceBody = spec.body.slice(start, findBlockEnd(spec.body, start) + 1);
    }

    if (value === 'true' || value === 'false' || coerce?.[1] === 'Boolean') {
        return 'boolean';
    }

    if (/^-?\d/.test(value ?? '') || coerce?.[1] === 'Number') {
        return 'number';
    }

    if (/^['"`]/.test(value ?? '')) {
        return 'string';
    }

    const enumName = value?.match(/^(\w+)\.[A-Z_]+$/)?.[1];
    if (enumName && enums.has(enumName)) {
        return enums.get(enumName);
    }

    if (/\bString\(/.test(coerceBody)) {
        return value === 'null' ? 'string | null' : 'string';
    }

    if (coerce?.[1] === 'checkDate') {
        return 'Date | null';
    }

    return null;
}

/**
 * Returns the name of the property that an alias property reads, e.g. `text` for a spec with
 * `get() { return this._text; }`, or `null`.
 */
function getAliasTarget(spec) {
    return spec.body.match(/get\(\)\s*\{\s*return this\._?(\w+);\s*\}/)?.[1] ?? null;
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
            const call = block.slice(after, block.indexOf('\n', after));
            if (block[after] === '{') {
                const end = findBlockEnd(block, after);
                body = block.slice(after, end + 1);
                keyPattern.lastIndex = end;
            }

            // The doc comment right above the key, if any.
            const before = block.slice(0, key.index);
            const docMatch = before.match(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*$/);
            const doc = docMatch ? docMatch[1] : '';

            properties.push({ name, body, call, doc, readOnly: /\breadOnly:\s*true\b/.test(body) });
        }

        const base = text.match(new RegExp(`class ${match[1]} extends (\\w+)`))?.[1] ?? null;
        classes.push({ name: match[1], base, properties });
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

/**
 * Removes the fields that TypeScript declared in a class (`    name: Type;` lines) for the given
 * property names, and returns the declarations without them and the types they had.
 */
function removeClassFields(declarations, name, propertyNames) {
    const types = new Map();

    const match = new RegExp(`declare class ${name}\\b[^{]*\\{`).exec(declarations);
    if (!match) {
        return { declarations, types };
    }

    const start = match.index + match[0].length - 1;
    const end = findBlockEnd(declarations, start);
    const body = declarations
        .slice(start, end)
        .replace(/^ {4}(?:readonly )?([a-zA-Z]\w*): (.+);\n/gm, (line, field, type) => {
            if (!propertyNames.has(field)) {
                return line;
            }

            types.set(field, type);

            return '';
        });

    return { declarations: declarations.slice(0, start) + body + declarations.slice(end), types };
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

// Collect the enums and the classes with declared properties of all sources.
const sources = listSources(SOURCE_PATH).map((path) => ({
    path,
    text: readFileSync(path, 'utf8'),
}));
const enums = new Map(sources.flatMap((x) => [...extractEnums(x.text)]));
const classInfos = new Map();

for (const source of sources) {
    source.classes = extractProperties(source.text);

    for (const info of source.classes) {
        classInfos.set(info.name, {
            base: info.base,
            properties: new Map(info.properties.map((x) => [x.name, x])),
        });
    }
}

/**
 * Returns the type of a property of a class: its own, that of the property it is an alias of, or
 * the one it inherits. Returns `null` if nothing tells.
 */
function resolveType(className, name, seen = new Set()) {
    const info = classInfos.get(className);
    if (!info || seen.has(`${className}.${name}`)) {
        return null;
    }

    seen.add(`${className}.${name}`);

    const spec = info.properties.get(name);
    if (spec) {
        const type = inferOwnType(spec, enums);
        if (type) {
            return type;
        }

        const target = getAliasTarget(spec);
        if (target && target !== name) {
            const aliasType = resolveType(className, target, seen);
            if (aliasType) {
                return aliasType;
            }
        }
    }

    return resolveType(info.base, name, seen);
}

/**
 * Guesses the type of a property that nothing else tells from its name: `isOpen` and `hasFocus`
 * are booleans, and `rowsCount` is a number.
 */
function guessTypeFromName(name) {
    if (/^(?:is|has)[A-Z]/.test(name)) {
        return 'boolean';
    }

    if (/[a-z]Count$/.test(name)) {
        return 'number';
    }

    return 'any';
}

/**
 * Returns whether an ancestor of a class declares a property.
 */
function isInherited(className, name) {
    for (let base = classInfos.get(className)?.base; base; base = classInfos.get(base)?.base) {
        if (classInfos.get(base)?.properties.has(name)) {
            return true;
        }
    }

    return false;
}

/**
 * Widens the literal types that TypeScript infers for optional parameters from their defaults
 * when the JSDoc does not type them, e.g. `order?: 1` to `order?: number`.
 */
function widenParameterLiterals(declarations) {
    return declarations
        .replace(/(\w\?): -?\d+(?:\.\d+)?(?=[,)])/g, '$1: number')
        .replace(/(\w\?): (?:"[^"\n]*"|'[^'\n]*')(?=[,)])/g, '$1: string')
        .replace(/(\w\?): (?:true|false)(?=[,)])/g, '$1: boolean');
}

let count = 0;
for (const { path: sourceFilePath, classes } of sources) {
    const typesFilePath = join(TYPES_PATH, relative(SOURCE_PATH, sourceFilePath)).replace(
        /\.js$/,
        '.d.ts'
    );
    let declarations = widenParameterLiterals(readFileSync(typesFilePath, 'utf8'));

    for (const { name, properties } of classes) {
        // TypeScript declares fields for the properties that methods assign (`this.active = true`),
        // typed by that assignment. Replace them with the declared properties, but skip those
        // it declared as accessors or methods.
        const fields = removeClassFields(
            declarations,
            name,
            new Set(properties.map((x) => x.name))
        );
        declarations = fields.declarations;
        const declared = getClassMembers(declarations, name);

        const members = properties
            .filter((x) => !declared.has(x.name))
            .filter(
                // A subclass that only changes the default inherits the declaration.
                (x) =>
                    !isInherited(name, x.name) ||
                    x.doc.trim() ||
                    inferOwnType(x, enums) ||
                    fields.types.has(x.name)
            )
            .map((property) => {
                const modifier = property.readOnly ? 'readonly ' : '';
                const fieldType = fields.types.get(property.name);
                const type =
                    resolveType(name, property.name) ??
                    (fieldType && fieldType !== 'any' ? fieldType : null) ??
                    guessTypeFromName(property.name);

                return `${formatDoc(property.doc)}    ${modifier}${property.name}: ${type};`;
            });

        declarations += `\n/** The declared properties of {@link ${name}}. */\nexport interface ${name} {\n${members.join('\n')}\n}\n`;
        count += members.length;
    }

    writeFileSync(typesFilePath, declarations);
}

console.log(`Added ${count} property declarations.`);
