// Tests of the locale-aware floating-point number parser.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { DoubleParser, parseDouble } from '../double-parser.js';
import { toLatinDigits } from '../number-parser.js';

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

    test('accepts the figure and en dashes as minus signs', () => {
        const parser = new DoubleParser({ locale: 'en-US' });

        assert.equal(parser.parse('\u{2012}1.5'), -1.5);
        assert.equal(parser.parse('\u{2013}1.5'), -1.5);
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

    test('parses what Intl formats, with bidirectional marks and any decimal digit set', () => {
        const locales = ['en-US', 'nl-NL', 'fr-FR', 'de-CH', 'ar-EG', 'fa-IR', 'he-IL', 'ur-PK'];

        for (const locale of [...locales, 'ps-AF', 'bn-BD', 'mr-IN', 'my-MM', 'th-TH-u-nu-thai']) {
            const parser = new DoubleParser({ locale });
            const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });

            for (const value of [0, 12, -5, -1234.5, 1234567.891, -0.25]) {
                assert.equal(parser.parse(format.format(value)), value, locale);
            }
        }
    });

    test('provides a convenience function', () => {
        assert.equal(parseDouble('2.5'), 2.5);
    });
});

describe('toLatinDigits', () => {
    test('converts the digits of every script and removes bidirectional marks', () => {
        assert.equal(toLatinDigits('\u{661}\u{662}\u{663}'), '123');
        assert.equal(toLatinDigits('\u{6f4}\u{6f5}'), '45');
        assert.equal(toLatinDigits('\u{966}\u{969}'), '03');
        assert.equal(toLatinDigits('\u{ff17}\u{ff19}'), '79');
        assert.equal(toLatinDigits('\u{200f}-\u{661}\u{200e}\u{61c}'), '-1');
        assert.equal(toLatinDigits('abc 12'), 'abc 12');
    });
});
