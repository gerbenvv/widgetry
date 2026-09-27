/**
 * The type registry maps declarative type names (as used by the builder) to classes.
 *
 * @module core/registry
 */
export type TypeEntry = {
    cls: Function;
    /**
     *     An optional custom constructor, for classes whose constructor does not take properties.
     */
    factory: ((properties: Record<string, unknown>, builder: object) => object) | null;
};
/**
 * Registers a class under a type name, e.g. `registerType('button', Button)`.
 *
 * @param {string} type A kebab-case type name.
 * @param {Function} cls
 * @param {TypeEntry['factory']} [factory]
 */
export declare function registerType(type: string, cls: Function, factory?: TypeEntry['factory']): void;
/**
 * Looks up a registered type.
 *
 * @param {string} type
 * @returns {TypeEntry | null}
 */
export declare function getType(type: string): TypeEntry | null;
/**
 * Returns the registered type name of a class, or `null`.
 *
 * @param {Function} cls
 * @returns {string | null}
 */
export declare function getTypeName(cls: Function): string | null;
/**
 * Returns all registered type names.
 *
 * @returns {string[]}
 */
export declare function getTypeNames(): string[];
