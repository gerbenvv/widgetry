// Tests of the hash-based navigator, with a stand-in for the browser window.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { composeToken, getNavigator, Navigator, parseToken } from '../navigator.js';

/**
 * A minimal browser window: a location with a hash, a history and hash change events.
 */
class FakeWindow {
    constructor(hash = '') {
        this._hash = hash;
        this.listeners = [];
        this.entries = [hash];
        this.index = 0;

        const self = this;
        this.location = {
            get hash() {
                return self._hash;
            },
            set hash(hash) {
                self._setHash(hash.startsWith('#') || !hash ? hash : '#' + hash, true);
            },
        };

        this.history = {
            back: () => this._go(-1),
            forward: () => this._go(1),
        };
    }

    addEventListener(type, listener) {
        if (type === 'hashchange') {
            this.listeners.push(listener);
        }
    }

    removeEventListener(type, listener) {
        this.listeners = this.listeners.filter((x) => x !== listener);
    }

    // Changes the hash as the user would, e.g. by editing the address.
    type(hash) {
        this._setHash(hash, true);
        this.fire();
    }

    fire() {
        for (const listener of this.listeners) {
            listener();
        }
    }

    _setHash(hash, record) {
        this._hash = hash;

        if (record) {
            this.entries = this.entries.slice(0, this.index + 1);
            this.entries.push(hash);
            this.index += 1;
        }
    }

    _go(delta) {
        this.index = Math.max(0, Math.min(this.entries.length - 1, this.index + delta));
        this._setHash(this.entries[this.index], false);
        this.fire();
    }
}

function createNavigator(hash = '') {
    const environment = new FakeWindow(hash);
    const navigator = new Navigator({ environment });

    const events = [];
    for (const signal of ['token-change', 'token-name-change', 'token-arguments-change']) {
        navigator.connect(signal, () => events.push(signal));
    }

    return { environment, navigator, events };
}

describe('Navigator', () => {
    test('takes the token from the current hash', () => {
        const { navigator } = createNavigator('#user/42/edit');

        assert.equal(navigator.token, 'user/42/edit');
        assert.equal(navigator.tokenName, 'user');
        assert.deepEqual(navigator.tokenArguments, ['42', 'edit']);
    });

    test('updates the hash and emits signals for the parts that changed', () => {
        const { environment, navigator, events } = createNavigator();

        navigator.token = 'user/42';
        assert.equal(environment.location.hash, '#user/42');
        assert.deepEqual(events, ['token-name-change', 'token-arguments-change', 'token-change']);

        events.length = 0;
        navigator.token = 'user/43';
        assert.deepEqual(events, ['token-arguments-change', 'token-change']);

        events.length = 0;
        navigator.token = 'group/43';
        assert.deepEqual(events, ['token-name-change', 'token-change']);

        events.length = 0;
        navigator.token = 'group/43';
        assert.deepEqual(events, []);

        navigator.token = '';
        assert.equal(environment.location.hash, '');
        assert.equal(navigator.tokenName, '');
        assert.deepEqual(navigator.tokenArguments, []);
    });

    test('sets the name and the arguments', () => {
        const { environment, navigator } = createNavigator('#user/42');

        navigator.tokenArguments = ['7', 8];
        assert.equal(navigator.token, 'user/7/8');

        navigator.tokenName = 'settings';
        assert.equal(navigator.token, 'settings');
        assert.deepEqual(navigator.tokenArguments, []);

        navigator.setTokenNameAndArguments('search', ['a b']);
        assert.equal(environment.location.hash, '#search/a%20b');

        navigator.navigate('file', '/home/user', 'x');
        assert.equal(navigator.token, 'file/%2Fhome%2Fuser/x');
        assert.deepEqual(navigator.tokenArguments, ['/home/user', 'x']);
    });

    test('encodes names and arguments with any characters', () => {
        const { environment, navigator } = createNavigator();

        navigator.navigate('a/b', 'c%d', 'é', '#', '');
        assert.equal(navigator.tokenName, 'a/b');
        assert.deepEqual(navigator.tokenArguments, ['c%d', 'é', '#', '']);
        assert.equal(environment.location.hash, '#a%2Fb/c%25d/%C3%A9/%23/');
    });

    test('encodes a token set directly the way browsers encode hashes', () => {
        const { environment, navigator, events } = createNavigator();

        navigator.token = 'raw token/ü/"<a>"/it\'s%20ok';
        assert.equal(navigator.token, "raw%20token/%C3%BC/%22%3Ca%3E%22/it's%20ok");
        assert.equal(environment.location.hash, '#' + navigator.token);
        assert.equal(navigator.tokenName, 'raw token');
        assert.deepEqual(navigator.tokenArguments, ['ü', '"<a>"', "it's ok"]);

        // The browser keeps the hash as it is, so the token does not change again.
        environment.fire();
        assert.deepEqual(events, ['token-name-change', 'token-arguments-change', 'token-change']);
    });

    test('follows hash changes of the browser', () => {
        const { environment, navigator, events } = createNavigator();

        environment.type('#page/2');
        assert.equal(navigator.tokenName, 'page');
        assert.deepEqual(navigator.tokenArguments, ['2']);

        // Malformed escapes are kept as they are.
        environment.type('#page/%E0%A4%A');
        assert.deepEqual(navigator.tokenArguments, ['%E0%A4%A']);

        // The event after our own change does not emit again.
        events.length = 0;
        navigator.navigate('home');
        environment.fire();
        assert.deepEqual(events, ['token-name-change', 'token-arguments-change', 'token-change']);
    });

    test('goes back and forward', () => {
        const { navigator } = createNavigator();

        navigator.navigate('one');
        navigator.navigate('two');
        navigator.back();
        assert.equal(navigator.tokenName, 'one');

        navigator.forward();
        assert.equal(navigator.tokenName, 'two');
    });

    test('stops listening when destroyed', () => {
        const { environment, navigator } = createNavigator();

        navigator.destroy();
        assert.equal(environment.listeners.length, 0);
    });

    test('works without an environment', () => {
        const navigator = new Navigator();

        navigator.navigate('x', 1);
        assert.equal(navigator.token, 'x/1');
        assert.throws(() => navigator.back(), /no history/);
    });

    test('rejects invalid arguments', () => {
        const { navigator } = createNavigator();

        assert.throws(() => (navigator.token = 5), TypeError);
        assert.throws(() => (navigator.tokenArguments = 'x'), TypeError);
        assert.throws(() => navigator.navigate('x', {}), TypeError);
        assert.throws(() => (navigator.environment = new FakeWindow()), /only once/);
        assert.throws(() => new Navigator({ environment: {} }), TypeError);
        assert.throws(() => (navigator.tokenArguments.length = 0), TypeError);
    });

    test('composes and parses tokens', () => {
        assert.equal(composeToken('a', ['b/c', 1]), 'a/b%2Fc/1');
        assert.deepEqual(parseToken('a/b%2Fc/1'), { tokenName: 'a', tokenArguments: ['b/c', '1'] });
        assert.deepEqual(parseToken(''), { tokenName: '', tokenArguments: [] });
    });

    test('needs a browser window for the singleton', () => {
        assert.throws(() => getNavigator(), /needs a browser window/);
    });
});
