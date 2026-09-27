/**
 * @module i18n/locale-manager
 */
import { Instance } from '../core/instance.js';
/**
 * The locale manager holds the current locale, which formatters, parsers and the translator use.
 * Month and day names come from `Intl` and can be overridden.
 *
 * Signals: `locale-change`, `language-change` (when the language part of the locale changed).
 */
export declare class LocaleManagerClass extends Instance {
    _locale: string;
    _language: string;
    _country: string;
    _shortMonthNames: string[];
    _longMonthNames: string[];
    _shortDayNames: string[];
    _longDayNames: string[];
    _firstDayOfWeek: number;
    _decimalSeparator: string;
    _groupSeparator: string;
    _initialize(): void;
    _applyLocale(): void;
}
/**
 * Returns the locale manager singleton.
 *
 * @type {() => LocaleManagerClass}
 */
export declare const getLocaleManager: () => LocaleManagerClass;

/** The declared properties of {@link LocaleManagerClass}. */
export interface LocaleManagerClass {
    /**
     * The current locale as a BCP 47 tag, e.g. `'en-US'` or `'nl-NL'`. Defaults to the browser's.
     */
    locale: string;
    /**
     * The language of the locale, e.g. `'en'`.
     */
    readonly language: any;
    /**
     * The country (region) of the locale, e.g. `'US'`, or `''` if the locale has none.
     */
    readonly country: any;
    /**
     * The short month names, January first.
     */
    shortMonthNames: any;
    /**
     * The long month names, January first.
     */
    longMonthNames: any;
    /**
     * The short day names, Sunday first.
     */
    shortDayNames: any;
    /**
     * The long day names, Sunday first.
     */
    longDayNames: any;
    /**
     * The first day of the week: 0 for Sunday, 1 for Monday and so on.
     */
    firstDayOfWeek: any;
    /**
     * The designator of times before noon on a 12-hour clock, e.g. `'AM'`.
     */
    amDesignator: any;
    /**
     * The designator of times after noon on a 12-hour clock, e.g. `'PM'`.
     */
    pmDesignator: any;
    /**
     * The time zone dates are formatted and parsed in: an IANA time zone name such as
     * `'Europe/Amsterdam'`, `'UTC'` (the default, like the original toolkit) or `'local'` for the
     * time zone of the system. It does not change with the locale.
     */
    timeZone: string;
    /**
     * The decimal separator of numbers, e.g. `'.'`.
     */
    decimalSeparator: any;
    /**
     * The digit group (thousands) separator of numbers, e.g. `','`.
     */
    groupSeparator: any;
}
