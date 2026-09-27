/**
 * The object model: instances with declared properties, change signals and actions.
 *
 * @module core/instance
 */

import { SignalDispatcher } from './signal-dispatcher.js';
import { toCamelCase, toKebabCase } from './util.js';

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
export function defineProperties(cls, specs) {
    const baseProperties = Object.getPrototypeOf(cls).properties || {};

    /** @type {Record<string, PropertySpec>} */
    const ownSpecs = Object.hasOwn(cls, 'propertySpecs') ? cls.propertySpecs : {};

    /** @type {Record<string, PropertyInfo>} */
    const properties = Object.hasOwn(cls, 'properties')
        ? cls.properties
        : Object.create(baseProperties);

    for (const [name, override] of Object.entries(specs)) {
        // Merge with an inherited declaration.
        const baseSpec = findSpec(Object.getPrototypeOf(cls), name) || {};
        const spec = { ...baseSpec, ...override };

        ownSpecs[name] = spec;
        properties[name] = createPropertyInfo(cls, name, spec);

        if (Object.hasOwn(spec, 'value')) {
            cls.prototype['_' + name] = spec.value;
        }
    }

    cls.propertySpecs = ownSpecs;
    cls.properties = properties;
}

function findSpec(cls, name) {
    while (cls && cls !== Function.prototype) {
        if (Object.hasOwn(cls, 'propertySpecs') && cls.propertySpecs[name]) {
            return cls.propertySpecs[name];
        }

        cls = Object.getPrototypeOf(cls);
    }

    return null;
}

function createPropertyInfo(cls, name, spec) {
    const field = '_' + name;
    const signal = toKebabCase(name) + '-change';
    const hasDefault = Object.hasOwn(spec, 'value');

    const read = spec.get
        ? spec.get
        : function () {
              return this[field];
          };

    let write = null;
    if (!spec.readOnly) {
        write = function (value) {
            if (spec.coerce) {
                value = spec.coerce.call(this, value);
            }

            if (hasDefault && Object.is(value, this[field])) {
                return false;
            }

            if (spec.set) {
                if (spec.set.call(this, value) === false) {
                    return false;
                }
            } else {
                const oldValue = this[field];
                this[field] = value;

                spec.changed?.call(this, value, oldValue);
            }

            if (spec.signal !== false) {
                this.emit(signal, this);
            }

            return true;
        };
    }

    Object.defineProperty(cls.prototype, name, {
        configurable: true,
        enumerable: false,
        get() {
            return read.call(this);
        },
        set(value) {
            if (!write) {
                throw new TypeError(`Property '${name}' of ${cls.name} is read-only.`);
            }

            write.call(this, value);
        },
    });

    return {
        name,
        signal,
        readOnly: Boolean(spec.readOnly),
        late: Boolean(spec.late),
        read,
        write,
    };
}

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
export class Instance {
    /**
     * @param {Record<string, unknown>} [properties] Property values to set, keyed by camelCase or
     *     kebab-case name.
     */
    constructor(properties) {
        this._initialize();

        if (properties) {
            this.set(properties);
        }
    }

    /**
     * Initializes the instance. Override this instead of the constructor.
     *
     * @protected
     */
    _initialize() {
        /** @type {SignalDispatcher | null} */
        this._signalDispatcher = null;

        this._destroyed = false;
    }

    /**
     * Whether this instance has been destroyed.
     *
     * @type {boolean}
     */
    get destroyed() {
        return this._destroyed;
    }

    /**
     * Connects to a signal.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context] The `this` of the handler.
     * @returns {() => void} A function that disconnects the handler again.
     */
    connect(name, method, context) {
        return this._getSignalDispatcher().connect(name, method, context);
    }

    /**
     * Connects to a signal, running before handlers connected earlier.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     * @returns {() => void}
     */
    connectFirst(name, method, context) {
        return this._getSignalDispatcher().connectFirst(name, method, context);
    }

    /**
     * Connects to a signal, running after all other handlers.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     * @returns {() => void}
     */
    connectLast(name, method, context) {
        return this._getSignalDispatcher().connectLast(name, method, context);
    }

    /**
     * Disconnects a handler from a signal.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     */
    disconnect(name, method, context) {
        this._signalDispatcher?.disconnect(name, method, context);
    }

    /**
     * Emits a signal.
     *
     * @param {string} name
     * @param {...unknown} args
     * @returns {boolean} Whether a handler handled the signal by returning `true`.
     */
    emit(name, ...args) {
        return this._signalDispatcher ? this._signalDispatcher.emit(name, ...args) : false;
    }

    /**
     * Blocks a signal until {@link Instance#unblock} is called.
     *
     * @param {string} name
     */
    block(name) {
        this._getSignalDispatcher().block(name);
    }

    /**
     * Unblocks a signal.
     *
     * @param {string} name
     */
    unblock(name) {
        this._signalDispatcher?.unblock(name);
    }

    /**
     * Sets a single property by name.
     *
     * @param {string} name A camelCase or kebab-case property name.
     * @param {unknown} value
     * @returns {boolean} Whether the value changed.
     * @throws {Error} If there is no such writable property.
     */
    setProperty(name, value) {
        const property = this._getPropertyInfo(name);
        if (!property.write) {
            throw new Error(`${this.constructor.name} has no writable property named '${name}'.`);
        }

        return property.write.call(this, value);
    }

    /**
     * Gets a single property by name.
     *
     * @param {string} name A camelCase or kebab-case property name.
     * @returns {unknown}
     * @throws {Error} If there is no such property.
     */
    getProperty(name) {
        return this._getPropertyInfo(name).read.call(this);
    }

    /**
     * Sets multiple properties. Properties declared as `late` (like `visible`) are set last.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean} Whether any value changed.
     */
    set(properties) {
        let changed = false;

        const late = [];
        for (const [name, value] of Object.entries(properties)) {
            const property = this._getPropertyInfo(name);
            if (property.late) {
                late.push([name, value]);
            } else if (this.setProperty(name, value)) {
                changed = true;
            }
        }

        for (const [name, value] of late) {
            if (this.setProperty(name, value)) {
                changed = true;
            }
        }

        return changed;
    }

    /**
     * Gets multiple properties.
     *
     * @param {string[]} [names] The properties to get. Defaults to all readable properties.
     * @returns {Record<string, unknown>} Keyed by camelCase name.
     */
    getProperties(names) {
        const result = {};

        for (const name of names || this.constructor.getPropertyNames()) {
            result[toCamelCase(name)] = this.getProperty(name);
        }

        return result;
    }

    /**
     * Checks whether a property exists.
     *
     * @param {string} name
     * @param {boolean} [readOnly] Whether read-only properties count as well.
     * @returns {boolean}
     */
    hasProperty(name, readOnly = false) {
        const property = this.constructor.properties?.[toCamelCase(name)];

        return Boolean(property && (readOnly || property.write));
    }

    /**
     * Runs a public method by name. This is how declarative code (such as the builder) triggers
     * actions.
     *
     * @param {string} name A camelCase or kebab-case method name.
     * @param {unknown[]} [args]
     * @returns {unknown}
     * @throws {Error} If there is no such action.
     */
    doAction(name, args = []) {
        const method = toCamelCase(name);
        if (!this.hasAction(method)) {
            throw new Error(`${this.constructor.name} has no action named '${name}'.`);
        }

        return this[method](...args);
    }

    /**
     * Checks whether a public method exists.
     *
     * @param {string} name
     * @returns {boolean}
     */
    hasAction(name) {
        const method = toCamelCase(name);

        return (
            !method.startsWith('_') &&
            method !== 'constructor' &&
            typeof this[method] === 'function' &&
            !(method in (this.constructor.properties || {}))
        );
    }

    /**
     * Destroys the instance and emits `destroy`.
     *
     * @throws {Error} If the instance has already been destroyed.
     */
    destroy() {
        if (this._destroyed) {
            throw new Error('Instance has already been destroyed.');
        }

        this._destroyed = true;

        this.emit('destroy', this);

        this._signalDispatcher?.clear();
    }

    /**
     * Returns the names of all readable properties of this class.
     *
     * @returns {string[]}
     */
    static getPropertyNames() {
        const names = [];

        // Walk the prototype chain of the property map, which also contains inherited entries.
        for (const name in this.properties || {}) {
            names.push(name);
        }

        return names;
    }

    /**
     * Returns the property info of a property, or `null`.
     *
     * @param {string} name
     * @returns {PropertyInfo | null}
     */
    static getPropertyInfo(name) {
        return this.properties?.[toCamelCase(name)] || null;
    }

    _getPropertyInfo(name) {
        const property = this.constructor.properties?.[toCamelCase(name)];
        if (!property) {
            throw new Error(`${this.constructor.name} has no property named '${name}'.`);
        }

        return property;
    }

    _getSignalDispatcher() {
        if (!this._signalDispatcher) {
            this._signalDispatcher = new SignalDispatcher();
        }

        return this._signalDispatcher;
    }
}

/**
 * Creates the single instance of a class lazily, on first access.
 *
 * @template T
 * @param {() => T} factory
 * @returns {() => T}
 */
export function lazySingleton(factory) {
    let instance = null;

    return () => {
        if (!instance) {
            instance = factory();
        }

        return instance;
    };
}
