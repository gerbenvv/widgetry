// Tests of the search filter.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getLocaleManager } from '../../i18n/locale-manager.js';
import { SearchFilter, toLowerCase } from '../filters/search-filter.js';

const ROW = { name: 'Café  Européen', category: 'Recepten - Europa', value: 12 };

describe('SearchFilter', () => {
    test('lower-cases with the rules of the locale', () => {
        const manager = getLocaleManager();
        const locale = manager.locale;
        const filter = new SearchFilter({ query: 'ı' });

        try {
            manager.locale = 'tr-TR';
            assert.equal(filter.isVisibleRow({ name: 'KIŞ' }), true);

            manager.locale = 'en-US';
            assert.equal(filter.isVisibleRow({ name: 'KIŞ' }), false);
        } finally {
            manager.locale = locale;
        }
    });

    test('exports the locale-aware lower-casing that tables use too', () => {
        const manager = getLocaleManager();
        const locale = manager.locale;

        try {
            manager.locale = 'tr-TR';
            assert.equal(toLowerCase('KIŞ'), 'kış');

            manager.locale = 'en-US';
            assert.equal(toLowerCase('KIŞ'), 'kiş');
        } finally {
            manager.locale = locale;
        }
    });

    test('lower-cases with the locale only for languages that need it, which is slow', () => {
        const manager = getLocaleManager();
        const locale = manager.locale;
        const filter = new SearchFilter({ query: 'x' });
        const original = String.prototype.toLocaleLowerCase;
        let calls = 0;

        // Locale-aware lower-casing of every value made filtering 100,000 rows take 250 ms.
        String.prototype.toLocaleLowerCase = function (...args) {
            ++calls;

            return original.apply(this, args);
        };

        try {
            manager.locale = 'en-US';
            filter.isVisibleRow({ name: 'Box' });
            assert.equal(calls, 0);

            manager.locale = 'lt-LT';
            filter.isVisibleRow({ name: 'Box' });
            assert.equal(calls, 1);
        } finally {
            String.prototype.toLocaleLowerCase = original;
            manager.locale = locale;
        }
    });

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
