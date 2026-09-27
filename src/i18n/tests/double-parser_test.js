// Tests of the locale-aware floating-point number parser.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { DoubleParser, parseDouble } from '../double-parser.js';

describe('DoubleParser', () => {
    test('parses numbers with the separators of the locale', () => {
        const english = new DoubleParser({ locale: 'en-US' });

        assert.equal(english.parse('1,234.5'), 1234.5);
        assert.equal(english.parse('1234.5'), 1234.5);
        assert.equal(english.parse('.5'), 0.5);
        assert.equal(english.parse('5.'), 5);
        assert.equal(english.parse('-1.5e-3'), -0.0015);
        assert.equal(english.parse('+2E10'), 2e10);

        const dutch = new DoubleParser({ locale: 'nl-NL' });
        assert.equal(dutch.parse('1.234,5'), 1234.5);
        assert.equal(dutch.parse('\u{2212}1.234,5'), -1234.5);
        assert.equal(dutch.parse(',25'), 0.25);

        const french = new DoubleParser({ locale: 'fr-FR' });
        assert.equal(french.parse('1\u{202f}234,5'), 1234.5);
        assert.equal(french.parse('1\u{a0}234,5'), 1234.5);

        assert.equal(new DoubleParser({ locale: 'de-CH' }).parse('1\u{2019}234.5'), 1234.5);
        assert.equal(new DoubleParser({ locale: 'ar-EG' }).parse('\u{661}\u{66b}\u{665}'), 1.5);
    });

    test('rejects what is not a number', () => {
        const parser = new DoubleParser({ locale: 'en-US' });

        for (const input of [
            '',
            '.',
            '-',
            '1.2.3',
            '1,23.4',
            '12,34.5',
            'e5',
            '1e',
            '1e+',
            'abc',
            '1..2',
            '1e400',
            'Infinity',
        ]) {
            assert.equal(parser.parse(input), null, input);
        }
    });

    test('swaps the separators in lenient mode, like the original toolkit', () => {
        const english = new DoubleParser({ locale: 'en-US' });
        assert.equal(english.parse('1,5'), 1.5);
        assert.equal(english.parse('1.234,5'), 1234.5);

        // The locale's reading wins when both are possible.
        assert.equal(english.parse('1,500'), 1500);
        assert.equal(new DoubleParser({ locale: 'nl-NL' }).parse('1,500'), 1.5);
        assert.equal(new DoubleParser({ locale: 'nl-NL' }).parse('1.5'), 1.5);

        const strict = new DoubleParser({ locale: 'en-US', lenient: false });
        assert.equal(strict.parse('1,5'), null);
        assert.equal(strict.parse('1.5'), 1.5);
        assert.equal(new DoubleParser({ locale: 'fr-FR', lenient: false }).parse('1.5'), null);
    });

    test('normalizes to canonical notation', () => {
        const parser = new DoubleParser({ locale: 'nl-NL' });

        assert.equal(parser.normalize('1.234,50'), '1234.50');
        assert.equal(parser.normalize('x'), null);
    });

    test('provides a convenience function', () => {
        assert.equal(parseDouble('2.5'), 2.5);
    });
});
