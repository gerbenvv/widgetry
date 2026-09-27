// Tests of the strftime-like date-time formatter.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    DateTimeFormatter,
    DateTimeStyle,
    formatDate,
    formatDateTimePattern,
    getIsoWeek,
} from '../date-time-formatter.js';
import { LocaleManagerClass } from '../locale-manager.js';

/**
 * Saturday, August 10, 2013 14:05:09.042 UTC.
 *
 * @type {number}
 */
const TIME = Date.UTC(2013, 7, 10, 14, 5, 9, 42);

describe('DateTimeFormatter', () => {
    const formatter = new DateTimeFormatter({ locale: 'en-US', timeZone: 'UTC' });

    test('formats days, months and years', () => {
        assert.equal(formatter.format('%a %A %d %e %j %u %w', TIME), 'Sat Saturday 10 10 222 6 6');
        assert.equal(formatter.format('%b %B %h %m', TIME), 'Aug August Aug 08');
        assert.equal(formatter.format('%C %y %Y', TIME), '20 13 2013');
        assert.equal(formatter.format('%e|%d', Date.UTC(2013, 0, 5)), ' 5|05');
        assert.equal(formatter.format('%u %w', Date.UTC(2013, 7, 11)), '7 0');
    });

    test('formats week numbers like C', () => {
        // Reference values from C's strftime (via Python).
        const cases = [
            [Date.UTC(2013, 7, 10), '31 31 32 2013 13'],
            [Date.UTC(2021, 0, 1), '00 00 53 2020 20'],
            [Date.UTC(2020, 11, 31), '52 52 53 2020 20'],
            [Date.UTC(2024, 11, 30), '52 53 01 2025 25'],
            [Date.UTC(2023, 0, 1), '01 00 52 2022 22'],
            [Date.UTC(2016, 0, 3), '01 00 53 2015 15'],
        ];

        for (const [time, expected] of cases) {
            assert.equal(formatter.format('%U %W %V %G %g', time), expected);
        }

        assert.deepEqual(getIsoWeek(Date.UTC(2024, 11, 30)), { year: 2025, week: 1 });
        assert.deepEqual(getIsoWeek(new Date(Date.UTC(2021, 0, 1))), { year: 2020, week: 53 });
    });

    test('formats times', () => {
        assert.equal(formatter.format('%H %k %I %l %M %S %L', TIME), '14 14 02  2 05 09 042');
        assert.equal(formatter.format('%p %P', TIME), 'PM pm');
        assert.equal(formatter.format('%I %p', Date.UTC(2013, 0, 1, 0, 30)), '12 AM');
        assert.equal(formatter.format('%I %p', Date.UTC(2013, 0, 1, 12)), '12 PM');
        assert.equal(formatter.format('%s', TIME), '1376143509');
        assert.equal(formatter.format('%z %Z', TIME), '+0000 UTC');
    });

    test('expands composites', () => {
        assert.equal(
            formatter.format('%r|%R|%T|%D|%F', TIME),
            '02:05:09 PM|14:05|14:05:09|08/10/13|2013-08-10'
        );
        assert.equal(formatter.format('%n%t%%', TIME), '\n\t%');
    });

    test('supports glibc padding flags', () => {
        assert.equal(
            formatter.format('%-d/%-m %_H %0e %^a %^B', Date.UTC(2013, 1, 3, 4)),
            '3/2  4 03 SUN FEBRUARY'
        );
        assert.equal(formatter.format('%-j', TIME), '222');
    });

    test('copies unknown specifiers', () => {
        assert.equal(formatter.format('%q %', TIME), '%q %');
        assert.equal(formatter.format('100%', TIME), '100%');
    });

    test('uses the preferred formats of the locale, like the original toolkit', () => {
        assert.equal(formatter.format('%c', TIME), 'Aug 10, 2013');
        // Some ICU versions put a narrow no-break space before AM and PM.
        const normalize = (text) => text.replace(/\s/gu, ' ');

        assert.equal(normalize(formatter.format('%X', TIME)), '2:05:09 PM');
        assert.equal(normalize(formatter.format('%x', TIME)), 'Aug 10, 2013, 2:05:09 PM');

        const dutch = new DateTimeFormatter({
            locale: 'nl-NL',
            timeZone: 'UTC',
            dateStyle: DateTimeStyle.SHORT,
        });
        assert.equal(dutch.format('%c', TIME), '10-08-2013');
        assert.equal(dutch.formatDate(TIME, DateTimeStyle.LONG), '10 augustus 2013');
        assert.equal(dutch.formatTime(TIME, DateTimeStyle.SHORT), '14:05');
        assert.equal(
            dutch.formatDateTime(TIME, DateTimeStyle.SHORT, DateTimeStyle.SHORT),
            '10-08-2013, 14:05'
        );

        const german = new DateTimeFormatter({ locale: 'de-DE', timeZone: 'UTC' });
        assert.equal(german.formatDate(TIME, DateTimeStyle.FULL), 'Samstag, 10. August 2013');
        const japanese = new DateTimeFormatter({ locale: 'ja-JP', timeZone: 'UTC' });
        assert.equal(japanese.formatDate(TIME), '2013/08/10');
    });

    test('uses locale names and designators', () => {
        const dutch = new DateTimeFormatter({ locale: 'nl-NL', timeZone: 'UTC' });
        assert.equal(dutch.format('%A %e %B %Y, %p', TIME), 'zaterdag 10 augustus 2013, p.m.');

        const korean = new DateTimeFormatter({ locale: 'ko-KR', timeZone: 'UTC' });
        assert.equal(korean.format('%p %I:%M', TIME), '오후 02:05');

        const manager = new LocaleManagerClass({ locale: 'en-US' });
        manager.shortDayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        manager.timeZone = 'UTC';
        assert.equal(new DateTimeFormatter({ localeManager: manager }).format('%a', TIME), 'Sa');
    });

    test('formats in time zones', () => {
        const amsterdam = new DateTimeFormatter({ locale: 'en-GB', timeZone: 'Europe/Amsterdam' });
        assert.equal(amsterdam.format('%F %T %z %Z', TIME), '2013-08-10 16:05:09 +0200 CEST');
        assert.equal(amsterdam.format('%T %z', Date.UTC(2013, 0, 10, 14)), '15:00:00 +0100');
        assert.equal(amsterdam.formatTime(TIME, DateTimeStyle.SHORT), '16:05');

        const newYork = new DateTimeFormatter({ locale: 'en-US', timeZone: 'America/New_York' });
        assert.equal(
            newYork.format('%F %H:%M %z', Date.UTC(2013, 0, 1, 2)),
            '2012-12-31 21:00 -0500'
        );

        const kolkata = new DateTimeFormatter({ timeZone: 'Asia/Kolkata' });
        assert.equal(kolkata.format('%H:%M %z', TIME), '19:35 +0530');

        const manager = new LocaleManagerClass({ locale: 'en-US' });
        manager.timeZone = 'Asia/Tokyo';
        const following = new DateTimeFormatter({ localeManager: manager });
        assert.equal(following.effectiveTimeZone, 'Asia/Tokyo');
        assert.equal(following.format('%H %z', TIME), '23 +0900');
    });

    test('formats the local time zone, the default', () => {
        const local = new DateTimeFormatter({ timeZone: 'local' });
        const date = new Date(TIME);

        assert.equal(Number(local.format('%H', TIME)), date.getHours());
        assert.equal(Number(local.format('%M', TIME)), date.getMinutes());

        // A day of the calendar (a local midnight) is formatted as that day by default.
        const standard = new DateTimeFormatter({ locale: 'en-US' });
        assert.equal(standard.effectiveTimeZone, 'local');
        for (const month of [0, 6]) {
            const day = new Date(2026, month, 27);
            assert.equal(standard.format('%F', day), `2026-${month ? '07' : '01'}-27`);
            assert.equal(formatDateTimePattern('%-d', day), '27');
        }
    });

    test('accepts dates, numbers and numeric strings, and handles old dates', () => {
        assert.equal(formatter.format('%F', new Date(TIME)), '2013-08-10');
        assert.equal(formatter.format('%F', String(TIME)), '2013-08-10');
        assert.equal(formatter.format('%F', Date.UTC(1969, 11, 31)), '1969-12-31');
        assert.equal(formatter.format('%Y %y', new Date('0005-03-01T00:00:00Z')), '0005 05');
    });

    test('rejects invalid arguments', () => {
        assert.throws(() => formatter.format('%F', 'yesterday'), TypeError);
        assert.throws(() => formatter.format('%F', NaN), RangeError);
        assert.throws(() => formatter.format(null, TIME), TypeError);
        assert.throws(() => formatter.formatDate(TIME, 'huge'), RangeError);
        assert.throws(() => new DateTimeFormatter({ timeZone: 'Mars/Olympus' }), RangeError);
        assert.throws(() => new DateTimeFormatter({ dateStyle: 'tiny' }), RangeError);
    });

    test('provides convenience functions', () => {
        assert.equal(formatDateTimePattern('%Y', TIME).length, 4);
        assert.equal(typeof formatDate(TIME), 'string');
    });
});
