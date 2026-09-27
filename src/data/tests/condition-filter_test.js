// Tests of the condition filter.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ConditionFilter, ConditionOperator } from '../filters/condition-filter.js';

const ROW = {
    name: 'Northwind Gold Tea',
    price: 12.5,
    count: 5,
    date: new Date(2013, 8, 19),
    empty: null,
};

function passes(properties, row = ROW) {
    return new ConditionFilter(properties).isVisibleRow(row);
}

describe('ConditionFilter', () => {
    test('compares for equality, with numbers equal to their text', () => {
        assert.equal(passes({ operator: ConditionOperator.EQUALS, value: '5' }), true);
        assert.equal(
            passes({ operator: ConditionOperator.EQUALS, value: 6, columns: ['count'] }),
            false
        );
        assert.equal(
            passes({ operator: ConditionOperator.EQUALS, value: new Date(2013, 8, 19) }),
            true
        );
        assert.equal(passes({ operator: ConditionOperator.NOT_EQUALS, value: 5 }), false);
        assert.equal(passes({ operator: ConditionOperator.NOT_EQUALS, value: 6 }), true);
    });

    test('checks text', () => {
        assert.equal(passes({ value: 'Gold' }), true);
        assert.equal(passes({ value: 'gold' }), false);
        assert.equal(passes({ value: 'gold', caseSensitive: false }), true);
        assert.equal(passes({ operator: ConditionOperator.STARTS_WITH, value: 'North' }), true);
        assert.equal(
            passes({ operator: ConditionOperator.ENDS_WITH, value: 'Tea', columns: ['name'] }),
            true
        );
        assert.equal(passes({ operator: ConditionOperator.MATCHES, value: /gold\s+t/i }), true);
        assert.equal(passes({ operator: ConditionOperator.MATCHES, value: '^\\d+\\.5$' }), true);
    });

    test('orders numbers and dates only', () => {
        assert.equal(
            passes({ operator: ConditionOperator.GREATER_THAN, value: 12, columns: ['price'] }),
            true
        );
        assert.equal(
            passes({ operator: ConditionOperator.LESS_THAN, value: 12, columns: ['price'] }),
            false
        );
        assert.equal(
            passes({ operator: ConditionOperator.LESS_THAN_EQUAL, value: 5, columns: ['count'] }),
            true
        );
        assert.equal(
            passes({
                operator: ConditionOperator.GREATER_THAN_EQUAL,
                value: new Date(2013, 0, 1),
                columns: ['date'],
            }),
            true
        );
        assert.equal(
            passes({ operator: ConditionOperator.GREATER_THAN, value: 'A', columns: ['name'] }),
            false
        );
    });

    test('emits change when a property changes, and validates the operator', () => {
        const filter = new ConditionFilter();
        let changes = 0;
        filter.connect('change', () => (changes += 1));

        filter.value = 'x';
        filter.columns = ['name'];
        filter.operator = ConditionOperator.EQUALS;

        assert.equal(changes, 3);
        assert.throws(() => (filter.operator = 99), RangeError);

        // The operators are strings; the old numbers are rejected.
        filter.operator = 'starts-with';
        assert.equal(filter.operator, ConditionOperator.STARTS_WITH);
        assert.throws(() => (filter.operator = 1), RangeError);
        assert.throws(() => (filter.columns = 'name'), TypeError);
    });
});
