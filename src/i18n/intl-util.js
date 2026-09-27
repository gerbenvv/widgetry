/**
 * Cached `Intl` objects and time zone arithmetic shared by the formatters and parsers.
 *
 * @module i18n/intl-util
 */

/**
 * The number of milliseconds in a minute.
 *
 * @type {number}
 */
export const MINUTE = 60 * 1000;

/**
 * The number of milliseconds in a day.
 *
 * @type {number}
 */
export const DAY = 24 * 60 * MINUTE;

/**
 * The cached `Intl` objects, keyed by constructor name, locale and options.
 *
 * @type {Map<string, object>}
 */
const CACHE = new Map();

function getCached(cls, locale, options) {
    const key = `${cls.name}|${locale}|${JSON.stringify(options)}`;

    let result = CACHE.get(key);
    if (!result) {
        result = new cls(locale, options);
        CACHE.set(key, result);
    }

    return result;
}

/**
 * Returns a cached `Intl.DateTimeFormat`.
 *
 * @param {string} locale
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {Intl.DateTimeFormat}
 */
export function getDateTimeFormat(locale, options = {}) {
    return /** @type {Intl.DateTimeFormat} */ (getCached(Intl.DateTimeFormat, locale, options));
}

/**
 * Returns a cached `Intl.NumberFormat`.
 *
 * @param {string} locale
 * @param {Intl.NumberFormatOptions} [options]
 * @returns {Intl.NumberFormat}
 */
export function getNumberFormat(locale, options = {}) {
    return /** @type {Intl.NumberFormat} */ (getCached(Intl.NumberFormat, locale, options));
}

/**
 * Returns a cached `Intl.PluralRules`.
 *
 * @param {string} locale
 * @param {Intl.PluralRulesOptions} [options]
 * @returns {Intl.PluralRules}
 */
export function getPluralRules(locale, options = {}) {
    return /** @type {Intl.PluralRules} */ (getCached(Intl.PluralRules, locale, options));
}

/**
 * Returns a cached `Intl.RelativeTimeFormat`.
 *
 * @param {string} locale
 * @param {Intl.RelativeTimeFormatOptions} [options]
 * @returns {Intl.RelativeTimeFormat}
 */
export function getRelativeTimeFormat(locale, options = {}) {
    return /** @type {Intl.RelativeTimeFormat} */ (
        getCached(Intl.RelativeTimeFormat, locale, options)
    );
}

/**
 * Converts a toolkit time zone (`'local'` or an IANA name) to the `timeZone` option of `Intl`.
 *
 * @param {string} timeZone
 * @returns {string | undefined}
 */
export function toIntlTimeZone(timeZone) {
    return timeZone === 'local' ? undefined : timeZone;
}

/**
 * Creates a UTC timestamp from date and time fields. Unlike `Date.UTC`, years 0 to 99 are not
 * mapped to the twentieth century, and months and days may overflow.
 *
 * @param {number} year
 * @param {number} month The month, 0 for January.
 * @param {number} day The day of the month, from 1.
 * @param {number} [hours]
 * @param {number} [minutes]
 * @param {number} [seconds]
 * @param {number} [milliseconds]
 * @returns {number}
 */
export function utcTimestamp(
    year,
    month,
    day,
    hours = 0,
    minutes = 0,
    seconds = 0,
    milliseconds = 0
) {
    const date = new Date(0);
    date.setUTCFullYear(year, month, day);
    date.setUTCHours(hours, minutes, seconds, milliseconds);

    return date.getTime();
}

/**
 * Returns the number of days in a month.
 *
 * @param {number} year
 * @param {number} month The month, 0 for January.
 * @returns {number}
 */
export function getDaysInMonth(year, month) {
    return new Date(utcTimestamp(year, month + 1, 0)).getUTCDate();
}

/**
 * @typedef {object} ZonedFields
 * @property {number} year The year, negative (or zero) for years before the common era.
 * @property {number} month The month, 0 for January.
 * @property {number} day The day of the month, from 1.
 * @property {number} hours
 * @property {number} minutes
 * @property {number} seconds
 * @property {number} milliseconds
 * @property {number} weekDay The day of the week, 0 for Sunday.
 * @property {number} offset The offset of the time zone from UTC in minutes, e.g. 120 for UTC+2.
 */

/**
 * Splits a timestamp into its date and time fields in a time zone.
 *
 * @param {number} timestamp Milliseconds since the Unix epoch.
 * @param {string} timeZone `'UTC'`, `'local'` or an IANA time zone name.
 * @returns {ZonedFields}
 */
export function getZonedFields(timestamp, timeZone) {
    const date = new Date(timestamp);

    if (timeZone === 'local') {
        return {
            year: date.getFullYear(),
            month: date.getMonth(),
            day: date.getDate(),
            hours: date.getHours(),
            minutes: date.getMinutes(),
            seconds: date.getSeconds(),
            milliseconds: date.getMilliseconds(),
            weekDay: date.getDay(),
            offset: -date.getTimezoneOffset(),
        };
    }

    if (timeZone === 'UTC') {
        return getUtcFields(date);
    }

    const format = getDateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        era: 'short',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        calendar: 'gregory',
        numberingSystem: 'latn',
    });

    const parts = {};
    for (const part of format.formatToParts(date)) {
        parts[part.type] = part.value;
    }

    // Years before the common era count backwards from 1 BC, which is year 0.
    const year = parts.era === 'BC' ? 1 - Number(parts.year) : Number(parts.year);

    const milliseconds = date.getUTCMilliseconds();
    const wallClock = utcTimestamp(
        year,
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
        milliseconds
    );

    return {
        ...getUtcFields(new Date(wallClock)),
        offset: Math.round((wallClock - timestamp) / MINUTE),
    };
}

function getUtcFields(date) {
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth(),
        day: date.getUTCDate(),
        hours: date.getUTCHours(),
        minutes: date.getUTCMinutes(),
        seconds: date.getUTCSeconds(),
        milliseconds: date.getUTCMilliseconds(),
        weekDay: date.getUTCDay(),
        offset: 0,
    };
}

/**
 * Returns the offset of a time zone from UTC at a moment, in minutes.
 *
 * @param {number} timestamp
 * @param {string} timeZone
 * @returns {number}
 */
export function getTimeZoneOffset(timestamp, timeZone) {
    return getZonedFields(timestamp, timeZone).offset;
}

/**
 * Converts date and time fields in a time zone to a timestamp. For a wall-clock time that occurs
 * twice (when clocks are turned back) the first is used; for one that does not exist (when clocks
 * are turned forward) the time is moved forward by the gap.
 *
 * @param {Partial<ZonedFields> & {year: number, month: number, day: number}} fields
 * @param {string} timeZone
 * @returns {number}
 */
export function fromZonedFields(fields, timeZone) {
    const wallClock = utcTimestamp(
        fields.year,
        fields.month,
        fields.day,
        fields.hours || 0,
        fields.minutes || 0,
        fields.seconds || 0,
        fields.milliseconds || 0
    );

    if (timeZone === 'UTC') {
        return wallClock;
    }

    // Try the offsets just before and after the moment, which differ around a transition.
    const earlyOffset = getTimeZoneOffset(wallClock - DAY, timeZone);
    const lateOffset = getTimeZoneOffset(wallClock + DAY, timeZone);

    for (const offset of [earlyOffset, lateOffset]) {
        const timestamp = wallClock - offset * MINUTE;
        if (getTimeZoneOffset(timestamp, timeZone) === offset) {
            return timestamp;
        }
    }

    // The wall-clock time falls in a gap; the offset before the gap moves it forward.
    return wallClock - earlyOffset * MINUTE;
}
