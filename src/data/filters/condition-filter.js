/**
 * @module data/filters/condition-filter
 */

import { defineProperties } from '../../core/instance.js';
import { registerType } from '../../core/registry.js';
import { areEqual } from '../../core/util.js';
import { Filter } from './filter.js';

/**
 * The operators of a {@link ConditionFilter}.
 *
 * @enum {string}
 */
export const ConditionOperator = Object.freeze({
    EQUALS: 'equals',
    LESS_THAN: 'less-than',
    GREATER_THAN: 'greater-than',
    LESS_THAN_EQUAL: 'less-than-equal',
    GREATER_THAN_EQUAL: 'greater-than-equal',
    CONTAINS: 'contains',
    STARTS_WITH: 'starts-with',
    ENDS_WITH: 'ends-with',
    NOT_EQUALS: 'not-equals', // No column equals the value.
    MATCHES: 'matches', // The value is a regular expression (or its source) that a column matches.
});

/**
 * Converts a value to text for the text operators. `null` and `undefined` become `''`.
 *
 * @param {unknown} value
 * @returns {string}
 */
function toText(value) {
    return value === null || value === undefined ? '' : String(value);
}

/**
 * Converts a value to something the ordering operators can compare: numbers stay numbers and
 * dates become timestamps. Anything else is `null`.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function toOrderable(value) {
    if (typeof value === 'number') {
        return Number.isNaN(value) ? null : value;
    }

    if (value instanceof Date) {
        const time = value.getTime();

        return Number.isNaN(time) ? null : time;
    }

    return null;
}

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
export class ConditionFilter extends Filter {
    isVisibleRow(row) {
        const columns = this._columns ?? Object.keys(row);

        if (this._operator === ConditionOperator.NOT_EQUALS) {
            return !columns.some((column) => column in row && this._isEqual(row[column]));
        }

        return columns.some((column) => column in row && this.compareValues(row[column]));
    }

    /**
     * Checks whether a value satisfies the condition. `NOT_EQUALS` is checked per value here; for
     * a row it means that no column equals the value.
     *
     * @param {unknown} value
     * @returns {boolean}
     */
    compareValues(value) {
        const operator = this._operator;
        const target = this._value;

        switch (operator) {
            case ConditionOperator.EQUALS:
                return this._isEqual(value);

            case ConditionOperator.NOT_EQUALS:
                return !this._isEqual(value);

            case ConditionOperator.CONTAINS:
            case ConditionOperator.STARTS_WITH:
            case ConditionOperator.ENDS_WITH: {
                let text = toText(value);
                let search = toText(target);

                if (!this._caseSensitive) {
                    text = text.toLowerCase();
                    search = search.toLowerCase();
                }

                if (operator === ConditionOperator.CONTAINS) {
                    return text.includes(search);
                }

                return operator === ConditionOperator.STARTS_WITH
                    ? text.startsWith(search)
                    : text.endsWith(search);
            }

            case ConditionOperator.MATCHES:
                return this._getRegExp().test(toText(value));
        }

        const first = toOrderable(value);
        const second = toOrderable(target);
        if (first === null || second === null) {
            return false;
        }

        switch (operator) {
            case ConditionOperator.LESS_THAN:
                return first < second;

            case ConditionOperator.GREATER_THAN:
                return first > second;

            case ConditionOperator.LESS_THAN_EQUAL:
                return first <= second;

            default:
                return first >= second;
        }
    }

    _isEqual(value) {
        let first = typeof value === 'number' ? String(value) : value;
        let second = typeof this._value === 'number' ? String(this._value) : this._value;

        if (!this._caseSensitive && typeof first === 'string' && typeof second === 'string') {
            first = first.toLowerCase();
            second = second.toLowerCase();
        }

        return areEqual(first, second);
    }

    _getRegExp() {
        if (!this._regExp) {
            const value = this._value;
            const source = value instanceof RegExp ? value.source : toText(value);

            // Global and sticky flags would make test() stateful.
            let flags = value instanceof RegExp ? value.flags.replace(/[gy]/g, '') : '';
            if (!this._caseSensitive && !flags.includes('i')) {
                flags += 'i';
            }

            this._regExp = new RegExp(source, flags);
        }

        return this._regExp;
    }
}

defineProperties(ConditionFilter, {
    /**
     * The operator: one of {@link ConditionOperator}.
     */
    operator: {
        value: ConditionOperator.CONTAINS,
        coerce(operator) {
            if (!Object.values(ConditionOperator).includes(operator)) {
                throw new RangeError(`Invalid condition operator '${operator}'.`);
            }

            return operator;
        },
        changed() {
            this._changed();
        },
    },

    /**
     * The value the operator compares with. For `MATCHES`, a `RegExp` or a pattern string.
     */
    value: {
        value: null,
        changed() {
            this._regExp = null;
            this._changed();
        },
    },

    /**
     * The columns to check, or `null` for all columns of a row.
     */
    columns: {
        value: null,
        coerce(columns) {
            if (columns !== null && !Array.isArray(columns)) {
                throw new TypeError('Filter columns must be an array or null.');
            }

            return columns && [...columns];
        },
        changed() {
            this._changed();
        },
    },

    /**
     * Whether the text operators (and `EQUALS` on strings) distinguish upper and lower case.
     */
    caseSensitive: {
        value: true,
        changed() {
            this._regExp = null;
            this._changed();
        },
    },
});

registerType('condition-filter', ConditionFilter);
