// Tests of the locale manager.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { LocaleManagerClass } from '../locale-manager.js';

describe('LocaleManager', () => {
    test('derives names and separators from the locale', () => {
        const manager = new LocaleManagerClass({ locale: 'nl_NL' });

        assert.equal(manager.locale, 'nl-NL');
        assert.equal(manager.language, 'nl');
        assert.equal(manager.country, 'NL');
        assert.equal(manager.longMonthNames[2], 'maart');
        assert.equal(manager.decimalSeparator, ',');
        assert.equal(manager.firstDayOfWeek, 1);
    });

    test('has the Gregorian month names in locales with another calendar', () => {
        const gregorian = (locale, month) =>
            new Intl.DateTimeFormat(locale, {
                month: 'long',
                timeZone: 'UTC',
                calendar: 'gregory',
            }).format(Date.UTC(2021, month, 1));

        for (const locale of ['fa-IR', 'ar-SA', 'th-TH']) {
            const manager = new LocaleManagerClass({ locale });

            assert.equal(manager.longMonthNames[1], gregorian(locale, 1), locale);
            assert.equal(manager.longMonthNames[9], gregorian(locale, 9), locale);
        }
    });

    test('takes the country from the region, not the script', () => {
        const manager = new LocaleManagerClass({ locale: 'zh-Hant-TW' });
        assert.deepEqual([manager.language, manager.country], ['zh', 'TW']);

        manager.locale = 'sr-Latn';
        assert.deepEqual([manager.language, manager.country], ['sr', '']);

        manager.locale = 'es-419';
        assert.deepEqual([manager.language, manager.country], ['es', '419']);
    });

    test('emits language-change only when the language changes', () => {
        const manager = new LocaleManagerClass({ locale: 'en-US' });
        const events = [];
        manager.connect('language-change', () => events.push('language'));
        manager.connect('locale-change', () => events.push('locale'));

        manager.locale = 'en-GB';
        manager.locale = 'de-DE';

        assert.deepEqual(events, ['locale', 'language', 'locale']);
        assert.equal(manager.shortDayNames[0], 'So');
        assert.equal(new LocaleManagerClass({ locale: 'en-US' }).firstDayOfWeek, 0);
    });
});

describe('LocaleManager additions', () => {
    test('derives AM and PM designators from the locale', () => {
        const manager = new LocaleManagerClass({ locale: 'en-US' });
        assert.deepEqual([manager.amDesignator, manager.pmDesignator], ['AM', 'PM']);

        manager.locale = 'nl-NL';
        assert.deepEqual([manager.amDesignator, manager.pmDesignator], ['a.m.', 'p.m.']);

        manager.locale = 'ko-KR';
        assert.deepEqual([manager.amDesignator, manager.pmDesignator], ['오전', '오후']);
    });

    test('has a validated time zone that does not change with the locale', () => {
        const manager = new LocaleManagerClass({ locale: 'en-US' });
        assert.equal(manager.timeZone, 'local');

        manager.timeZone = 'UTC';
        assert.equal(manager.timeZone, 'UTC');

        manager.timeZone = 'Europe/Amsterdam';
        manager.locale = 'de-DE';
        assert.equal(manager.timeZone, 'Europe/Amsterdam');

        manager.timeZone = 'local';
        assert.equal(manager.timeZone, 'local');

        assert.throws(() => (manager.timeZone = 'Atlantis/Capital'), RangeError);
        assert.throws(() => (manager.timeZone = null), TypeError);
    });
});
