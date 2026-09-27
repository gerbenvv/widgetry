/**
 * @module widgets/date-edit
 */
import { Calendar } from './calendar.js';
import { LineEdit } from './line-edit.js';
import { Popover } from './popover.js';
/**
 * The default format of a date edit: the locale's medium date style, e.g. "Sep 27, 2026".
 *
 * @type {Intl.DateTimeFormatOptions}
 */
export declare const DEFAULT_DATE_FORMAT: Intl.DateTimeFormatOptions;
/**
 * Returns the order of the day, month and year fields in a locale's numeric dates, e.g.
 * `['month', 'day', 'year']` for `en-US`.
 *
 * @param {string} locale
 * @returns {string[]}
 */
export declare function getDateFieldOrder(locale: string): string[];
/**
 * Parses a date typed in a locale: numeric dates in the locale's field order (e.g. 9/27/2026 in
 * `en-US`, 27-9-2026 in `nl-NL`), ISO dates (2026-09-27), and dates with a month name (Sep 27,
 * 2026 or 27 september 2026). A missing year is the reference year, and two-digit years are taken
 * within 50 years of it.
 *
 * @param {string} text
 * @param {string} [locale] Defaults to the current locale.
 * @param {Date} [reference] The date that gives the default year. Defaults to today.
 * @returns {Date | null} The date at local midnight, or `null` if the text is not a valid date.
 */
export declare function parseLocaleDate(text: string, locale?: string, reference?: Date): Date | null;
/**
 * A line edit for dates, with a button that opens a calendar.
 *
 * The date is shown in the current locale with the `format` options of `Intl.DateTimeFormat`.
 * Typed dates are accepted in the locale's numeric order, as ISO dates (yyyy-mm-dd) and with month
 * names (see `parseLocaleDate`); the text is shown in the invalid state while it is not a date in
 * the range from `minDate` to `maxDate`. Once the date edit is activated or loses the focus, a
 * valid text is shown in the format again.
 *
 * Keyboard: Alt+Down or F4 opens the calendar. While it is open, the arrow keys, Home, End, Page
 * Up and Page Down move through the days, Enter chooses one and Escape closes the calendar. The
 * focus stays in the entry.
 *
 * Signals: `change` (the date changed), `activate`, and those of a line edit (`text-change` and so
 * on).
 */
export declare class DateEdit extends LineEdit {
    _calendar: Calendar;
    _popover: Popover;
    _formatter: Intl.DateTimeFormat;
    _updatingText: boolean;
    _localeDisconnect: () => void;
    _buttonEl: HTMLElement;
    popupOpen: boolean;
    _date: any;
    _popupOpen: boolean;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The calendar shown in the popup. It is created on first use.
     *
     * @type {Calendar}
     */
    get calendar(): Calendar;
    /**
     * Sets several properties, applying the date range before the date so that the date is checked
     * against the new range.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean}
     */
    set(properties: Record<string, unknown>): boolean;
    /**
     * Opens the calendar.
     */
    openPopup(): void;
    /**
     * Closes the calendar.
     */
    closePopup(): void;
    /**
     * Opens the calendar if it is closed, and closes it otherwise.
     */
    togglePopup(): void;
    /**
     * Formats a date as the date edit shows it.
     *
     * @param {Date} date
     * @returns {string}
     */
    formatDate(date: Date): string;
    /**
     * Parses a typed date. Override to accept other notations.
     *
     * @param {string} text
     * @returns {Date | null}
     */
    parseDate(text: string): Date | null;
    activate(): void;
    destroy(): void;
    _validate(text: any): boolean;
    _isInRange(date: any): boolean;
    _onTextChange(text: any): void;
    _setDate(date: any): void;
    _updateText(): void;
    _normalizeText(): void;
    _showPopup(): void;
    _onPopoverClose(): void;
    _onCalendarActivate(): void;
    _onButtonPointerDown(event: any): void;
    _onFocusOut(event: any): void;
    _onInputKeyDown(event: any): void;
    _onInputBlur(): void;
}

/** The declared properties of {@link DateEdit}. */
export interface DateEdit {
    /**
     * The date, or `null` if none (or no valid date) was entered. Set a `Date`, an ISO date string
     * (yyyy-mm-dd) or `null`. Dates are days: the time is ignored.
     */
    date: any;
    /**
     * The same as `date`.
     */
    value: any;
    /**
     * The earliest date that can be entered, or `null`.
     */
    minDate: any;
    /**
     * The latest date that can be entered, or `null`.
     */
    maxDate: any;
    /**
     * How dates are shown: options of `Intl.DateTimeFormat`, such as `{dateStyle: 'short'}` or
     * `{year: 'numeric', month: 'long', day: 'numeric'}`.
     */
    format: any;
}
