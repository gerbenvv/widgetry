/**
 * The type registry maps declarative type names (as used by the builder) to classes.
 *
 * @module core/registry
 */

/**
 * @typedef {object} TypeEntry
 * @property {Function} cls
 * @property {((properties: Record<string, unknown>, builder: object) => object) | null} factory
 *     An optional custom constructor, for classes whose constructor does not take properties.
 */

/** @type {Map<string, TypeEntry>} */
const TYPES = new Map();

/**
 * Registers a class under a type name, e.g. `registerType('button', Button)`.
 *
 * @param {string} type A kebab-case type name.
 * @param {Function} cls
 * @param {TypeEntry['factory']} [factory]
 */
export function registerType(type, cls, factory = null) {
    TYPES.set(type, { cls, factory });
}

/**
 * Looks up a registered type.
 *
 * @param {string} type
 * @returns {TypeEntry | null}
 */
export function getType(type) {
    return TYPES.get(type) || null;
}

/**
 * Returns the registered type name of a class, or `null`.
 *
 * @param {Function} cls
 * @returns {string | null}
 */
export function getTypeName(cls) {
    for (const [type, entry] of TYPES) {
        if (entry.cls === cls) {
            return type;
        }
    }

    return null;
}

/**
 * Returns all registered type names.
 *
 * @returns {string[]}
 */
export function getTypeNames() {
    return [...TYPES.keys()];
}
