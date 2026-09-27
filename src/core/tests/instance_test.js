// Tests of the object model: properties, signals and actions.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { defineProperties, Instance } from '../instance.js';
import { SignalDispatcher } from '../signal-dispatcher.js';

class Animal extends Instance {
    _initialize() {
        super._initialize();

        this.log = [];
    }

    speak(word) {
        return `${this._name} says ${word}`;
    }
}

defineProperties(Animal, {
    name: { value: 'animal' },
    legs: {
        value: 4,
        coerce: Number,
        changed(legs, oldLegs) {
            this.log.push([oldLegs, legs]);
        },
    },
    visible: { value: true, late: true },
    kind: { readOnly: true, get: () => 'animal' },
    silent: {
        value: false,
        set(silent) {
            if (silent && this._name === 'parrot') {
                return false;
            }

            this._silent = silent;
        },
    },
});

class Bird extends Animal {}

defineProperties(Bird, {
    legs: { value: 2 },
    wingSpan: { value: 0 },
});

describe('Instance', () => {
    test('uses defaults and emits change signals', () => {
        const animal = new Animal();
        const changes = [];
        animal.connect('legs-change', (instance) => changes.push(instance.legs));

        assert.equal(animal.legs, 4);

        animal.legs = '3';
        animal.legs = 3;

        assert.deepEqual(changes, [3]);
        assert.deepEqual(animal.log, [[4, 3]]);
    });

    test('applies constructor properties with kebab-case names and late properties last', () => {
        const order = [];
        class Tracker extends Animal {}
        defineProperties(Tracker, {
            name: { changed: () => order.push('name') },
            visible: { changed: () => order.push('visible') },
        });

        const tracker = new Tracker({ visible: false, name: 'x', legs: 1 });

        assert.deepEqual(order, ['name', 'visible']);
        assert.equal(tracker.getProperty('legs'), 1);
        assert.equal(tracker.getProperty('name'), 'x');
    });

    test('inherits and overrides property declarations', () => {
        const bird = new Bird({ wingSpan: 30 });

        assert.equal(bird.legs, 2);
        assert.equal(new Animal().legs, 4);
        assert.equal(bird.wingSpan, 30);
        assert.equal(bird.hasProperty('wing-span'), true);
        assert.equal(new Animal().hasProperty('wingSpan'), false);
        assert.ok(Bird.getPropertyNames().includes('name'));
    });

    test('rejects read-only and unknown properties', () => {
        const animal = new Animal();

        assert.throws(() => {
            animal.kind = 'plant';
        }, TypeError);
        assert.throws(() => animal.setProperty('kind', 'plant'), /no writable property/);
        assert.throws(() => animal.set({ color: 'red' }), /no property named 'color'/);
        assert.equal(animal.hasProperty('kind'), false);
        assert.equal(animal.hasProperty('kind', true), true);
    });

    test('custom setters can report no change', () => {
        const parrot = new Animal({ name: 'parrot' });
        let emitted = 0;
        parrot.connect('silent-change', () => (emitted += 1));

        assert.equal(parrot.setProperty('silent', true), false);
        assert.equal(emitted, 0);
    });

    test('gets multiple properties', () => {
        const animal = new Animal({ name: 'cat' });

        assert.deepEqual(animal.getProperties(['name', 'legs']), { name: 'cat', legs: 4 });
        assert.equal(animal.getProperties().kind, 'animal');
    });

    test('runs actions by name', () => {
        const animal = new Animal({ name: 'dog' });

        assert.equal(animal.doAction('speak', ['woof']), 'dog says woof');
        assert.equal(animal.hasAction('_initialize'), false);
        assert.equal(animal.hasAction('name'), false);
        assert.throws(() => animal.doAction('fly'), /no action named 'fly'/);
    });

    test('destroys once and emits destroy', () => {
        const animal = new Animal();
        let destroyed = 0;
        animal.connect('destroy', () => (destroyed += 1));

        animal.destroy();

        assert.equal(animal.destroyed, true);
        assert.equal(destroyed, 1);
        assert.throws(() => animal.destroy(), /already been destroyed/);
    });
});

describe('SignalDispatcher', () => {
    test('orders handlers and reports whether the signal was handled', () => {
        const dispatcher = new SignalDispatcher();
        const calls = [];

        dispatcher.connectLast('go', () => calls.push('last'));
        dispatcher.connect('go', () => calls.push('normal'));
        dispatcher.connectFirst('go', () => {
            calls.push('first');

            return true;
        });
        dispatcher.connect('go', () => calls.push('normal 2'));

        assert.equal(dispatcher.emit('go'), true);
        assert.deepEqual(calls, ['first', 'normal', 'normal 2', 'last']);
    });

    test('disconnects, blocks and unblocks', () => {
        const dispatcher = new SignalDispatcher();
        const context = {};
        let count = 0;

        function handler() {
            count += 1;
        }

        const disconnect = dispatcher.connect('go', handler, context);

        dispatcher.block('go');
        dispatcher.block('go');
        dispatcher.emit('go');
        dispatcher.unblock('go');
        dispatcher.emit('go');
        dispatcher.unblock('go');
        dispatcher.emit('go');

        disconnect();
        dispatcher.emit('go');

        assert.equal(count, 1);
        assert.equal(dispatcher.hasHandlers('go'), false);
    });

    test('is not affected by handlers that disconnect during an emit', () => {
        const dispatcher = new SignalDispatcher();
        const calls = [];

        const disconnect = dispatcher.connect('go', () => {
            calls.push('a');
            disconnect();
        });
        dispatcher.connect('go', () => calls.push('b'));

        dispatcher.emit('go');
        dispatcher.emit('go');

        assert.deepEqual(calls, ['a', 'b', 'b']);
    });
});

describe('SignalDispatcher disconnection', () => {
    test('skips handlers disconnected by an earlier handler of the same emit', () => {
        const dispatcher = new SignalDispatcher();
        const calls = [];

        let disconnectB = null;
        dispatcher.connect('go', () => {
            calls.push('a');
            disconnectB();
        });
        disconnectB = dispatcher.connect('go', () => calls.push('b'));

        dispatcher.emit('go');

        assert.deepEqual(calls, ['a']);
    });

    test('skips all remaining handlers when cleared during an emit', () => {
        const dispatcher = new SignalDispatcher();
        const calls = [];

        dispatcher.connect('go', () => {
            calls.push('a');
            dispatcher.clear();
        });
        dispatcher.connect('go', () => calls.push('b'));
        dispatcher.connectLast('go', () => calls.push('last'));

        dispatcher.emit('go');

        assert.deepEqual(calls, ['a']);
    });

    test('a disconnect function removes only its own connection, once', () => {
        const dispatcher = new SignalDispatcher();
        const calls = [];

        function handler(name) {
            calls.push(name);
        }

        const disconnectFirst = dispatcher.connect('go', handler);
        dispatcher.connect('go', handler);

        disconnectFirst();
        disconnectFirst();
        dispatcher.emit('go', 'x');

        assert.deepEqual(calls, ['x']);
        assert.equal(dispatcher.hasHandlers('go'), true);
    });
});

describe('Instance.set', () => {
    test('changes nothing when a name is unknown or read-only', () => {
        const animal = new Animal({ name: 'cat' });

        assert.throws(() => animal.set({ name: 'dog', color: 'red' }), /no property named/);
        assert.throws(() => animal.set({ name: 'dog', kind: 'plant' }), /no writable property/);

        assert.equal(animal.name, 'cat');
    });
});

describe('defineProperties', () => {
    test('merges a redeclaration with an earlier one of the same class', () => {
        const log = [];

        class Fish extends Animal {}
        defineProperties(Fish, { legs: { value: 0 } });
        defineProperties(Fish, { legs: { changed: (legs) => log.push(legs) } });

        const fish = new Fish();
        fish.legs = 0;
        fish.legs = 1;

        assert.equal(new Fish().legs, 0);
        assert.deepEqual(log, [1]);
    });
});
