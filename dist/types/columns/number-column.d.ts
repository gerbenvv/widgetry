/**
 * @module columns/number-column
 */
import { DataColumn } from './data-column.js';
/**
 * A column that shows numbers, formatted for the current locale with `Intl.NumberFormat` and
 * aligned to the right. Values may be numbers or numeric strings; other values show nothing.
 *
 * With `style: 'percent'`, 0.25 shows as 25%. With `style: 'currency'`, set `currency` (an ISO
 * 4217 code such as `'EUR'`). `formatOptions` passes any other `Intl.NumberFormat` option.
 *
 * @example
 * new NumberColumn({ name: 'price', label: 'Price', style: 'currency', currency: 'EUR' });
 */
export declare class NumberColumn extends DataColumn {
    /** @type {Intl.NumberFormat | null} */
    _numberFormat: Intl.NumberFormat | null;
    _numberFormatLocale: any;
    _initialize(): void;
    /**
     * The `Intl.NumberFormat` of the column for the current locale.
     *
     * @type {Intl.NumberFormat}
     */
    get numberFormat(): Intl.NumberFormat;
    _formatValue(value: any): string;
    _getTypeClassName(): string;
    _onFormatChange(): void;
}

/** The declared properties of {@link NumberColumn}. */
export interface NumberColumn {
    /**
     * The number of fraction digits, setting both the minimum and the maximum. Reading returns
     * the maximum.
     */
    digits: number;
    /**
     * The minimum number of fraction digits.
     */
    minimumFractionDigits: number;
    /**
     * The maximum number of fraction digits. It is at least the minimum.
     */
    maximumFractionDigits: number;
    /**
     * The number style: `'decimal'`, `'percent'`, `'currency'` or `'unit'` (with a `unit` in
     * `formatOptions`).
     */
    style: string;
    /**
     * The currency of the `'currency'` style, as an ISO 4217 code.
     */
    currency: string;
    /**
     * Whether digits are grouped, e.g. `1,234,567`.
     */
    useGrouping: boolean;
    /**
     * More `Intl.NumberFormat` options, which override the other properties, or `null`.
     */
    formatOptions: any;
}
