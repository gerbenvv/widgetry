/**
 * @module construction/builder
 */

import { defineProperties, Instance } from '../core/instance.js';
import { getType } from '../core/registry.js';
import { toCamelCase } from '../core/util.js';

/**
 * The keys of an object description that are not properties.
 *
 * @type {Set<string>}
 */
const RESERVED_KEYS = new Set(['type', 'id']);

/**
 * @callback BuilderPropertyHook
 * @param {Builder} builder
 * @param {object} instance The object being built.
 * @param {unknown} value The value from the input, not yet built (so `{ type }` descriptions
 *     and references are still plain objects; use `builder.build()` or `builder.buildValue()`).
 * @returns {void}
 */

/**
 * An error in the builder input. The message starts with the path of the offending object, such
 * as `[0].children[2] (button #ok)`, and `cause` holds the original error, if any.
 */
export class BuilderError extends Error {
    /**
     * @param {string} message
     * @param {string} path
     * @param {ErrorOptions} [options]
     */
    constructor(message, path, options) {
        super(path ? `${path}: ${message}` : message, options);

        this.name = 'BuilderError';

        /**
         * The path of the offending object in the input.
         *
         * @type {string}
         */
        this.path = path;
    }
}

/**
 * Thrown (and caught) while a value refers to an object that has not been built yet.
 */
class UnresolvedReference extends Error {
    /**
     * @param {string} id
     */
    constructor(id) {
        super(`Object with id '${id}' could not be found.`);

        this.id = id;
    }
}

function isPlainObject(value) {
    if (value === null || typeof value !== 'object') {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
}

/**
 * Checks whether a value is a reference, `{ id: '...' }` with no other keys.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isReference(value) {
    return isPlainObject(value) && typeof value.id === 'string' && Object.keys(value).length === 1;
}

/**
 * Finds a builder property hook of a class: the `builderProperties` of the class itself or the
 * nearest base class that has one for the name.
 *
 * @param {Function} cls
 * @param {string} name
 * @returns {{hook: BuilderPropertyHook, owner: object} | null}
 */
function findHook(cls, name) {
    const camelName = toCamelCase(name);

    for (let current = cls; current && current !== Function.prototype;) {
        if (Object.hasOwn(current, 'builderProperties')) {
            const hooks = current.builderProperties;

            for (const key of [name, camelName]) {
                if (Object.hasOwn(hooks, key) && typeof hooks[key] === 'function') {
                    return { hook: hooks[key], owner: hooks };
                }
            }
        }

        current = Object.getPrototypeOf(current);
    }

    return null;
}

/**
 * The builder builds objects (widget trees, models, validators and so on) from a declarative
 * description: plain objects, arrays of them or JSON. See `docs/builder.md` for the format.
 *
 * ```js
 * const builder = new Builder();
 * const [window] = builder.build({
 *     type: 'window',
 *     title: 'Hello',
 *     child: {
 *         type: 'box',
 *         orientation: 'vertical',
 *         children: [
 *             { type: 'label', id: 'message', text: 'Hello, world!' },
 *             { type: 'button', label: 'Close', handlers: { activate() { window.close(); } } },
 *         ],
 *     },
 * });
 * builder.getObjectById('message').text = 'Goodbye!';
 * ```
 *
 * Every description has a `type`, registered with `registerType()` (which widget modules do when
 * they are imported; the builder imports no widgets itself), and optionally an `id`. The other
 * keys are, in order of precedence:
 *
 * - A builder property of the class: a static `builderProperties` hook, looked up along the class
 *   hierarchy (the most derived class wins). Hooks run after the normal properties, in input
 *   order, and get the unbuilt value.
 * - `handlers`: `{ signal: handler }`, connected with the object as `this`. In JSON, handlers can
 *   be names of functions in the builder's `scope`.
 * - A writable property, set with `instance.set()` (so `visible` and other late properties come
 *   last).
 * - `children` of an object with `addChild()`, which are added in order, and `child` of an object
 *   without a writable `child` property, which is added with `addChild()`.
 *
 * Values are built recursively: descriptions with a `type` become objects, `{ id: '...' }`
 * references resolve to the object with that id (also objects built later in the same
 * `build()`, which are set once they exist), arrays and plain objects are built element by
 * element, and other values are used as they are. Children (and the arrays builder property hooks pass
 * to `build()`) may also be existing objects or references to objects built before.
 *
 * Classes registered with a factory are created by `factory(properties, builder)`, where
 * `properties` holds the built values of the normal keys by camelCase name. Builder properties
 * and handlers are still applied to the result.
 */
export class Builder extends Instance {
    _initialize() {
        super._initialize();

        /** @type {object[]} */
        this._objects = [];

        /** @type {Map<string, object>} */
        this._objectsById = new Map();

        /** @type {string[]} */
        this._path = [];

        this._depth = 0;

        /** @type {{instance: object, name: string, value: unknown, path: string}[]} */
        this._deferred = [];

        /** @type {string[]} */
        this._newIds = [];
    }

    /**
     * Builds objects from a description, an array of descriptions or JSON.
     *
     * @param {string | object | object[]} input
     * @returns {object[]} The root objects in the input.
     * @throws {BuilderError} If the input is malformed.
     */
    build(input) {
        if (typeof input === 'string') {
            try {
                input = JSON.parse(input);
            } catch (error) {
                throw new BuilderError(`Invalid JSON: ${error.message}`, this._getPath(), {
                    cause: error,
                });
            }
        }

        const outermost = this._depth === 0;
        this._depth += 1;

        let objects;
        try {
            objects = this._buildRoots(input);

            if (outermost) {
                this._applyDeferred();
            }
        } catch (error) {
            // Forget the ids of a failed build, so the input can be fixed and built again.
            if (outermost) {
                for (const id of this._newIds) {
                    this._objectsById.delete(id);
                }
            }

            throw error;
        } finally {
            this._depth -= 1;

            if (outermost) {
                this._deferred = [];
                this._newIds = [];
                this._path = [];
            }
        }

        if (outermost) {
            this._objects.push(...objects.filter((x) => !this._objects.includes(x)));
        }

        return objects;
    }

    /**
     * Builds a single object from a description (or JSON).
     *
     * @param {string | object} input
     * @returns {object}
     * @throws {BuilderError} If the input does not describe exactly one object.
     */
    buildOne(input) {
        const objects = this.build(input);
        if (objects.length !== 1) {
            throw new BuilderError(
                `Expected one object, but the input describes ${objects.length}.`,
                this._getPath()
            );
        }

        return objects[0];
    }

    /**
     * Builds a value: descriptions become objects, references resolve, and arrays and plain
     * objects are built recursively. Useful for builder property hooks.
     *
     * @param {unknown} value
     * @returns {unknown}
     */
    buildValue(value) {
        return this._buildValue(value, false);
    }

    /**
     * Gets an object by its id.
     *
     * @param {string} id
     * @returns {object}
     * @throws {Error} If there is no object with that id.
     */
    getObjectById(id) {
        const object = this._objectsById.get(id);
        if (!object) {
            throw new Error(`Object with id '${id}' could not be found.`);
        }

        return object;
    }

    /**
     * Checks whether an object with an id was built.
     *
     * @param {string} id
     * @returns {boolean}
     */
    hasObject(id) {
        return this._objectsById.has(id);
    }

    _buildRoots(input) {
        if (Array.isArray(input)) {
            return input.flatMap((item, index) =>
                this._withPath(`[${index}]`, () => this._buildRoots(item))
            );
        }

        return [this._buildObject(input)];
    }

    _buildObject(description) {
        // Objects that already exist are used as they are.
        if (description instanceof Instance) {
            return description;
        }

        if (!isPlainObject(description)) {
            this._fail('Malformed builder input: expected an object with a type.');
        }

        // References to objects built before, as in the buttons of a button group.
        if (isReference(description)) {
            const object = this._objectsById.get(description.id);
            if (!object) {
                this._fail(`Object with id '${description.id}' could not be found.`);
            }

            return object;
        }

        const { type, id } = description;
        if (typeof type !== 'string') {
            this._fail(`Malformed builder input: the object has no type.`);
        }

        if (id !== undefined && typeof id !== 'string') {
            this._fail(`The id of a '${type}' must be a string.`);
        }

        this._path.push(`(${type}${id ? ' #' + id : ''})`);
        try {
            return this._createObject(description, type, id);
        } finally {
            this._path.pop();
        }
    }

    _createObject(description, type, id) {
        const entry = getType(type);
        if (!entry) {
            this._fail(`Unknown type '${type}'. Import the module that registers it first.`);
        }

        if (id !== undefined && this._objectsById.has(id)) {
            this._fail(`Duplicate id '${id}'.`);
        }

        const { cls, factory } = entry;
        const { normal, special } = this._classifyKeys(description, cls, Boolean(factory));

        let instance;
        const properties = {};

        if (factory) {
            // A factory gets all normal values up front, so they cannot refer forward.
            for (const [name, value] of normal) {
                properties[toCamelCase(name)] = this._withPath(`.${name}`, () =>
                    this._buildValue(value, false)
                );
            }

            instance = this._wrap(() => factory(properties, this));
            if (!instance || typeof instance !== 'object') {
                this._fail(`The factory of '${type}' did not return an object.`);
            }

            this._register(id, instance);
        } else {
            instance = this._wrap(() => new cls());

            // Register before building the values, so children can refer to their parents.
            this._register(id, instance);

            for (const [name, value] of normal) {
                const path = `.${name}`;
                const built = this._withPath(path, () => this._buildValue(value, true));

                if (built instanceof UnresolvedReference) {
                    this._deferred.push({ instance, name, value, path: this._getPath() + path });
                } else {
                    properties[name] = built;
                }
            }

            this._withPath('', () => this._wrap(() => this._setProperties(instance, properties)));
        }

        for (const [name, value, handler] of special) {
            this._withPath(`.${name}`, () => this._wrap(() => handler(instance, value)));
        }

        return instance;
    }

    /**
     * Splits the keys of a description into normal properties and special keys (builder property
     * hooks, handlers, children and child), in input order.
     */
    _classifyKeys(description, cls, hasFactory) {
        const normal = [];
        const special = [];

        for (const [name, value] of Object.entries(description)) {
            if (RESERVED_KEYS.has(name)) {
                continue;
            }

            const found = findHook(cls, name);
            if (found) {
                special.push([
                    name,
                    value,
                    (instance, input) => found.hook.call(found.owner, this, instance, input),
                ]);
                continue;
            }

            if (name === 'handlers') {
                special.push([name, value, (instance, input) => this._connect(instance, input)]);
                continue;
            }

            const info = typeof cls.getPropertyInfo === 'function' && cls.getPropertyInfo(name);
            if (info && info.write) {
                normal.push([name, value]);
                continue;
            }

            if ((name === 'children' || name === 'child') && this._canAddChild(cls)) {
                special.push([
                    name,
                    value,
                    name === 'children'
                        ? (instance, input) => this._addChildren(instance, input)
                        : (instance, input) => this._addChild(instance, input),
                ]);
                continue;
            }

            if (info) {
                this._fail(`Property '${name}' of '${description.type}' is read-only.`);
            }

            if (!hasFactory && cls.prototype instanceof Instance) {
                this._fail(`'${description.type}' has no property named '${name}'.`);
            }

            normal.push([name, value]);
        }

        return { normal, special };
    }

    _canAddChild(cls) {
        return typeof cls.prototype?.addChild === 'function';
    }

    _setProperties(instance, properties) {
        if (typeof instance.set === 'function') {
            instance.set(properties);
        } else {
            Object.assign(instance, properties);
        }
    }

    _register(id, instance) {
        if (id !== undefined) {
            this._objectsById.set(id, instance);
            this._newIds.push(id);
        }
    }

    _connect(instance, handlers) {
        if (!isPlainObject(handlers)) {
            throw new Error('Handlers must be an object of signal names and functions.');
        }

        if (typeof instance.connect !== 'function') {
            throw new Error('The object has no signals.');
        }

        for (const [name, handler] of Object.entries(handlers)) {
            let method = handler;
            if (typeof handler === 'string') {
                method = this._scope?.[handler];
                if (typeof method !== 'function') {
                    throw new Error(`Handler '${handler}' of '${name}' is not in the scope.`);
                }
            }

            if (typeof method !== 'function') {
                throw new Error(`The handler of '${name}' must be a function.`);
            }

            instance.connect(name, method, instance);
        }
    }

    _addChildren(instance, children) {
        if (!Array.isArray(children)) {
            throw new Error('Children must be an array.');
        }

        children.forEach((child, index) => {
            this._withPath(`[${index}]`, () => {
                const widget = this._buildObject(child);
                this._wrap(() => instance.addChild(widget));
            });
        });
    }

    _addChild(instance, child) {
        if (Array.isArray(child) || !child || typeof child !== 'object') {
            throw new Error('The child must be an object.');
        }

        instance.addChild(this._buildObject(child));
    }

    /**
     * Builds a value.
     *
     * @param {unknown} value
     * @param {boolean} allowForward Whether an unresolved reference returns an
     *     {@link UnresolvedReference} (to set the value later) instead of failing.
     * @returns {unknown}
     */
    _buildValue(value, allowForward) {
        try {
            return this._buildValueOrThrow(value);
        } catch (error) {
            if (error instanceof UnresolvedReference) {
                if (allowForward && this._depth > 0) {
                    return error;
                }

                this._fail(error.message);
            }

            throw error;
        }
    }

    _buildValueOrThrow(value) {
        if (Array.isArray(value)) {
            return value.map((item, index) =>
                this._withPath(`[${index}]`, () => this._buildValueOrThrow(item))
            );
        }

        if (!isPlainObject(value)) {
            return value === undefined ? null : value;
        }

        if (typeof value.type === 'string') {
            return this._buildObject(value);
        }

        if (isReference(value)) {
            const object = this._objectsById.get(value.id);
            if (!object) {
                throw new UnresolvedReference(value.id);
            }

            return object;
        }

        const result = {};
        for (const [key, item] of Object.entries(value)) {
            result[key] = this._withPath(`.${key}`, () => this._buildValueOrThrow(item));
        }

        return result;
    }

    _applyDeferred() {
        for (const { instance, name, value, path } of this._deferred) {
            let built;
            try {
                built = this._buildValueOrThrow(value);
            } catch (error) {
                throw new BuilderError(error.message, path, { cause: error });
            }

            try {
                if (typeof instance.setProperty === 'function') {
                    instance.setProperty(name, built);
                } else {
                    instance[name] = built;
                }
            } catch (error) {
                throw new BuilderError(error.message, path, { cause: error });
            }
        }
    }

    _withPath(segment, method) {
        this._path.push(segment);
        try {
            return method();
        } finally {
            this._path.pop();
        }
    }

    /**
     * Runs a function, wrapping its errors (other than builder errors) in a {@link BuilderError}
     * with the current path.
     */
    _wrap(method) {
        try {
            return method();
        } catch (error) {
            if (error instanceof BuilderError) {
                throw error;
            }

            throw new BuilderError(error.message, this._getPath(), { cause: error });
        }
    }

    _fail(message) {
        throw new BuilderError(message, this._getPath());
    }

    _getPath() {
        return this._path.join('').replace(/^\./, '');
    }
}

defineProperties(Builder, {
    /**
     * The root objects built so far, over all calls of `build()`. Do not modify the array.
     */
    objects: {
        readOnly: true,
        get() {
            return this._objects;
        },
    },

    /**
     * An object with handler functions, for handlers given by name in the input (as in JSON):
     * `handlers: { activate: 'onOpen' }` connects `scope.onOpen`.
     */
    scope: {
        value: null,
        coerce(scope) {
            if (scope !== null && typeof scope !== 'object') {
                throw new TypeError('The scope must be an object or null.');
            }

            return scope;
        },
    },
});

/**
 * Builds objects with a new builder. Use a `Builder` directly to look objects up by id.
 *
 * @param {string | object | object[]} input
 * @param {{scope?: object}} [options]
 * @returns {object[]}
 */
export function build(input, options = {}) {
    return new Builder(options).build(input);
}

/*
 * The original toolkit registered these special builder properties centrally. Here each widget
 * module defines them as static `builderProperties` of its class, as `ButtonGroup` does:
 *
 * - Fixed `children`: each child description may have `x` and `y`, removed before building the
 *   child, and passed as `fixed.addChild(child, x, y)`.
 * - Paned `children`: each child may have `resize`, passed as `paned.addChild(child, resize)`.
 * - Grid `children`: each child may have `row`, `column`, `rowSpan` and `columnSpan` (the original
 *   used `row-span` and `col-span`), passed as `grid.addChild(child, row, column, rowSpan,
 *   columnSpan)`.
 * - VectorCanvas `sprites`: an array of sprite descriptions, added with `canvas.addSprite()`.
 * - ButtonGroup `buttons`: an array of button descriptions (or references), added with
 *   `group.addButton()`.
 * - Dialog `buttons`: an array of buttons, added with `dialog.addButton()`.
 * - Table `columns`: an array of column descriptions, added with `table.addColumn()`.
 *
 * A hook that builds nested descriptions calls `builder.build(value)` (or `builder.buildOne()`),
 * which keeps the path for error messages and resolves references.
 */
