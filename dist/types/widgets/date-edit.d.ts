/**
 * @module widgets/date-edit
 */
import { DateTimeParser } from '../i18n/date-time-parser.js';
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
 * A line edit for dates, with a button that opens a calendar.
 *
 * The date is shown in the current locale with the `format` options of `Intl.DateTimeFormat`.
 * Typed dates are read with the date parser of the locale (`DateTimeParser`, in local time): in the
 * locale's numeric order, as ISO dates (yyyy-mm-dd), with month names and as relative dates such
 * as "tomorrow" (see `parseDate`). The text is shown in the invalid state while it is not a date
 * in the range from `minDate` to `maxDate`. Once the date edit is activated or loses the focus, a
 * valid text is shown in the format again.
 *
 * Keyboard: Alt+Down or F4 opens the calendar. While it is open, the arrow keys, Home, End, Page
 * Up and Page Down move through the days, Enter chooses one and Escape closes the calendar. The
 * focus stays in the entry.
 *
 * Signals: `date-change` and `value-change` (the date changed), `popup-open-change`, and those of
 * a line edit: `change` and `text-change` (the text changed), `activate`, and so on.
 */
export declare class DateEdit extends LineEdit {
    _calendar: Calendar;
    _popover: Popover;
    _formatter: Intl.DateTimeFormat;
    _updatingText: boolean;
    _parser: DateTimeParser;
    _localeDisconnect: () => void;
    _buttonEl: HTMLElement;
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
    popup(): void;
    /**
     * Closes the calendar.
     */
    popdown(): void;
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
     * Parses a typed date with the date parser (`DateTimeParser#parseDate`) of the current locale,
     * in local time. A missing year is this year. Override to accept other notations.
     *
     * @param {string} text
     * @returns {Date | null} The date at local midnight, or `null` if the text is not a date.
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
    date: Date | null;
    /**
     * The same as `date`.
     */
    value: Date | null;
    /**
     * The earliest date that can be entered, or `null`.
     */
    minDate: Date | null;
    /**
     * The latest date that can be entered, or `null`.
     */
    maxDate: Date | null;
    /**
     * How dates are shown: options of `Intl.DateTimeFormat`, such as `{dateStyle: 'short'}` or
     * `{year: 'numeric', month: 'long', day: 'numeric'}`. Dates are shown in the Gregorian
     * calendar, which is the one typed dates are read in, also in locales that default to another
     * one.
     */
    format: any;
    /**
     * Whether the calendar is open. Setting it opens or closes the calendar.
     */
    popupOpen: boolean;
}
