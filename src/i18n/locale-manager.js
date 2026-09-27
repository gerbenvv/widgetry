/**
 * @module i18n/locale-manager
 */

import { defineProperties, Instance, lazySingleton } from '../core/instance.js';

function getDefaultLocale() {
    if (typeof navigator !== 'undefined' && navigator.language) {
        return navigator.language;
    }

    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
}

function getNames(locale, kind, width) {
    if (kind === 'month') {
        // The toolkit uses the Gregorian calendar, also in locales that default to another one,
        // such as Persian and Saudi Arabic.
        const format = new Intl.DateTimeFormat(locale, {
            month: width,
            timeZone: 'UTC',
            calendar: 'gregory',
        });

        return Array.from({ length: 12 }, (_x, i) => format.format(Date.UTC(2021, i, 1)));
    }

    // Day names, starting on Sunday (January 3, 2021 was a Sunday).
    const format = new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' });

    return Array.from({ length: 7 }, (_x, i) => format.format(Date.UTC(2021, 0, 3 + i)));
}

function getFirstDayOfWeek(locale) {
    try {
        const info = new Intl.Locale(locale);
        const weekInfo = info.getWeekInfo?.() || info.weekInfo;
        if (weekInfo?.firstDay) {
            // Intl uses 1 for Monday and 7 for Sunday.
            return weekInfo.firstDay % 7;
        }
    } catch (_error) {
        // Fall back below.
    }

    return /-(US|CA|JP|BR|IL|MX|PH|KR|TW|HK|IN|ZA|SA)\b/i.test(locale) ? 0 : 1;
}

function getDayPeriods(locale) {
    const format = new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        hourCycle: 'h12',
        timeZone: 'UTC',
    });

    // Take the day period of 1 AM and 1 PM, which every locale with a 12-hour clock names.
    return [1, 13].map((hour, i) => {
        const parts = format.formatToParts(Date.UTC(2021, 0, 1, hour));

        return parts.find((x) => x.type === 'dayPeriod')?.value || (i ? 'PM' : 'AM');
    });
}

/**
 * The locale manager holds the current locale, which formatters, parsers and the translator use.
 * Month and day names come from `Intl` and can be overridden.
 *
 * Signals: `locale-change`, `language-change` (when the language part of the locale changed).
 */
export class LocaleManagerClass extends Instance {
    _initialize() {
        super._initialize();

        this._locale = getDefaultLocale();
        this._applyLocale();
    }

    _applyLocale() {
        const locale = this._locale;
        // The region, unlike the second subtag, is never a script (as in `zh-Hant-TW`).
        const { language, region } = new Intl.Locale(locale);

        this._language = (language || 'en').toLowerCase();
        this._country = (region || '').toUpperCase();

        this._shortMonthNames = getNames(locale, 'month', 'short');
        this._longMonthNames = getNames(locale, 'month', 'long');
        this._shortDayNames = getNames(locale, 'day', 'short');
        this._longDayNames = getNames(locale, 'day', 'long');
        this._firstDayOfWeek = getFirstDayOfWeek(locale);
        [this._amDesignator, this._pmDesignator] = getDayPeriods(locale);

        const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
        this._decimalSeparator = parts.find((x) => x.type === 'decimal')?.value || '.';
        this._groupSeparator = parts.find((x) => x.type === 'group')?.value || ',';
    }
}

defineProperties(LocaleManagerClass, {
    /**
     * The current locale as a BCP 47 tag, e.g. `'en-US'` or `'nl-NL'`. Defaults to the browser's.
     */
    locale: {
        value: 'en-US',
        coerce(locale) {
            // Accept underscores, as in `en_US`, and validate the tag.
            const tag = String(locale).replace(/_/g, '-');

            return Intl.getCanonicalLocales(tag)[0];
        },
        changed() {
            const oldLanguage = this._language;

            this._applyLocale();

            if (this._language !== oldLanguage) {
                this.emit('language-change', this);
            }
        },
    },

    /**
     * The language of the locale, e.g. `'en'`.
     */
    language: { readOnly: true },

    /**
     * The country (region) of the locale, e.g. `'US'`, or `''` if the locale has none.
     */
    country: { readOnly: true },

    /**
     * The short month names, January first.
     */
    shortMonthNames: { value: null },

    /**
     * The long month names, January first.
     */
    longMonthNames: { value: null },

    /**
     * The short day names, Sunday first.
     */
    shortDayNames: { value: null },

    /**
     * The long day names, Sunday first.
     */
    longDayNames: { value: null },

    /**
     * The first day of the week: 0 for Sunday, 1 for Monday and so on.
     */
    firstDayOfWeek: { value: 1 },

    /**
     * The designator of times before noon on a 12-hour clock, e.g. `'AM'`.
     */
    amDesignator: { value: 'AM' },

    /**
     * The designator of times after noon on a 12-hour clock, e.g. `'PM'`.
     */
    pmDesignator: { value: 'PM' },

    /**
     * The time zone dates are formatted and parsed in: `'local'` (the default) for the time zone of
     * the system, which is the one of the dates of the calendar and the date edit (local
     * midnight), `'UTC'` (like the original toolkit) or an IANA time zone name such as
     * `'Europe/Amsterdam'`. It does not change with the locale.
     */
    timeZone: {
        value: 'local',
        coerce(timeZone) {
            if (typeof timeZone !== 'string') {
                throw new TypeError('The time zone must be a string.');
            }

            if (timeZone === 'local') {
                return timeZone;
            }

            // Validate the name; this throws a RangeError for unknown time zones.
            return new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
        },
    },

    /**
     * The decimal separator of numbers, e.g. `'.'`.
     */
    decimalSeparator: { value: '.' },

    /**
     * The digit group (thousands) separator of numbers, e.g. `','`.
     */
    groupSeparator: { value: ',' },
});

/**
 * Returns the locale manager singleton.
 *
 * @type {() => LocaleManagerClass}
 */
export const getLocaleManager = lazySingleton(() => new LocaleManagerClass());
