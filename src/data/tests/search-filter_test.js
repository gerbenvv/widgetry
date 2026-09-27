// Tests of the search filter.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { SearchFilter } from '../filters/search-filter.js';

const ROW = { name: 'Café  Européen', category: 'Recepten - Europa', value: 12 };

describe('SearchFilter', () => {
    test('requires every keyword in some column, ignoring case', () => {
        const filter = new SearchFilter();

        assert.equal(filter.isVisibleRow(ROW), true);

        filter.query = '  CAFÉ,  europa ';
        assert.deepEqual(filter.keywords, ['café', 'europa']);
        assert.equal(filter.isVisibleRow(ROW), true);

        filter.query = 'café stocks';
        assert.equal(filter.isVisibleRow(ROW), false);

        filter.query = '12';
        assert.equal(filter.isVisibleRow(ROW), true);
    });

    test('limits the search to columns and can ignore accents', () => {
        const filter = new SearchFilter({ query: 'cafe', columns: ['category'] });

        assert.equal(filter.isVisibleRow(ROW), false);

        filter.columns = ['name'];
        assert.equal(filter.isVisibleRow(ROW), false);

        filter.ignoreAccents = true;
        assert.equal(filter.isVisibleRow(ROW), true);
    });

    test('emits change', () => {
        const filter = new SearchFilter();
        let changes = 0;
        filter.connect('change', () => (changes += 1));

        filter.query = 'a';
        filter.query = 'a';
        filter.columns = null;

        assert.equal(changes, 1);
    });
});
