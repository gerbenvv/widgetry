// Tests of the date-time parser.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { DateTimeParser, parseDate } from '../date-time-parser.js';
import { LocaleManagerClass } from '../locale-manager.js';

/**
 * The reference time of the tests: Wednesday, August 14, 2013, 10:30 UTC.
 *
 * @type {number}
 */
const NOW = Date.UTC(2013, 7, 14, 10, 30);

function createParser(locale, properties = {}) {
    return new DateTimeParser({ locale, referenceTime: NOW, timeZone: 'UTC', ...properties });
}

function iso(date) {
    return date === null ? null : date.toISOString().slice(0, 10);
}

function checkDates(parser, cases) {
    for (const [input, expected] of Object.entries(cases)) {
        assert.equal(iso(parser.parseDate(input)), expected, input);
    }
}

describe('DateTimeParser', () => {
    test('parses numeric dates in the order of the locale', () => {
        checkDates(createParser('en-US'), {
            '8/10/2013': '2013-08-10',
            '08-10-2013': '2013-08-10',
            "8/10/'13": '2013-08-10',
            '8/10/13': '2013-08-10',
            '8/10/30': '1930-08-10',
            '8/10': '2013-08-10',
            '2013-08-10': '2013-08-10',
            '2013/8/10': '2013-08-10',
            15: '2013-08-15',
            1990: '1990-01-01',
        });

        checkDates(createParser('en-GB'), { '10/8/2013': '2013-08-10', '10/8': '2013-08-10' });
        checkDates(createParser('nl-NL'), { '10-8-2013': '2013-08-10', '10-08-13': '2013-08-10' });
        checkDates(createParser('de-DE'), { '10.08.2013': '2013-08-10', '10.8.13': '2013-08-10' });
        checkDates(createParser('ja-JP'), { '2013/08/10': '2013-08-10', '13/8/10': '2013-08-10' });
    });

    test('parses dates with month and day names', () => {
        checkDates(createParser('en-US'), {
            'August 10, 2013': '2013-08-10',
            'aug 10 2013': '2013-08-10',
            '10 aug 2013': '2013-08-10',
            '10th of August': '2013-08-10',
            'Aug. 1st, 2013': '2013-08-01',
            'Saturday, August 10, 2013': '2013-08-10',
            'sat aug 10 2013': '2013-08-10',
            'sept 3 2013': '2013-09-03',
            'August 2013': '2013-08-01',
        });

        checkDates(createParser('nl-NL'), {
            '10 augustus 2013': '2013-08-10',
            '10 aug. 2013': '2013-08-10',
            '10 mrt 2013': '2013-03-10',
            'zaterdag 10 augustus 2013': '2013-08-10',
            '1ste mei 2013': '2013-05-01',
        });

        checkDates(createParser('de-DE'), {
            '10. März 2013': '2013-03-10',
            '10. Maerz 2013': null,
        });
        checkDates(createParser('fr-FR'), {
            '1er août 2013': '2013-08-01',
            '10 aout 2013': '2013-08-10',
        });
        checkDates(createParser('es-ES'), { '10 de agosto de 2013': '2013-08-10' });
        checkDates(createParser('ru-RU'), {
            '10 августа 2013 г.': '2013-08-10',
            '10 авг. 2013': '2013-08-10',
        });
        checkDates(createParser('ja-JP'), { '2013年8月10日': '2013-08-10' });
        checkDates(createParser('zh-CN'), { '2013年8月10日': '2013-08-10' });
        checkDates(createParser('ko-KR'), { '2013년 8월 10일': '2013-08-10' });
    });

    test('parses relative dates', () => {
        checkDates(createParser('en-US'), {
            today: '2013-08-14',
            'the present day': '2013-08-14',
            yesterday: '2013-08-13',
            'the day before yesterday': '2013-08-12',
            tomorrow: '2013-08-15',
            tommorow: '2013-08-15',
            'the day after tomorrow': '2013-08-16',
            'next day': '2013-08-15',
            'past day': '2013-08-13',
            'next month': '2013-09-01',
            'last month': '2013-07-01',
            'this month': '2013-08-01',
            'next year': '2014-01-01',
            'the past year': '2012-01-01',
            'this week': '2013-08-11',
            'next week': '2013-08-18',
            '3 days ago': '2013-08-11',
            '1 day ago': '2013-08-13',
            'in 2 weeks': '2013-08-28',
            '2 months from now': '2013-10-14',
            'in 1 year': '2014-08-14',
            friday: '2013-08-16',
            'next friday': '2013-08-16',
            'last friday': '2013-08-09',
            wednesday: '2013-08-21',
            'last wednesday': '2013-08-07',
            august: '2014-08-01',
            september: '2013-09-01',
            'next august': '2014-08-01',
            'past august': '2012-08-01',
            'past july': '2013-07-01',
        });

        checkDates(createParser('nl-NL'), {
            vandaag: '2013-08-14',
            gisteren: '2013-08-13',
            eergisteren: '2013-08-12',
            morgen: '2013-08-15',
            overmorgen: '2013-08-16',
            'volgende week': '2013-08-19',
            'vorige maand': '2013-07-01',
            'over 3 dagen': '2013-08-17',
            '3 dagen geleden': '2013-08-11',
            vrijdag: '2013-08-16',
        });

        checkDates(createParser('de-DE'), {
            'vor 3 Tagen': '2013-08-11',
            übermorgen: '2013-08-16',
        });
        checkDates(createParser('es-ES'), { mañana: '2013-08-15', ayer: '2013-08-13' });
        checkDates(createParser('fr-FR'), {
            demain: '2013-08-15',
            'dans 2 semaines': '2013-08-28',
        });
    });

    test('clamps relative months to the end of the month', () => {
        const parser = createParser('en-US', { referenceTime: Date.UTC(2013, 0, 31) });

        checkDates(parser, { 'in 1 month': '2013-02-28', '1 month ago': '2012-12-31' });
    });

    test('returns the current time for now', () => {
        const parser = createParser('en-US');

        assert.equal(parser.parseDate('now').getTime(), NOW);
        assert.equal(createParser('nl-NL').parseDateTime('nu').getTime(), NOW);
    });

    test('rejects invalid dates', () => {
        checkDates(createParser('en-US'), {
            '': null,
            '   ': null,
            blah: null,
            '2/30/2013': null,
            '13/1/2013': null,
            '2013-02-29': null,
            '2012-02-29': '2012-02-29',
            '0/10/2013': null,
            'aug 10 2013 x': null,
            'Friday, August 10, 2013': null,
            'aug sep 2013': null,
            '1/2/3/4': null,
            123456: null,
            'next blah': null,
            '10 11 12 13': null,
            '3 lightyears ago': null,
        });

        assert.throws(() => createParser('en-US').parseDate(20130810), TypeError);
    });

    test('parses times', () => {
        const parser = createParser('en-US');
        const time = (hours, minutes, seconds = 0, milliseconds = 0) =>
            ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds;

        const cases = {
            '14:05': time(14, 5),
            '14:05:09': time(14, 5, 9),
            '14:05:09.042': time(14, 5, 9, 42),
            '14:05:09.5': time(14, 5, 9, 500),
            '2:05 pm': time(14, 5),
            '2:05PM': time(14, 5),
            '2 PM': time(14, 0),
            '12 am': time(0, 0),
            '12:30 p.m.': time(12, 30),
            '12:30 a.m.': time(0, 30),
            '14h05': time(14, 5),
            '14h': time(14, 0),
            14.05: time(14, 5),
            noon: time(12, 0),
            midnight: 0,
            now: time(10, 30),
            '0:00': 0,
            '23:59:59': time(23, 59, 59),
        };

        for (const [input, expected] of Object.entries(cases)) {
            assert.equal(parser.parseTime(input), expected, input);
        }

        for (const input of [
            '25:00',
            '24:00',
            '13 pm',
            '0 am',
            '14',
            '2:65',
            '2:5',
            '12:00:60',
            'pm',
            'am 2 pm',
            'x',
        ]) {
            assert.equal(parser.parseTime(input), null, input);
        }

        assert.equal(createParser('nl-NL').parseTime('2:05 p.m.'), time(14, 5));
        assert.equal(createParser('ko-KR').parseTime('오후 2:05'), time(14, 5));
        assert.equal(createParser('zh-CN').parseTime('下午2:05'), time(14, 5));
    });

    test('parses dates with times', () => {
        const parser = createParser('en-US');
        const check = (input, expected) => {
            const date = parser.parseDateTime(input);
            assert.equal(date === null ? null : date.toISOString(), expected, input);
        };

        check('aug 10 2013 14:05', '2013-08-10T14:05:00.000Z');
        check('8/10/2013 2:05 PM', '2013-08-10T14:05:00.000Z');
        check('August 10, 2013 at 2:05 PM', '2013-08-10T14:05:00.000Z');
        check('2 pm tomorrow', '2013-08-15T14:00:00.000Z');
        check('tomorrow 14:00', '2013-08-15T14:00:00.000Z');
        check('14:30', '2013-08-14T14:30:00.000Z');
        check('tomorrow', '2013-08-15T00:00:00.000Z');
        check('2013-08-10T14:05:09Z', '2013-08-10T14:05:09.000Z');
        check('2013-08-10T14:05:09.5+02:00', '2013-08-10T12:05:09.500Z');
        check('2013-08-10 14:05', '2013-08-10T14:05:00.000Z');
        check('2013-08-10T25:05', null);
        check('garbage 14:00', null);
        check('aug 10 2013 25:00', null);

        const dutch = createParser('nl-NL');
        assert.equal(
            dutch.parseDateTime('morgen om 14:30').toISOString(),
            '2013-08-15T14:30:00.000Z'
        );
        assert.equal(
            dutch.parseDateTime('10 aug 2013 14:05').toISOString(),
            '2013-08-10T14:05:00.000Z'
        );
    });

    test('parses in time zones, also around daylight saving changes', () => {
        const parser = createParser('nl-NL', { timeZone: 'Europe/Amsterdam' });

        assert.equal(parser.parseDate('10-8-2013').toISOString(), '2013-08-09T22:00:00.000Z');
        assert.equal(parser.parseDate('10-1-2013').toISOString(), '2013-01-09T23:00:00.000Z');
        assert.equal(
            parser.parseDateTime('31-3-2013 12:00').toISOString(),
            '2013-03-31T10:00:00.000Z'
        );
        assert.equal(
            parser.parseDateTime('31-3-2013 01:30').toISOString(),
            '2013-03-31T00:30:00.000Z'
        );

        // 2:30 does not exist on that day and moves forward by the hour of the gap.
        assert.equal(
            parser.parseDateTime('31-3-2013 02:30').toISOString(),
            '2013-03-31T01:30:00.000Z'
        );

        // An ISO time with an offset ignores the time zone.
        assert.equal(
            parser.parseDateTime('2013-08-10T14:05Z').toISOString(),
            '2013-08-10T14:05:00.000Z'
        );

        const manager = new LocaleManagerClass({ locale: 'en-US' });
        manager.timeZone = 'America/New_York';
        const following = new DateTimeParser({ localeManager: manager });
        assert.equal(following.parseDate('1/2/2013').toISOString(), '2013-01-02T05:00:00.000Z');
    });

    test('parses exact formats', () => {
        const parser = createParser('en-US');
        const check = (input, format, expected) => {
            const date = parser.parseExact(input, format);
            assert.equal(date === null ? null : date.toISOString(), expected, `${input} ${format}`);
        };

        check('10-08-2013', '%d-%m-%Y', '2013-08-10T00:00:00.000Z');
        check('10-8-2013', '%d-%m-%Y', '2013-08-10T00:00:00.000Z');
        check('Sat Aug 10 2013', '%a %b %d %Y', '2013-08-10T00:00:00.000Z');
        check('Saturday, August 10, 2013', '%A, %B %-d, %Y', '2013-08-10T00:00:00.000Z');
        check('Fri Aug 10 2013', '%a %b %d %Y', null);
        check('14:05', '%H:%M', '2013-08-14T14:05:00.000Z');
        check('2:05:09 PM', '%r', '2013-08-14T14:05:09.000Z');
        check('13:05:09 PM', '%r', null);
        check('2013-08-10 14:05 +0200', '%F %H:%M %z', '2013-08-10T12:05:00.000Z');
        check('2013-08-10 14:05:09.042', '%F %T.%L', '2013-08-10T14:05:09.042Z');
        check('1376143509', '%s', '2013-08-10T14:05:09.000Z');
        check('222 2013', '%j %Y', '2013-08-10T00:00:00.000Z');
        check('08/10/13', '%D', '2013-08-10T00:00:00.000Z');
        check('2013', '%Y', '2013-01-01T00:00:00.000Z');
        check('100% 2013', '100%% %Y', '2013-01-01T00:00:00.000Z');
        check('31-02-2013', '%d-%m-%Y', null);
        check('10-08-2013 extra', '%d-%m-%Y', null);
        check('aug 10, 2013', '%c', '2013-08-10T00:00:00.000Z');
        check('aug 10, 2013 2:05 PM', '%x', '2013-08-10T14:05:00.000Z');
        check('2:05 PM', '%X', '2013-08-14T14:05:00.000Z');

        assert.equal(
            createParser('nl-NL').parseExact('10 augustus 2013', '%e %B %Y').toISOString(),
            '2013-08-10T00:00:00.000Z'
        );

        assert.throws(() => parser.parseExact('x', '%c %H'), /can only be used alone/);
        assert.throws(() => parser.parseExact('x', 5), TypeError);
    });

    test('parses what Intl formats in many locales', () => {
        const locales = ['en-US', 'nl-NL', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'pt-PT', 'it-IT'];
        locales.push('uk-UA', 'ru-RU', 'th-TH', 'hi-IN', 'ja-JP', 'zh-CN', 'ko-KR', 'ar-EG');
        locales.push(
            'fa-IR',
            'he-IL',
            'ca-ES',
            'fi-FI',
            'cs-CZ',
            'el-GR',
            'hu-HU',
            'bg-BG',
            'fr-CA',
            'pl-PL',
            'lt-LT',
            'vi-VN',
            'bn-BD'
        );

        for (const locale of locales) {
            for (const timeZone of ['UTC', 'Europe/Amsterdam', 'Asia/Kolkata']) {
                const parser = createParser(locale, { timeZone });
                const options = { timeZone, calendar: 'gregory' };

                for (const time of [Date.UTC(2013, 7, 10, 14, 5), Date.UTC(2024, 1, 29, 23, 59)]) {
                    const midnight = parser.parseExact(
                        new Intl.DateTimeFormat('en-CA', options).format(time),
                        '%Y-%m-%d'
                    );

                    for (const dateStyle of ['short', 'medium', 'long', 'full']) {
                        const text = new Intl.DateTimeFormat(locale, { ...options, dateStyle });
                        const date = parser.parseDate(text.format(time));
                        assert.equal(date?.getTime(), midnight.getTime(), text.format(time));
                    }

                    const text = new Intl.DateTimeFormat(locale, {
                        ...options,
                        timeStyle: 'short',
                    }).format(time);
                    const [hours, minutes] = new Intl.DateTimeFormat('en-GB', {
                        ...options,
                        timeStyle: 'short',
                    })
                        .format(time)
                        .split(':');

                    assert.equal(parser.parseTime(text), (hours * 60 + +minutes) * 60000, text);
                }
            }
        }
    });

    test('parses day periods with periods in exact formats', () => {
        for (const locale of ['fi-FI', 'cs-CZ', 'el-GR', 'hu-HU', 'nl-NL']) {
            const manager = new LocaleManagerClass({ locale });
            const parser = createParser(locale);
            const text = `10/08/2013 02:05 ${manager.pmDesignator}`;

            assert.equal(
                parser.parseExact(text, '%d/%m/%Y %I:%M %p')?.toISOString(),
                '2013-08-10T14:05:00.000Z',
                text
            );
        }
    });

    test('validates its properties', () => {
        assert.throws(() => createParser('en-US', { twoDigitYearMax: 100 }), RangeError);
        assert.throws(() => createParser('en-US', { referenceTime: 'now' }), TypeError);
        assert.throws(() => createParser('en-US', { timeZone: 'Nowhere/Land' }), RangeError);

        const parser = createParser('en-US', { twoDigitYearMax: 50, referenceTime: new Date(NOW) });
        assert.equal(iso(parser.parseDate('1/1/50')), '2050-01-01');
        assert.equal(iso(parser.parseDate('1/1/51')), '1951-01-01');
    });

    test('provides convenience functions, which parse in local time by default', () => {
        const date = parseDate('2013-08-10');

        assert.deepEqual(
            [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()],
            [2013, 7, 10, 0]
        );
    });
});
