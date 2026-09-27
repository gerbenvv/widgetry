/**
 * @module navigation/navigator
 */

import { areEqual } from '../core/util.js';
import { defineProperties, Instance, lazySingleton } from '../core/instance.js';

/**
 * @typedef {object} NavigatorEnvironment The parts of `window` the navigator uses; `window`
 *     itself in a browser, or a stand-in in tests.
 * @property {{hash: string}} location
 * @property {{back(): void, forward(): void}} [history]
 * @property {(type: string, listener: () => void, capture?: boolean) => void} addEventListener
 * @property {(type: string, listener: () => void, capture?: boolean) => void} [removeEventListener]
 */

function decode(text) {
    try {
        return decodeURIComponent(text);
    } catch (_error) {
        // Keep malformed escapes as they are.
        return text;
    }
}

function checkArguments(tokenArguments) {
    if (!Array.isArray(tokenArguments)) {
        throw new TypeError('The token arguments must be an array.');
    }

    return tokenArguments.map((x) => {
        if (x === null || x === undefined || typeof x === 'object') {
            throw new TypeError('A token argument must be a string or a number.');
        }

        return String(x);
    });
}

/**
 * Composes a token from a name and arguments, encoding each part, e.g. `'user/42/a%2Fb'`.
 *
 * @param {string} tokenName
 * @param {unknown[]} [tokenArguments]
 * @returns {string}
 */
export function composeToken(tokenName, tokenArguments = []) {
    if (typeof tokenName !== 'string') {
        throw new TypeError('The token name must be a string.');
    }

    return [tokenName, ...checkArguments(tokenArguments)].map(encodeURIComponent).join('/');
}

/**
 * Splits a token in its decoded name and arguments.
 *
 * @param {string} token
 * @returns {{tokenName: string, tokenArguments: string[]}}
 */
export function parseToken(token) {
    const [tokenName, ...tokenArguments] = token.split('/').map(decode);

    return { tokenName, tokenArguments };
}

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
export class Navigator extends Instance {
    _initialize() {
        super._initialize();

        this._tokenName = '';
        this._tokenArguments = Object.freeze([]);

        /** @type {NavigatorEnvironment | null} */
        this._environment = null;

        this._onHashChange = () => {
            this.token = this._readHash();
        };
    }

    /**
     * Sets the token name and its arguments at once.
     *
     * @param {string} tokenName
     * @param {unknown[]} [tokenArguments] Strings or numbers.
     */
    setTokenNameAndArguments(tokenName, tokenArguments = []) {
        this.token = composeToken(tokenName, tokenArguments);
    }

    /**
     * Navigates to a token name with arguments, e.g. `navigate('user', 42)` for `#user/42`.
     *
     * @param {string} tokenName
     * @param {...(string | number)} tokenArguments
     */
    navigate(tokenName, ...tokenArguments) {
        this.setTokenNameAndArguments(tokenName, tokenArguments);
    }

    /**
     * Goes back in the browser history.
     */
    back() {
        this._getHistory().back();
    }

    /**
     * Goes forward in the browser history.
     */
    forward() {
        this._getHistory().forward();
    }

    destroy() {
        this._environment?.removeEventListener?.('hashchange', this._onHashChange, true);

        super.destroy();
    }

    _getHistory() {
        const history = this._environment?.history;
        if (!history) {
            throw new Error('The navigator has no history in its environment.');
        }

        return history;
    }

    _readHash() {
        return (this._environment?.location.hash || '').replace(/^#/, '');
    }

    _onTokenChange() {
        const { tokenName, tokenArguments } = parseToken(this._token);

        // Update the location.
        if (this._environment) {
            const hash = this._token ? '#' + this._token : '';
            if (hash !== this._environment.location.hash) {
                this._environment.location.hash = hash;
            }
        }

        const nameChanged = tokenName !== this._tokenName;
        const argumentsChanged = !areEqual(tokenArguments, [...this._tokenArguments]);

        this._tokenName = tokenName;
        if (argumentsChanged) {
            this._tokenArguments = Object.freeze(tokenArguments);
        }

        if (nameChanged) {
            this.emit('token-name-change', this);
        }

        if (argumentsChanged) {
            this.emit('token-arguments-change', this);
        }
    }
}

defineProperties(Navigator, {
    /**
     * Where the navigator reads and writes the hash: `window` in a browser. It can be set only
     * once; the navigator then takes its token from the current hash and follows `hashchange`
     * events.
     */
    environment: {
        value: null,
        set(environment) {
            if (this._environment) {
                throw new Error('The environment of a navigator can be set only once.');
            }

            if (
                !environment ||
                typeof environment.location !== 'object' ||
                typeof environment.addEventListener !== 'function'
            ) {
                throw new TypeError(
                    'The environment must have a location and an addEventListener method.'
                );
            }

            this._environment = environment;
            environment.addEventListener('hashchange', this._onHashChange, true);

            this.token = this._readHash();
        },
    },

    /**
     * The token of the current location, the hash without `#`. It contains the whole (encoded)
     * token, including the name and the arguments.
     */
    token: {
        value: '',
        coerce(token) {
            if (typeof token !== 'string') {
                throw new TypeError('The token must be a string.');
            }

            return token.replace(/^#/, '');
        },
        changed() {
            this._onTokenChange();
        },
    },

    /**
     * The (decoded) token name of the current location. Setting it resets the arguments.
     */
    tokenName: {
        set(tokenName) {
            this.token = composeToken(tokenName);

            return false;
        },
    },

    /**
     * The (decoded) token arguments of the current location, as strings. Setting it keeps the
     * name. Do not modify the returned array.
     */
    tokenArguments: {
        set(tokenArguments) {
            this.token = composeToken(this._tokenName, tokenArguments);

            return false;
        },
    },
});

/**
 * Returns the navigator singleton of the browser window, created on first use.
 *
 * @type {() => Navigator}
 * @throws {Error} Outside a browser; construct a `Navigator` with an environment there.
 */
export const getNavigator = lazySingleton(() => {
    if (typeof window === 'undefined') {
        throw new Error('The navigator needs a browser window; create a Navigator instead.');
    }

    return new Navigator({ environment: window });
});
