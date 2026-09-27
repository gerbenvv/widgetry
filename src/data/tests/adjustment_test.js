// Tests of the adjustment.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Adjustment } from '../adjustment.js';

describe('Adjustment', () => {
    test('clamps the value to the range minus the page size', () => {
        const adjustment = new Adjustment({ lower: 0, upper: 100, pageSize: 10, value: 95 });

        assert.equal(adjustment.value, 90);
        assert.equal(adjustment.maximum, 90);

        adjustment.value = -5;
        assert.equal(adjustment.value, 0);
    });

    test('emits change once when setting several values', () => {
        const adjustment = new Adjustment();
        let changes = 0;
        adjustment.connect('change', () => (changes += 1));

        adjustment.set({ lower: 10, upper: 20, value: 15, stepIncrement: 2 });

        assert.equal(changes, 1);
        assert.equal(adjustment.value, 15);
    });

    test('keeps the value valid when the bounds change', () => {
        const adjustment = new Adjustment({ lower: 0, upper: 100, value: 80 });
        const values = [];
        adjustment.connect('value-change', () => values.push(adjustment.value));

        adjustment.upper = 50;
        adjustment.lower = 60;

        assert.equal(adjustment.upper, 60);
        assert.deepEqual(values, [50, 60]);
    });

    test('steps, pages and fractions', () => {
        const adjustment = new Adjustment({ upper: 100, stepIncrement: 5, pageIncrement: 20 });

        adjustment.increment();
        adjustment.incrementPage();
        assert.equal(adjustment.value, 25);

        adjustment.decrement();
        adjustment.decrementPage();
        assert.equal(adjustment.value, 0);

        adjustment.fraction = 0.5;
        assert.equal(adjustment.value, 50);
        assert.equal(adjustment.fraction, 0.5);
    });

    test('scrolls a range into view', () => {
        const adjustment = new Adjustment({ upper: 1000, pageSize: 100 });

        adjustment.clampPage(250, 300);
        assert.equal(adjustment.value, 200);

        adjustment.clampPage(120, 140);
        assert.equal(adjustment.value, 120);
    });
});
