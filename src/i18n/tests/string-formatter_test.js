// Tests of the printf-like string formatter.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getLocaleManager, LocaleManagerClass } from '../locale-manager.js';
import { formatNumber, formatString, StringFormatter } from '../string-formatter.js';

describe('StringFormatter', () => {
    const formatter = new StringFormatter({ locale: 'en-US' });

    test('replaces placeholders in order and by number', () => {
        assert.equal(formatter.format('%s has %d messages.', 'Anna', 3), 'Anna has 3 messages.');
        assert.equal(formatter.format('%2$s, %1$s!', 'world', 'Hello'), 'Hello, world!');
        assert.equal(formatter.format('%1$s %1$s %s', 'a', 'b'), 'a a a');
        assert.equal(formatter.format('no placeholders'), 'no placeholders');
        assert.equal(formatter.format(''), '');
    });

    test('formats integers', () => {
        assert.equal(formatter.format('%d', 3.7), '3');
        assert.equal(formatter.format('%d', -3.7), '-3');
        assert.equal(formatter.format('%d', '42abc'), '42');
        assert.equal(formatter.format('%d', 12345678901234567890n), '12345678901234567890');
        assert.equal(formatter.format('%u', -5), '5');
        assert.equal(formatter.format('%b %o %x %X', 5, 8, 255, 255), '101 10 ff FF');
        assert.equal(formatter.format('%c%c', 72, 0x1f600), 'H\u{1f600}');
        assert.equal(formatter.format('%d', 'abc'), 'NaN');
    });

    test('formats floating-point numbers', () => {
        assert.equal(formatter.format('%f', 1.5), '1.5');
        assert.equal(formatter.format('%.2f', 3.14159), '3.14');
        assert.equal(formatter.format('%.0f', 2.5), '3');
        assert.equal(formatter.format('%e', 12345), '1.2345e+4');
        assert.equal(formatter.format('%.2E', 12345), '1.23E+4');
        assert.equal(formatter.format('%g %g', 0.0001, 123), '1e-4 123');
        assert.equal(formatter.format('%.2G', 1234567), '1.23E+6');
    });

    test('formats F in the locale', () => {
        assert.equal(formatter.format('%.2F', 1234.5), '1,234.50');
        assert.equal(formatter.format('%F', 0.1), '0.1');
        assert.equal(formatter.format('%+.1F', 2), '+2.0');

        assert.equal(new StringFormatter({ locale: 'nl-NL' }).format('%.2F', 1234.5), '1.234,50');
        assert.equal(new StringFormatter({ locale: 'de-CH' }).format('%F', 1234.5), '1\u2019234.5');
        assert.equal(new StringFormatter({ locale: 'en-IN' }).format('%F', 1234567), '12,34,567');
    });

    test('uses separators overridden in the locale manager', () => {
        const manager = new LocaleManagerClass({ locale: 'en-US' });
        manager.groupSeparator = ' ';

        const custom = new StringFormatter({ localeManager: manager });

        assert.equal(custom.format('%.1F', 12345), '12 345.0');
        assert.equal(custom.formatNumber(1234567), '1 234 567');
    });

    test('pads, justifies and signs', () => {
        assert.equal(formatter.format('%5d|', 42), '   42|');
        assert.equal(formatter.format('%-5d|', 42), '42   |');
        assert.equal(formatter.format('%05d', 42), '00042');
        assert.equal(formatter.format('%05d', -42), '-0042');
        assert.equal(formatter.format('%+05d', 3), '+0003');
        assert.equal(formatter.format('%+d %+d', 3, -3), '+3 -3');
        assert.equal(formatter.format("%'*8s", 'ab'), '******ab');
        assert.equal(formatter.format("%-'.6s|", 'ab'), 'ab....|');
        assert.equal(formatter.format('%08.3f', -3.14159), '-003.142');
        assert.equal(formatter.format('%+s', 'x'), 'x');
        assert.equal(formatter.format('%3s', 'abcdef'), 'abcdef');
    });

    test('truncates strings to the precision', () => {
        assert.equal(formatter.format('%.3s', 'abcdef'), 'abc');
        assert.equal(formatter.format('%.1s', '\u{1f600}x'), '\u{1f600}');
    });

    test('handles percent signs', () => {
        assert.equal(formatter.format('100%%'), '100%');
        assert.equal(formatter.format('%d%%', 50), '50%');
        assert.equal(formatter.format('50%'), '50%');
        assert.equal(formatter.format('%y and %'), '%y and %');
    });

    test('rejects invalid arguments', () => {
        assert.throws(() => formatter.format('%s %s', 'a'), RangeError);
        assert.throws(() => formatter.format('%0$s', 'a'), RangeError);
        assert.throws(() => formatter.format('%3$s', 'a'), /Missing argument 3/);
        assert.throws(() => formatter.format(42), TypeError);
    });

    test('formats numbers with Intl options', () => {
        assert.equal(formatter.formatNumber(1234.5), '1,234.5');
        assert.equal(formatter.formatNumber(3, { decimals: 2 }), '3.00');
        assert.equal(formatter.formatNumber(0.25, { style: 'percent' }), '25%');
        assert.equal(new StringFormatter({ locale: 'fr-FR' }).formatNumber(1234.5), '1\u202f234,5');
        assert.throws(() => formatter.formatNumber('1'), TypeError);
        assert.throws(() => formatter.formatNumber(1, { decimals: -1 }), RangeError);
    });

    test('follows the locale of the singleton through the convenience functions', () => {
        const manager = getLocaleManager();
        const locale = manager.locale;

        try {
            manager.locale = 'en-US';
            assert.equal(formatString('%s-%s %.1F', 'a', 'b', 1000), 'a-b 1,000.0');
            assert.equal(formatNumber(1000), '1,000');

            manager.locale = 'de-DE';
            assert.equal(formatNumber(1000.5), '1.000,5');
        } finally {
            manager.locale = locale;
        }
    });
});
