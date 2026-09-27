/**
 * @module construction/builder
 */
import { Instance } from '../core/instance.js';
export type BuilderPropertyHook = (builder: Builder, instance: object, value: unknown) => void;
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
export declare class BuilderError extends Error {
    /**
     * The path of the offending object in the input.
     *
     * @type {string}
     */
    path: string;
    /**
     * @param {string} message
     * @param {string} path
     * @param {ErrorOptions} [options]
     */
    constructor(message: string, path: string, options?: ErrorOptions);
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
export declare class Builder extends Instance {
    /** @type {object[]} */
    _objects: object[];
    /** @type {Map<string, object>} */
    _objectsById: Map<string, object>;
    /** @type {string[]} */
    _path: string[];
    _depth: number;
    /** @type {{instance: object, name: string, value: unknown, path: string}[]} */
    _deferred: {
        instance: object;
        name: string;
        value: unknown;
        path: string;
    }[];
    /** @type {string[]} */
    _newIds: string[];
    _initialize(): void;
    /**
     * Builds objects from a description, an array of descriptions or JSON.
     *
     * @param {string | object | object[]} input
     * @returns {object[]} The root objects in the input.
     * @throws {BuilderError} If the input is malformed.
     */
    build(input: string | object | object[]): object[];
    /**
     * Builds a single object from a description (or JSON).
     *
     * @param {string | object} input
     * @returns {object}
     * @throws {BuilderError} If the input does not describe exactly one object.
     */
    buildOne(input: string | object): object;
    /**
     * Builds a value: descriptions become objects, references resolve, and arrays and plain
     * objects are built recursively. Useful for builder property hooks.
     *
     * @param {unknown} value
     * @returns {unknown}
     */
    buildValue(value: unknown): unknown;
    /**
     * Gets an object by its id.
     *
     * @param {string} id
     * @returns {object}
     * @throws {Error} If there is no object with that id.
     */
    getObjectById(id: string): object;
    /**
     * Checks whether an object with an id was built.
     *
     * @param {string} id
     * @returns {boolean}
     */
    hasObject(id: string): boolean;
    _buildRoots(input: any): any[];
    _buildObject(description: any): any;
    _createObject(description: any, type: any, id: any): any;
    /**
     * Splits the keys of a description into normal properties and special keys (builder property
     * hooks, handlers, children and child), in input order.
     */
    _classifyKeys(description: any, cls: any, hasFactory: any): {
        normal: any[];
        special: any[];
    };
    _canAddChild(cls: any): boolean;
    _setProperties(instance: any, properties: any): void;
    _register(id: any, instance: any): void;
    _connect(instance: any, handlers: any): void;
    _addChildren(instance: any, children: any): void;
    _addChild(instance: any, child: any): void;
    /**
     * Builds a value.
     *
     * @param {unknown} value
     * @param {boolean} allowForward Whether an unresolved reference returns an
     *     {@link UnresolvedReference} (to set the value later) instead of failing.
     * @returns {unknown}
     */
    _buildValue(value: unknown, allowForward: boolean): unknown;
    _buildValueOrThrow(value: any): any;
    _applyDeferred(): void;
    _withPath(segment: any, method: any): any;
    /**
     * Runs a function, wrapping its errors (other than builder errors) in a {@link BuilderError}
     * with the current path.
     */
    _wrap(method: any): any;
    _fail(message: any): void;
    _getPath(): string;
}
/**
 * Builds objects with a new builder. Use a `Builder` directly to look objects up by id.
 *
 * @param {string | object | object[]} input
 * @param {{scope?: object}} [options]
 * @returns {object[]}
 */
export declare function build(input: string | object | object[], options?: {
    scope?: object;
}): object[];

/** The declared properties of {@link Builder}. */
export interface Builder {
    /**
     * The root objects built so far, over all calls of `build()`. Do not modify the array.
     */
    readonly objects: any;
    /**
     * An object with handler functions, for handlers given by name in the input (as in JSON):
     * `handlers: { activate: 'onOpen' }` connects `scope.onOpen`.
     */
    scope: any;
}
