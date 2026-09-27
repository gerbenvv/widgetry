/**
 * @module data/filters/condition-filter
 */
import { Filter } from './filter.js';
/**
 * The operators of a {@link ConditionFilter}.
 *
 * @enum {number}
 */
export declare const ConditionOperator: Readonly<{
    EQUALS: 1;
    LESS_THAN: 2;
    GREATER_THAN: 3;
    LESS_THAN_EQUAL: 4;
    GREATER_THAN_EQUAL: 5;
    CONTAINS: 6;
    STARTS_WITH: 7;
    ENDS_WITH: 8;
    NOT_EQUALS: 9;
    MATCHES: 10;
}>;
/**
 * A filter that shows the rows of which a column satisfies a condition, such as "equals 5" or
 * "contains 'fund'". With `columns` set to `null` (the default), a row passes when any of its
 * columns satisfies the condition.
 *
 * Numbers equal their text (`5` equals `'5'`). The ordering operators compare numbers and dates;
 * rows with other values do not pass them.
 *
 * @example
 * const filter = new ConditionFilter({
 *     operator: ConditionOperator.GREATER_THAN,
 *     value: 100,
 *     columns: ['price'],
 * });
 */
export declare class ConditionFilter extends Filter {
    _regExp: RegExp;
    isVisibleRow(row: any): any;
    /**
     * Checks whether a value satisfies the condition. `NOT_EQUALS` is checked per value here; for
     * a row it means that no column equals the value.
     *
     * @param {unknown} value
     * @returns {boolean}
     */
    compareValues(value: unknown): boolean;
    _isEqual(value: any): boolean;
    _getRegExp(): RegExp;
}

/** The declared properties of {@link ConditionFilter}. */
export interface ConditionFilter {
    /**
     * The operator: one of {@link ConditionOperator}.
     */
    operator: any;
    /**
     * The value the operator compares with. For `MATCHES`, a `RegExp` or a pattern string.
     */
    value: any;
    /**
     * The columns to check, or `null` for all columns of a row.
     */
    columns: any;
    /**
     * Whether the text operators (and `EQUALS` on strings) distinguish upper and lower case.
     */
    caseSensitive: boolean;
}
