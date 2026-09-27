/**
 * @module navigation/navigator
 */
import { Instance } from '../core/instance.js';
export type NavigatorEnvironment = {
    location: {
        hash: string;
    };
    history?: {
        back(): void;
        forward(): void;
    };
    addEventListener: (type: string, listener: () => void, capture?: boolean) => void;
    removeEventListener?: (type: string, listener: () => void, capture?: boolean) => void;
};
/**
 * Composes a token from a name and arguments, encoding each part, e.g. `'user/42/a%2Fb'`.
 *
 * @param {string} tokenName
 * @param {unknown[]} [tokenArguments]
 * @returns {string}
 */
export declare function composeToken(tokenName: string, tokenArguments?: unknown[]): string;
/**
 * Splits a token in its decoded name and arguments.
 *
 * @param {string} token
 * @returns {{tokenName: string, tokenArguments: string[]}}
 */
export declare function parseToken(token: string): {
    tokenName: string;
    tokenArguments: string[];
};
/**
 * The navigator keeps the location hash in sync with the state of the application, for
 * bookmarkable pages and the browser's back and forward buttons. The hash is a token: a name
 * followed by arguments, separated by slashes (`#user/42/edit`). Names and arguments are
 * URI-encoded in the token, so they may contain any character, including slashes.
 *
 * Setting `token`, `tokenName` or `tokenArguments` changes the hash, and changing the hash (by
 * the user or the browser) changes them.
 *
 * Signals: `token-change`, `token-name-change` and `token-arguments-change`, each when that part
 * changed.
 *
 * @example
 * const navigator = getNavigator();
 * navigator.connect('token-name-change', () => showPage(navigator.tokenName));
 * navigator.navigate('user', 42); // #user/42
 */
export declare class Navigator extends Instance {
    _tokenName: string;
    _tokenArguments: readonly any[] | readonly string[];
    /** @type {NavigatorEnvironment | null} */
    _environment: NavigatorEnvironment | null;
    _onHashChange: () => void;
    token: string;
    _initialize(): void;
    /**
     * Sets the token name and its arguments at once.
     *
     * @param {string} tokenName
     * @param {unknown[]} [tokenArguments] Strings or numbers.
     */
    setTokenNameAndArguments(tokenName: string, tokenArguments?: unknown[]): void;
    /**
     * Navigates to a token name with arguments, e.g. `navigate('user', 42)` for `#user/42`.
     *
     * @param {string} tokenName
     * @param {...(string | number)} tokenArguments
     */
    navigate(tokenName: string, ...tokenArguments: (string | number)[]): void;
    /**
     * Goes back in the browser history.
     */
    back(): void;
    /**
     * Goes forward in the browser history.
     */
    forward(): void;
    destroy(): void;
    _getHistory(): {
        back(): void;
        forward(): void;
    };
    _readHash(): string;
    _onTokenChange(): void;
}
/**
 * Returns the navigator singleton of the browser window, created on first use.
 *
 * @type {() => Navigator}
 * @throws {Error} Outside a browser; construct a `Navigator` with an environment there.
 */
export declare const getNavigator: () => Navigator;

/** The declared properties of {@link Navigator}. */
export interface Navigator {
    /**
     * Where the navigator reads and writes the hash: `window` in a browser. It can be set only
     * once; the navigator then takes its token from the current hash and follows `hashchange`
     * events.
     */
    environment: any;
    /**
     * The (decoded) token name of the current location. Setting it resets the arguments.
     */
    tokenName: any;
    /**
     * The (decoded) token arguments of the current location, as strings. Setting it keeps the
     * name. Do not modify the returned array.
     */
    tokenArguments: any;
}
