// Tests of the declarative builder, with small classes registered only for the tests.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { defineProperties, Instance } from '../../core/instance.js';
import { registerType } from '../../core/registry.js';
import { ButtonGroup } from '../../widgets/button-group.js';
import { build, Builder, BuilderError } from '../builder.js';

class TestWidget extends Instance {
    _initialize() {
        super._initialize();

        this.log = [];
        this.parent = null;
    }
}

defineProperties(TestWidget, {
    label: {
        value: '',
        changed(label) {
            this.log.push(`label ${label}`);
        },
    },
    visible: {
        value: true,
        late: true,
        changed(visible) {
            this.log.push(`visible ${visible}`);
        },
    },
    buddy: { value: null },
    adjustment: { value: null },
    options: { value: null },
    kind: { readOnly: true, get: () => 'widget' },
});

class TestContainer extends TestWidget {
    _initialize() {
        super._initialize();

        this._children = [];
    }

    addChild(child, ...args) {
        child.parent = this;
        child.addArguments = args;
        this._children.push(child);

        return child;
    }
}

defineProperties(TestContainer, {
    children: {
        readOnly: true,
        get() {
            return this._children;
        },
    },
});

class TestBin extends TestContainer {}

defineProperties(TestBin, {
    child: {
        get() {
            return this._children[0] || null;
        },
        set(child) {
            this._children = [];
            this.addChild(child);
        },
    },
});

// A container without a child property, whose child is added with addChild().
class TestFrame extends TestContainer {}

// A grid with a builder property for its children, like the Grid widget.
class TestGrid extends TestContainer {}

TestGrid.builderProperties = {
    children(builder, grid, children) {
        for (const description of children) {
            const { row, column, ...rest } = description;
            grid.addChild(builder.buildOne(rest), row, column);
        }
    },
};

// A subclass whose own hook wins over the inherited one.
class TestSpecialGrid extends TestGrid {}

TestSpecialGrid.builderProperties = {
    children(builder, grid, children) {
        for (const child of builder.build(children)) {
            grid.addChild(child, 'special');
        }
    },
};

class TestAdjustment extends Instance {}

defineProperties(TestAdjustment, {
    value: { value: 0 },
    upper: { value: 100 },
});

// A class that is not an instance, created by a factory.
class TestMatrix {
    constructor(a, b) {
        this.a = a;
        this.b = b;
    }
}

class TestPlain {}

registerType('test-widget', TestWidget);
registerType('test-container', TestContainer);
registerType('test-bin', TestBin);
registerType('test-frame', TestFrame);
registerType('test-grid', TestGrid);
registerType('test-special-grid', TestSpecialGrid);
registerType('test-adjustment', TestAdjustment);
registerType('test-matrix', TestMatrix, (properties, builder) => {
    assert.ok(builder instanceof Builder);

    return new TestMatrix(properties.firstValue, properties.b);
});
registerType('test-plain', TestPlain);

describe('Builder', () => {
    test('builds objects with properties, late properties last', () => {
        const builder = new Builder();
        const [widget] = builder.build({ type: 'test-widget', visible: false, label: 'OK' });

        assert.ok(widget instanceof TestWidget);
        assert.deepEqual(widget.log, ['label OK', 'visible false']);
        assert.deepEqual(builder.objects, [widget]);
    });

    test('builds arrays and JSON, and accumulates root objects', () => {
        const builder = new Builder();

        const first = builder.build([
            { type: 'test-widget' },
            [{ type: 'test-widget', label: 'b' }],
        ]);
        const second = builder.build('{"type": "test-widget", "label": "json", "id": "json"}');

        assert.equal(first.length, 2);
        assert.equal(first[1].label, 'b');
        assert.equal(second[0].label, 'json');
        assert.equal(builder.objects.length, 3);
        assert.equal(builder.getObjectById('json'), second[0]);
    });

    test('adds children and a child', () => {
        const builder = new Builder();
        const root = builder.buildOne({
            type: 'test-container',
            children: [
                { type: 'test-widget', label: 'a' },
                { type: 'test-bin', child: { type: 'test-widget', label: 'in bin' } },
                { type: 'test-frame', child: { type: 'test-widget', label: 'in frame' } },
            ],
        });

        const [a, bin, frame] = root.children;
        assert.equal(a.label, 'a');
        assert.equal(a.parent, root);
        assert.equal(bin.child.label, 'in bin');
        assert.equal(frame.children[0].label, 'in frame');
        assert.deepEqual(builder.objects, [root]);
    });

    test('builds nested objects in property values', () => {
        const widget = new Builder().buildOne({
            type: 'test-widget',
            adjustment: { type: 'test-adjustment', value: 5 },
            options: { list: [{ type: 'test-adjustment' }, 3], nested: { flag: true } },
        });

        assert.ok(widget.adjustment instanceof TestAdjustment);
        assert.equal(widget.adjustment.value, 5);
        assert.ok(widget.options.list[0] instanceof TestAdjustment);
        assert.equal(widget.options.list[1], 3);
        assert.deepEqual(widget.options.nested, { flag: true });
    });

    test('resolves references, also to objects built later', () => {
        const builder = new Builder();
        const [first, second] = builder.build([
            { type: 'test-widget', id: 'first', buddy: { id: 'second' } },
            {
                type: 'test-container',
                id: 'second',
                children: [{ type: 'test-widget', buddy: { id: 'second' } }],
            },
        ]);

        assert.equal(first.buddy, second);
        assert.equal(second.children[0].buddy, second);
        assert.equal(builder.hasObject('first'), true);
        assert.equal(builder.hasObject('third'), false);
        assert.throws(() => builder.getObjectById('third'), /could not be found/);

        // References also work across builds, and plain objects with more keys are values.
        const later = builder.buildOne({
            type: 'test-widget',
            buddy: { id: 'first' },
            options: { id: 'x', name: 'y' },
        });
        assert.equal(later.buddy, first);
        assert.deepEqual(later.options, { id: 'x', name: 'y' });
    });

    test('connects handlers with the object as this', () => {
        const calls = [];
        const scope = {
            onLabel() {
                calls.push(['scope', this.label]);
            },
        };

        const widget = new Builder({ scope }).buildOne({
            type: 'test-widget',
            handlers: {
                'label-change'() {
                    calls.push(['function', this.label]);
                },
            },
        });
        const named = new Builder({ scope }).buildOne(
            JSON.stringify({ type: 'test-widget', handlers: { 'label-change': 'onLabel' } })
        );

        widget.label = 'x';
        named.label = 'y';

        assert.deepEqual(calls, [
            ['function', 'x'],
            ['scope', 'y'],
        ]);
    });

    test('applies builder properties of the class hierarchy, own classes first', () => {
        const grid = new Builder().buildOne({
            type: 'test-grid',
            label: 'grid',
            children: [{ type: 'test-widget', row: 1, column: 2 }],
        });
        assert.deepEqual(grid.children[0].addArguments, [1, 2]);

        const special = new Builder().buildOne({
            type: 'test-special-grid',
            children: [{ type: 'test-widget' }],
        });
        assert.deepEqual(special.children[0].addArguments, ['special']);
    });

    test('applies builder properties after normal properties, in input order', () => {
        const order = [];

        class Ordered extends TestWidget {}
        Ordered.builderProperties = {
            second(_builder, instance) {
                order.push(['second', instance.label]);
            },
            first(_builder, instance, value) {
                order.push(['first', value]);
            },
        };
        registerType('test-ordered', Ordered);

        new Builder().buildOne({
            type: 'test-ordered',
            first: { raw: true },
            second: 1,
            label: 'set',
        });

        assert.deepEqual(order, [
            ['first', { raw: true }],
            ['second', 'set'],
        ]);
    });

    test('uses factories with built camelCase properties', () => {
        const builder = new Builder();
        const matrix = builder.buildOne({
            type: 'test-matrix',
            id: 'matrix',
            'first-value': { type: 'test-adjustment', value: 2 },
            b: 3,
        });

        assert.ok(matrix instanceof TestMatrix);
        assert.equal(matrix.a.value, 2);
        assert.equal(matrix.b, 3);
        assert.equal(builder.getObjectById('matrix'), matrix);

        assert.throws(
            () => builder.build({ type: 'test-matrix', b: { id: 'later' } }),
            /'later' could not be found/
        );
    });

    test('assigns properties of plain classes and passes existing instances through', () => {
        const plain = new Builder().buildOne({ type: 'test-plain', anything: 1 });
        assert.ok(plain instanceof TestPlain);
        assert.equal(plain.anything, 1);

        const existing = new TestWidget();
        const container = new Builder().buildOne({ type: 'test-container', children: [existing] });
        assert.equal(container.children[0], existing);
    });

    test('reports errors with the path of the offending object', () => {
        const builder = new Builder();
        const input = {
            type: 'test-container',
            children: [
                { type: 'test-widget' },
                { type: 'test-bin', id: 'bin', child: { type: 'test-widget', color: 'red' } },
            ],
        };

        assert.throws(
            () => builder.build(input),
            (error) =>
                error instanceof BuilderError &&
                error.message ===
                    "(test-container).children[1](test-bin #bin).child(test-widget): 'test-widget' has no property named 'color'."
        );

        // The ids of a failed build are forgotten.
        assert.equal(builder.hasObject('bin'), false);
        assert.equal(builder.objects.length, 0);

        assert.throws(() => builder.build({ type: 'nothing' }), /Unknown type 'nothing'/);
        assert.throws(
            () => builder.build([{ type: 'test-widget' }, 5]),
            /^BuilderError: \[1\]: Malformed/
        );
        assert.throws(() => builder.build({ label: 'x' }), /has no type/);
        assert.throws(() => builder.build('{ bad json'), /Invalid JSON/);
        assert.throws(() => builder.build({ type: 'test-widget', kind: 'x' }), /read-only/);
        assert.throws(
            () => builder.build({ type: 'test-widget', id: 5 }),
            /id of a 'test-widget' must be a string/
        );
        assert.throws(
            () => builder.build({ type: 'test-widget', buddy: { id: 'ghost' } }),
            /\.buddy: Object with id 'ghost'/
        );
        assert.throws(
            () => builder.build({ type: 'test-widget', handlers: { x: 5 } }),
            /handlers: The handler of 'x'/
        );
        assert.throws(
            () => builder.build({ type: 'test-widget', handlers: { x: 'missing' } }),
            /not in the scope/
        );
        assert.throws(
            () => builder.build({ type: 'test-container', children: {} }),
            /Children must be an array/
        );
        assert.throws(() => builder.buildOne([]), /Expected one object/);

        builder.build({ type: 'test-widget', id: 'once' });
        assert.throws(
            () => builder.build({ type: 'test-widget', id: 'once' }),
            /Duplicate id 'once'/
        );
    });

    test('wraps errors thrown by setters and hooks', () => {
        class Failing extends TestWidget {}
        defineProperties(Failing, {
            label: {
                set() {
                    throw new Error('no labels');
                },
            },
        });
        registerType('test-failing', Failing);

        assert.throws(
            () =>
                new Builder().build({
                    type: 'test-container',
                    children: [{ type: 'test-failing', label: 'x' }],
                }),
            (error) =>
                error instanceof BuilderError &&
                /children\[0\]\(test-failing\): no labels/.test(error.message) &&
                error.cause.message === 'no labels'
        );
    });

    test('works with the builder properties of ButtonGroup', () => {
        class TestToggle extends Instance {}
        defineProperties(TestToggle, {
            active: { value: false },
            group: {
                value: null,
                set(group) {
                    const old = this._group;
                    this._group = group;

                    if (old && old.buttons.includes(this)) {
                        old.removeButton(this);
                    }

                    if (group && !group.buttons.includes(this)) {
                        group.addButton(this);
                    }
                },
            },
        });
        registerType('test-toggle', TestToggle);

        const builder = new Builder();
        const [existing, group] = builder.build([
            { type: 'test-toggle', id: 'existing' },
            {
                type: 'button-group',
                buttons: [{ type: 'test-toggle', active: true }, { id: 'existing' }],
            },
        ]);

        assert.ok(group instanceof ButtonGroup);
        assert.equal(group.buttonsCount, 2);
        assert.equal(group.active, group.buttons[0]);
        assert.equal(existing.group, group);
        assert.equal(builder.objects.length, 2);
    });

    test('has a build function', () => {
        assert.ok(build({ type: 'test-widget' })[0] instanceof TestWidget);
    });
});
