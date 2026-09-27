// Tests of the Intl helpers and time zone arithmetic.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    fromZonedFields,
    getDateTimeFormat,
    getDaysInMonth,
    getTimeZoneOffset,
    getZonedFields,
    utcTimestamp,
} from '../intl-util.js';

describe('intl-util', () => {
    test('caches Intl objects', () => {
        assert.equal(
            getDateTimeFormat('en-US', { month: 'long' }),
            getDateTimeFormat('en-US', { month: 'long' })
        );
        assert.notEqual(getDateTimeFormat('en-US'), getDateTimeFormat('nl-NL'));
    });

    test('creates timestamps for all years', () => {
        assert.equal(utcTimestamp(2013, 7, 10, 14, 5), Date.UTC(2013, 7, 10, 14, 5));
        assert.equal(new Date(utcTimestamp(5, 0, 1)).getUTCFullYear(), 5);
        assert.equal(getDaysInMonth(2012, 1), 29);
        assert.equal(getDaysInMonth(2013, 1), 28);
        assert.equal(getDaysInMonth(1900, 1), 28);
        assert.equal(getDaysInMonth(2000, 1), 29);
        assert.equal(getDaysInMonth(2013, 11), 31);
    });

    test('splits timestamps in time zones', () => {
        const time = Date.UTC(2013, 7, 10, 23, 30);

        assert.deepEqual(getZonedFields(time, 'UTC'), {
            year: 2013,
            month: 7,
            day: 10,
            hours: 23,
            minutes: 30,
            seconds: 0,
            milliseconds: 0,
            weekDay: 6,
            offset: 0,
        });

        const tokyo = getZonedFields(time, 'Asia/Tokyo');
        assert.deepEqual([tokyo.day, tokyo.hours, tokyo.weekDay, tokyo.offset], [11, 8, 0, 540]);

        assert.equal(getTimeZoneOffset(time, 'America/St_Johns'), -150);
        assert.equal(getZonedFields(Date.UTC(-100, 6, 1), 'Europe/London').year, -100);
    });

    test('converts wall-clock times back, around transitions', () => {
        const zone = 'Europe/Amsterdam';

        assert.equal(
            fromZonedFields({ year: 2013, month: 7, day: 10, hours: 12 }, zone),
            Date.UTC(2013, 7, 10, 10)
        );

        // The repeated hour in October resolves to its first occurrence.
        assert.equal(
            fromZonedFields({ year: 2013, month: 9, day: 27, hours: 2, minutes: 30 }, zone),
            Date.UTC(2013, 9, 27, 0, 30)
        );

        // The skipped hour in March moves forward.
        assert.equal(
            fromZonedFields({ year: 2013, month: 2, day: 31, hours: 2, minutes: 30 }, zone),
            Date.UTC(2013, 2, 31, 1, 30)
        );

        for (const time of [Date.UTC(2013, 0, 1), Date.UTC(2013, 5, 1, 13, 7)]) {
            const fields = getZonedFields(time, 'local');
            assert.equal(fromZonedFields(fields, 'local'), time);
        }
    });
});
