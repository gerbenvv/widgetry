// Tests of the locale-aware integer parser.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { IntegerParser, parseInteger } from '../integer-parser.js';
import { LocaleManagerClass } from '../locale-manager.js';

describe('IntegerParser', () => {
    test('parses integers with the group separator of the locale', () => {
        const english = new IntegerParser({ locale: 'en-US' });

        assert.equal(english.parse('1234'), 1234);
        assert.equal(english.parse('1,234,567'), 1234567);
        assert.equal(english.parse(' +42 '), 42);
        assert.equal(english.parse('-12'), -12);
        assert.equal(english.parse('\u{2212}7'), -7);
        assert.equal(english.parse('1e3'), 1000);
        assert.equal(english.parse('1E+3'), 1000);
        assert.equal(english.parse('-0'), 0);
        assert.ok(Object.is(english.parse('-0'), 0));

        const dutch = new IntegerParser({ locale: 'nl-NL' });
        assert.equal(dutch.parse('1.234.567'), 1234567);

        const french = new IntegerParser({ locale: 'fr-FR' });
        assert.equal(french.parse('1\u{202f}234'), 1234);
        assert.equal(french.parse('1 234'), 1234);

        assert.equal(new IntegerParser({ locale: 'de-CH' }).parse("1'234"), 1234);
        assert.equal(new IntegerParser({ locale: 'en-IN' }).parse('12,34,567'), 1234567);
    });

    test('rejects what is not an integer', () => {
        const parser = new IntegerParser({ locale: 'en-US' });

        for (const input of [
            '',
            ' ',
            '12.5',
            '1,23',
            '1,2345',
            ',123',
            '12a',
            'a12',
            '1e-3',
            '--1',
            '+',

            'Infinity',
            'NaN',
            '0x10',
        ]) {
            assert.equal(parser.parse(input), null, input);
        }

        // Beyond the safe integer range.
        assert.equal(parser.parse('9007199254740993'), null);
        assert.equal(parser.parse('9007199254740991'), 9007199254740991);
        assert.throws(() => parser.parse(12), TypeError);
    });

    test('swaps the separators in lenient mode, like the original toolkit', () => {
        const lenient = new IntegerParser({ locale: 'en-US' });
        assert.equal(lenient.parse('1.234'), 1234);
        assert.equal(lenient.parse('1 000'), 1000);

        const strict = new IntegerParser({ locale: 'en-US', lenient: false });
        assert.equal(strict.parse('1.234'), null);
        assert.equal(strict.parse('1 000'), null);
        assert.equal(strict.parse('1,000'), 1000);
    });

    test('accepts other digit sets', () => {
        const parser = new IntegerParser({ locale: 'ar-EG' });

        assert.equal(parser.parse('\u{661}\u{662}\u{663}'), 123);
        assert.equal(parser.parse('\u{661}\u{66c}\u{662}\u{663}\u{664}'), 1234);
        assert.equal(new IntegerParser({ locale: 'en-US' }).parse('\u{ff11}\u{ff12}'), 12);
    });

    test('follows its locale manager', () => {
        const manager = new LocaleManagerClass({ locale: 'en-US' });
        const parser = new IntegerParser({ localeManager: manager, lenient: false });

        assert.equal(parser.parse('1,234'), 1234);

        manager.locale = 'de-DE';
        assert.equal(parser.parse('1.234'), 1234);
        assert.equal(parser.parse('1,234'), null);

        assert.equal(parser.effectiveLocale, 'de-DE');
        assert.equal(parser.isValid('1.234'), true);
        assert.equal(parser.normalize('-1.234'), '-1234');
    });

    test('provides a convenience function', () => {
        assert.equal(parseInteger('42'), 42);
        assert.equal(parseInteger('forty-two'), null);
    });
});
