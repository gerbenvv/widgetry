/**
 * The object model: instances with declared properties, change signals and actions.
 *
 * @module core/instance
 */
import { SignalDispatcher } from './signal-dispatcher.js';
export type PropertySpec = {
    /**
     * The default value. When given, setting an equal value is a no-op.
     */
    value?: unknown;
    /**
     * A custom setter. It must store
     * the value itself (conventionally in `this._<name>`). Return `false` to report "no change",
     * which suppresses the change signal.
     */
    set?: (this: any, value: any) => (boolean | void);
    /**
     * Called after the default
     * setter stored a new value.
     */
    changed?: (this: any, value: any, oldValue: any) => void;
    /**
     * A custom getter. Defaults to reading `this._<name>`.
     */
    get?: (this: any) => any;
    /**
     * Converts or validates a value before it is
     * compared and stored.
     */
    coerce?: (this: any, value: any) => any;
    /**
     * Whether the property can only be read.
     */
    readOnly?: boolean;
    /**
     * Whether {@link Instance#set} applies this property after the others.
     */
    late?: boolean;
    /**
     * Whether a change emits `<name>-change`. Defaults to `true`.
     */
    signal?: boolean;
};
export type PropertyInfo = {
    /**
     * The camelCase name.
     */
    name: string;
    /**
     * The name of the change signal, e.g. `'h-expand-change'`.
     */
    signal: string;
    readOnly: boolean;
    late: boolean;
    /**
     * Sets the value, returning whether it changed.
     */
    write: (value: any) => boolean;
    read: () => any;
};
/**
 * @typedef {object} PropertySpec
 * @property {unknown} [value] The default value. When given, setting an equal value is a no-op.
 * @property {(this: any, value: any) => (boolean | void)} [set] A custom setter. It must store
 *     the value itself (conventionally in `this._<name>`). Return `false` to report "no change",
 *     which suppresses the change signal.
 * @property {(this: any, value: any, oldValue: any) => void} [changed] Called after the default
 *     setter stored a new value.
 * @property {(this: any) => any} [get] A custom getter. Defaults to reading `this._<name>`.
 * @property {(this: any, value: any) => any} [coerce] Converts or validates a value before it is
 *     compared and stored.
 * @property {boolean} [readOnly] Whether the property can only be read.
 * @property {boolean} [late] Whether {@link Instance#set} applies this property after the others.
 * @property {boolean} [signal] Whether a change emits `<name>-change`. Defaults to `true`.
 */
/**
 * @typedef {object} PropertyInfo
 * @property {string} name The camelCase name.
 * @property {string} signal The name of the change signal, e.g. `'h-expand-change'`.
 * @property {boolean} readOnly
 * @property {boolean} late
 * @property {(value: any) => boolean} write Sets the value, returning whether it changed.
 * @property {() => any} read
 */
/**
 * Declares properties on a class. For every property a JavaScript accessor is installed on the
 * prototype, so it can be used as `widget.hExpand = true`. Setting a property emits the
 * `<kebab-name>-change` signal with the instance as argument when the value changed.
 *
 * Property declarations are inherited, and a subclass may redeclare a property to override
 * parts of its behavior (for instance only its default value).
 *
 * @param {Function} cls
 * @param {Record<string, PropertySpec>} specs Keyed by camelCase name.
 */
export declare function defineProperties(cls: Function, specs: Record<string, PropertySpec>): void;
/**
 * Base class of everything that has properties, signals and actions.
 *
 * Subclasses do their construction work in `_initialize()` (calling `super._initialize()` first)
 * instead of in a constructor. This guarantees that the object is fully set up before the
 * properties passed to the constructor are applied. For the same reason subclasses must not use
 * class field declarations.
 *
 * Every instance emits `destroy` when destroyed, and `<name>-change` for property changes.
 */
export declare class Instance {
    /** @type {SignalDispatcher | null} */
    _signalDispatcher: SignalDispatcher | null;
    _destroyed: boolean;
    /**
     * @param {Record<string, unknown>} [properties] Property values to set, keyed by camelCase or
     *     kebab-case name.
     */
    constructor(properties?: Record<string, unknown>);
    /**
     * Initializes the instance. Override this instead of the constructor.
     *
     * @protected
     */
    protected _initialize(): void;
    /**
     * Whether this instance has been destroyed.
     *
     * @type {boolean}
     */
    get destroyed(): boolean;
    /**
     * Connects to a signal.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context] The `this` of the handler.
     * @returns {() => void} A function that disconnects the handler again.
     */
    connect(name: string, method: Function, context?: object): () => void;
    /**
     * Connects to a signal, running before handlers connected earlier.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     * @returns {() => void}
     */
    connectFirst(name: string, method: Function, context?: object): () => void;
    /**
     * Connects to a signal, running after all other handlers.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     * @returns {() => void}
     */
    connectLast(name: string, method: Function, context?: object): () => void;
    /**
     * Disconnects a handler from a signal.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     */
    disconnect(name: string, method: Function, context?: object): void;
    /**
     * Emits a signal.
     *
     * @param {string} name
     * @param {...unknown} args
     * @returns {boolean} Whether a handler handled the signal by returning `true`.
     */
    emit(name: string, ...args: unknown[]): boolean;
    /**
     * Blocks a signal until {@link Instance#unblock} is called.
     *
     * @param {string} name
     */
    block(name: string): void;
    /**
     * Unblocks a signal.
     *
     * @param {string} name
     */
    unblock(name: string): void;
    /**
     * Sets a single property by name.
     *
     * @param {string} name A camelCase or kebab-case property name.
     * @param {unknown} value
     * @returns {boolean} Whether the value changed.
     * @throws {Error} If there is no such writable property.
     */
    setProperty(name: string, value: unknown): boolean;
    /**
     * Gets a single property by name.
     *
     * @param {string} name A camelCase or kebab-case property name.
     * @returns {unknown}
     * @throws {Error} If there is no such property.
     */
    getProperty(name: string): unknown;
    /**
     * Sets multiple properties. Properties declared as `late` (like `visible`) are set last.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean} Whether any value changed.
     */
    set(properties: Record<string, unknown>): boolean;
    /**
     * Gets multiple properties.
     *
     * @param {string[]} [names] The properties to get. Defaults to all readable properties.
     * @returns {Record<string, unknown>} Keyed by camelCase name.
     */
    getProperties(names?: string[]): Record<string, unknown>;
    /**
     * Checks whether a property exists.
     *
     * @param {string} name
     * @param {boolean} [readOnly] Whether read-only properties count as well.
     * @returns {boolean}
     */
    hasProperty(name: string, readOnly?: boolean): boolean;
    /**
     * Runs a public method by name. This is how declarative code (such as the builder) triggers
     * actions.
     *
     * @param {string} name A camelCase or kebab-case method name.
     * @param {unknown[]} [args]
     * @returns {unknown}
     * @throws {Error} If there is no such action.
     */
    doAction(name: string, args?: unknown[]): unknown;
    /**
     * Checks whether a public method exists.
     *
     * @param {string} name
     * @returns {boolean}
     */
    hasAction(name: string): boolean;
    /**
     * Destroys the instance and emits `destroy`.
     *
     * @throws {Error} If the instance has already been destroyed.
     */
    destroy(): void;
    /**
     * Returns the names of all readable properties of this class.
     *
     * @returns {string[]}
     */
    static getPropertyNames(): string[];
    /**
     * Returns the property info of a property, or `null`.
     *
     * @param {string} name
     * @returns {PropertyInfo | null}
     */
    static getPropertyInfo(name: string): PropertyInfo | null;
    _getPropertyInfo(name: any): any;
    _getSignalDispatcher(): SignalDispatcher;
}
/**
 * Creates the single instance of a class lazily, on first access.
 *
 * @template T
 * @param {() => T} factory
 * @returns {() => T}
 */
export declare function lazySingleton<T>(factory: () => T): () => T;
