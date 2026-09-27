/**
 * @module data/abstract-model
 */

import { SortOrder } from '../core/enums.js';
import { defineProperties, Instance } from '../core/instance.js';
import { getLocaleManager } from '../i18n/locale-manager.js';

/**
 * The column types `columnsInfo` accepts. `'auto'` detects the type from the values.
 *
 * @type {ReadonlyArray<string>}
 */
export const COLUMN_TYPES = Object.freeze([
    'auto',
    'string',
    'number',
    'float',
    'double',
    'int',
    'integer',
    'timestamp',
    'bool',
    'boolean',
    'date',
    'time',
    'date-time',
    'datetime',
]);

/**
 * Types that are compared as numbers.
 *
 * @type {ReadonlySet<string>}
 */
const NUMBER_TYPES = new Set(['number', 'float', 'double', 'int', 'integer', 'timestamp']);

/**
 * Types that are compared as points in time. Values may be `Date` objects, timestamps in
 * milliseconds or strings that `Date.parse()` understands, such as ISO 8601 dates.
 *
 * @type {ReadonlySet<string>}
 */
const DATE_TYPES = new Set(['date', 'time', 'date-time', 'datetime']);

/**
 * Collators by locale and case sensitivity, shared by all models.
 *
 * @type {Map<string, Intl.Collator>}
 */
const COLLATORS = new Map();

function getCollator(locale, caseSensitive) {
    const key = `${locale}|${caseSensitive}`;

    let collator = COLLATORS.get(key);
    if (!collator) {
        collator = new Intl.Collator(locale, {
            sensitivity: caseSensitive ? 'variant' : 'accent',
            usage: 'sort',
        });
        COLLATORS.set(key, collator);
    }

    return collator;
}

/**
 * Converts a value to a timestamp in milliseconds, or `NaN` if it is not a point in time.
 *
 * @param {unknown} value A `Date`, a timestamp or a date string.
 * @returns {number}
 */
export function toTimestamp(value) {
    if (value instanceof Date) {
        return value.getTime();
    }

    if (typeof value === 'number') {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        // Numeric strings are timestamps; anything else is parsed as a date.
        const number = Number(value);

        return Number.isFinite(number) ? number : Date.parse(value);
    }

    return NaN;
}

/**
 * Reads the case sensitivity of a column info object, which may use either spelling.
 *
 * @param {ColumnInfo} info
 * @returns {boolean}
 */
function isCaseSensitive(info) {
    const value = info.caseSensitive ?? info['case-sensitive'];

    return value !== false;
}

/**
 * @typedef {object} ColumnInfo
 * @property {string} [type] One of {@link COLUMN_TYPES}. Defaults to `'auto'`.
 * @property {boolean} [caseSensitive] Whether strings are compared case sensitively. Defaults to
 *     `true`. The original kebab-case spelling `'case-sensitive'` is accepted as well.
 * @property {(first: unknown, second: unknown) => number} [compare] A custom comparison of two
 *     values, returning a negative number, zero or a positive number. It replaces the type-based
 *     comparison.
 */

/**
 * Base class of the data models of tables and lists: an ordered list of rows, where every row is
 * an object with a value per column.
 *
 * A model can be sorted on a column (`sortColumn`, `sortOrder`); it then keeps itself sorted when
 * rows are inserted or changed. Sorting is stable. When the model has an `idColumn`, rows can also
 * be addressed by their id, which does not change when the rows are sorted or filtered.
 *
 * Signals:
 * - `row-insert` (`model, index, id`): a row was inserted.
 * - `row-remove` (`model, index, id, row`): a row was removed.
 * - `row-move` (`model, fromIndex, toIndex, id`): a row moved because it was re-sorted.
 * - `row-update` (`model, index, id, oldId`): the values of a row changed (after a possible move).
 * - `cell-change` (`model, index, column`): a single value changed.
 * - `rows-reorder` (`model`): the rows were sorted or replaced; all indices may have changed.
 * - `rows-change` (`model, startIndex, endIndex`): the rows in this range changed in some way. It
 *   follows every other row signal. `endIndex` is smaller than `startIndex` when rows were removed
 *   at the end.
 * - `sort-column-change`, `sort-order-change`, `columns-info-change`, `id-column-change`.
 *
 * The rows passed in are used as they are (they are not copied), so a row object read from the
 * model is the same object that was inserted. Do not change rows directly; use
 * {@link AbstractModel#updateRow} or {@link AbstractModel#setCellValue}, which keep the model
 * sorted and emit the signals.
 */
export class AbstractModel extends Instance {
    /**
     * @param {Record<string, unknown> | object[]} [properties] Property values, or (like the
     *     original toolkit) the initial rows, followed by the other arguments.
     * @param {string | null} [idColumn] The id column, when the rows are passed as an array.
     * @param {string | null} [sortColumn] The sort column, when the rows are passed as an array.
     * @param {number} [sortOrder] The sort order, when the rows are passed as an array.
     */
    constructor(properties, idColumn, sortColumn, sortOrder) {
        if (Array.isArray(properties)) {
            properties = {
                rows: properties,
                idColumn: idColumn ?? null,
                sortColumn: sortColumn ?? null,
                sortOrder: sortColumn ? (sortOrder ?? SortOrder.ASCENDING) : SortOrder.NONE,
            };
        }

        super(properties);
    }

    _initialize() {
        super._initialize();

        /** @type {object[]} */
        this._rows = [];

        /** @type {Map<unknown, number> | null} */
        this._indexById = null;

        this._indexDirty = true;

        this._columnsInfo = {};
    }

    /**
     * Sets several properties. The sort column and order are applied together, so the rows are
     * sorted once.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean}
     */
    set(properties) {
        const { sortColumn, sortOrder, ...rest } = properties;
        const { 'sort-column': sortColumnKebab, 'sort-order': sortOrderKebab, ...others } = rest;

        let changed = super.set(others);

        const column = sortColumn !== undefined ? sortColumn : sortColumnKebab;
        const order = sortOrder !== undefined ? sortOrder : sortOrderKebab;

        if (column !== undefined || order !== undefined) {
            const oldColumn = this.sortColumn;
            const oldOrder = this.sortOrder;

            if (column !== undefined) {
                this.sortByColumn(column, order ?? (column ? SortOrder.ASCENDING : SortOrder.NONE));
            } else {
                this.sortOrder = order;
            }

            changed = changed || oldColumn !== this.sortColumn || oldOrder !== this.sortOrder;
        }

        return changed;
    }

    /**
     * Gets a row.
     *
     * @param {number} index
     * @returns {object}
     * @throws {RangeError} If there is no row at the index.
     */
    getRow(index) {
        const row = Number.isInteger(index) ? this._rows[index] : undefined;
        if (row === undefined) {
            throw new RangeError(`There is no row at index ${index}.`);
        }

        return row;
    }

    /**
     * Gets a row by its id.
     *
     * @param {unknown} id
     * @returns {object}
     * @throws {Error} If there is no id column or no row with the id.
     */
    getRowById(id) {
        return this.getRow(this.getRowIndexById(id));
    }

    /**
     * Gets the index of a row by its id.
     *
     * @param {unknown} id
     * @returns {number}
     * @throws {Error} If there is no id column or no row with the id.
     */
    getRowIndexById(id) {
        const index = this._getIndexById().get(id);
        if (index === undefined) {
            throw new RangeError(`There is no row with id ${String(id)}.`);
        }

        return index;
    }

    /**
     * Gets the id of the row at an index.
     *
     * @param {number} index
     * @returns {unknown}
     * @throws {Error} If there is no id column or no row at the index.
     */
    getRowIdByIndex(index) {
        if (!this.idColumn) {
            throw new Error('The model has no id column.');
        }

        return this.getRow(index)[this.idColumn];
    }

    /**
     * Checks whether there is a row with an id.
     *
     * @param {unknown} id
     * @returns {boolean}
     * @throws {Error} If there is no id column.
     */
    hasRowId(id) {
        return this._getIndexById().has(id);
    }

    /**
     * Gets a value.
     *
     * @param {number} index The row index.
     * @param {string} column
     * @returns {unknown}
     */
    getCellValue(index, column) {
        return this.getRow(index)[column];
    }

    /**
     * Gets a value by row id.
     *
     * @param {unknown} id
     * @param {string} column
     * @returns {unknown}
     */
    getCellValueById(id, column) {
        return this.getRowById(id)[column];
    }

    /**
     * Appends a row. If the model is sorted, the row is placed at its sorted position instead.
     *
     * @param {object} row
     * @returns {number} The index of the new row.
     */
    appendRow(row) {
        return this.insertRow(this.rowsCount, row);
    }

    /**
     * Prepends a row. If the model is sorted, the row is placed at its sorted position instead.
     *
     * @param {object} row
     * @returns {number} The index of the new row.
     */
    prependRow(row) {
        return this.insertRow(0, row);
    }

    /**
     * Inserts a row at an index. If the model is sorted, the row is placed at its sorted position
     * instead.
     *
     * @param {number} index Between 0 and `rowsCount`.
     * @param {object} row
     * @returns {number} The index the row got.
     * @throws {RangeError} If the index is invalid.
     * @throws {Error} If the model has an id column and the id is already in use.
     */
    insertRow(_index, _row) {
        throw new Error(`${this.constructor.name} does not implement insertRow().`);
    }

    /**
     * Appends several rows at once. If the model is sorted, the rows are placed at their sorted
     * positions. With more than one row, listeners get a single `rows-reorder` signal instead of
     * one `row-insert` per row.
     *
     * @param {object[]} rows
     */
    appendRows(rows) {
        this.insertRows(this.rowsCount, rows);
    }

    /**
     * Inserts several rows at an index. If the model is sorted, the rows are placed at their
     * sorted positions. With more than one row, listeners get a single `rows-reorder` signal
     * instead of one `row-insert` per row.
     *
     * @param {number} index
     * @param {object[]} rows
     */
    insertRows(_index, _rows) {
        throw new Error(`${this.constructor.name} does not implement insertRows().`);
    }

    /**
     * Removes a row.
     *
     * @param {number} index
     * @returns {object} The removed row.
     */
    removeRow(_index) {
        throw new Error(`${this.constructor.name} does not implement removeRow().`);
    }

    /**
     * Removes a row by id.
     *
     * @param {unknown} id
     * @returns {object} The removed row.
     */
    removeRowById(id) {
        return this.removeRow(this.getRowIndexById(id));
    }

    /**
     * Removes all rows.
     */
    removeAllRows() {
        throw new Error(`${this.constructor.name} does not implement removeAllRows().`);
    }

    /**
     * Replaces a row by another row object. The model stays sorted.
     *
     * @param {number} index
     * @param {object} row
     * @returns {number} The index of the new row.
     */
    replaceRow(_index, _row) {
        throw new Error(`${this.constructor.name} does not implement replaceRow().`);
    }

    /**
     * Replaces a row by id.
     *
     * @param {unknown} id
     * @param {object} row
     * @returns {number} The index of the new row.
     */
    replaceRowById(id, row) {
        return this.replaceRow(this.getRowIndexById(id), row);
    }

    /**
     * Changes values of a row: the given columns are assigned to the row object. The model stays
     * sorted, so the row may move.
     *
     * @param {number} index
     * @param {Record<string, unknown>} changes Values by column.
     * @returns {number} The index of the row after the change.
     */
    updateRow(_index, _changes) {
        throw new Error(`${this.constructor.name} does not implement updateRow().`);
    }

    /**
     * Changes values of a row by id.
     *
     * @param {unknown} id
     * @param {Record<string, unknown>} changes
     * @returns {number} The index of the row after the change.
     */
    updateRowById(id, changes) {
        return this.updateRow(this.getRowIndexById(id), changes);
    }

    /**
     * Sets a single value. The model stays sorted, so the row may move.
     *
     * @param {number} index
     * @param {string} column
     * @param {unknown} value
     * @returns {number} The index of the row after the change.
     */
    setCellValue(index, column, value) {
        return this.updateRow(index, { [column]: value });
    }

    /**
     * Sets a single value by row id.
     *
     * @param {unknown} id
     * @param {string} column
     * @param {unknown} value
     * @returns {number} The index of the row after the change.
     */
    setCellValueById(id, column, value) {
        return this.setCellValue(this.getRowIndexById(id), column, value);
    }

    /**
     * Calls a function for every row, in order.
     *
     * @param {(row: object, index: number) => void} method
     * @param {object} [context]
     */
    forEachRow(method, context) {
        this._rows.forEach((row, index) => method.call(context, row, index));
    }

    /**
     * Sorts the model on a column. The model keeps itself sorted when rows change.
     *
     * @param {string | null} column The column, or `null` to stop sorting.
     * @param {number} [order] One of `SortOrder`. `SortOrder.NONE` stops sorting.
     */
    sortByColumn(_column, _order = SortOrder.ASCENDING) {
        throw new Error(`${this.constructor.name} does not implement sortByColumn().`);
    }

    /**
     * Compares two rows on a column, using `columnsInfo`.
     *
     * @param {number} firstIndex
     * @param {number} secondIndex
     * @param {string} column
     * @returns {number} -1, 0 or 1.
     */
    compareRows(firstIndex, secondIndex, column) {
        return this._compareColumn(this.getRow(firstIndex), this.getRow(secondIndex), column);
    }

    /**
     * Compares two rows on a column by row id.
     *
     * @param {unknown} firstId
     * @param {unknown} secondId
     * @param {string} column
     * @returns {number} -1, 0 or 1.
     */
    compareRowsById(firstId, secondId, column) {
        return this._compareColumn(this.getRowById(firstId), this.getRowById(secondId), column);
    }

    /**
     * Compares two values the way the model sorts them. Values that are not values of the type
     * (such as `null`, `undefined` and `NaN`) come after all other values.
     *
     * @param {unknown} first
     * @param {unknown} second
     * @param {string} [type] One of {@link COLUMN_TYPES}.
     * @param {boolean} [caseSensitive]
     * @returns {number} -1, 0 or 1.
     */
    compareValues(first, second, type = 'auto', caseSensitive = true) {
        return this._compareTyped(
            first,
            second,
            type,
            caseSensitive,
            1,
            this._getCollator(caseSensitive)
        );
    }

    /**
     * Returns the info of a column (see `columnsInfo`).
     *
     * @param {string} column
     * @returns {ColumnInfo}
     */
    getColumnInfo(column) {
        return this.columnsInfo[column] || {};
    }

    /**
     * Sets the info of a single column, keeping the other columns' info.
     *
     * @param {string} column
     * @param {ColumnInfo} info
     */
    setColumnInfo(column, info) {
        this.columnsInfo = { ...this.columnsInfo, [column]: info };
    }

    /**
     * Returns the id index, building it when the rows changed.
     *
     * @protected
     * @returns {Map<unknown, number>}
     */
    _getIndexById() {
        const idColumn = this.idColumn;
        if (!idColumn) {
            throw new Error('The model has no id column.');
        }

        if (this._indexDirty || !this._indexById) {
            const index = new Map();
            const rows = this.rows;

            for (let i = 0; i < rows.length; ++i) {
                const id = rows[i][idColumn];
                if (index.has(id)) {
                    throw new Error(`Duplicate row id ${String(id)}.`);
                }

                index.set(id, i);
            }

            this._indexById = index;
            this._indexDirty = false;
        }

        return this._indexById;
    }

    /**
     * Marks the id index as outdated.
     *
     * @protected
     */
    _invalidateIndex() {
        this._indexDirty = true;
    }

    _compareColumn(firstRow, secondRow, column) {
        const info = this.getColumnInfo(column);
        const first = firstRow[column];
        const second = secondRow[column];

        if (info.compare) {
            return Math.sign(info.compare(first, second)) || 0;
        }

        return this.compareValues(first, second, info.type || 'auto', isCaseSensitive(info));
    }

    /**
     * Creates the comparison function of rows for the current sort column and order. Values that
     * are not values always come last, in both orders.
     *
     * @protected
     * @returns {((first: object, second: object) => number) | null}
     */
    _createSortComparator() {
        const column = this.sortColumn;
        if (!column || this.sortOrder === SortOrder.NONE) {
            return null;
        }

        const info = this.getColumnInfo(column);
        const factor = this.sortOrder === SortOrder.DESCENDING ? -1 : 1;

        if (info.compare) {
            const compare = info.compare;

            return (first, second) =>
                factor * (Math.sign(compare(first[column], second[column])) || 0);
        }

        const type = info.type || 'auto';
        const caseSensitive = isCaseSensitive(info);
        const collator = this._getCollator(caseSensitive);

        return (first, second) =>
            this._compareTyped(
                first[column],
                second[column],
                type,
                caseSensitive,
                factor,
                collator
            );
    }

    /**
     * Finds the index where a row goes in the sorted rows: after all rows it is equal to, so
     * sorting stays stable.
     *
     * @protected
     * @param {object[]} rows Sorted rows.
     * @param {object} row
     * @param {(first: object, second: object) => number} compare
     * @returns {number}
     */
    _findInsertIndex(rows, row, compare) {
        let low = 0;
        let high = rows.length;

        while (low < high) {
            const middle = (low + high) >>> 1;

            if (compare(row, rows[middle]) < 0) {
                high = middle;
            } else {
                low = middle + 1;
            }
        }

        return low;
    }

    /**
     * Returns the collator for string comparisons, or `null` to compare by character code.
     *
     * @param {boolean} caseSensitive
     * @returns {Intl.Collator | null}
     */
    _getCollator(caseSensitive) {
        return this.localeAware ? getCollator(getLocaleManager().locale, caseSensitive) : null;
    }

    /**
     * Compares two values of a type, multiplying the result by `factor` (-1 to sort descending).
     * Values that are not values of the type come last, whatever the factor.
     *
     * @param {unknown} first
     * @param {unknown} second
     * @param {string} type
     * @param {boolean} caseSensitive
     * @param {number} factor
     * @param {Intl.Collator | null} collator
     * @returns {number}
     */
    _compareTyped(first, second, type, caseSensitive, factor, collator) {
        let kind = type;

        if (type === 'auto') {
            if (typeof first === 'string' && typeof second === 'string') {
                kind = 'string';
            } else if (first instanceof Date || second instanceof Date) {
                kind = 'date';
            } else if (typeof first === 'boolean' && typeof second === 'boolean') {
                kind = 'boolean';
            } else {
                kind = 'number';
            }
        }

        let a;
        let b;
        let aIsValue;
        let bIsValue;
        let text = false;

        if (NUMBER_TYPES.has(kind)) {
            a = typeof first === 'number' ? first : parseFloat(first);
            b = typeof second === 'number' ? second : parseFloat(second);

            // NaN, infinities, undefined and null are not values.
            aIsValue = Number.isFinite(a);
            bIsValue = Number.isFinite(b);
        } else if (DATE_TYPES.has(kind)) {
            a = toTimestamp(first);
            b = toTimestamp(second);
            aIsValue = Number.isFinite(a);
            bIsValue = Number.isFinite(b);
        } else if (kind === 'bool' || kind === 'boolean') {
            a = first ? 1 : 0;
            b = second ? 1 : 0;
            aIsValue = first !== null && first !== undefined && !Number.isNaN(first);
            bIsValue = second !== null && second !== undefined && !Number.isNaN(second);
        } else {
            // Strings. Numbers are compared as their text, like in the original toolkit.
            text = true;
            aIsValue =
                typeof first === 'string' || (typeof first === 'number' && Number.isFinite(first));
            bIsValue =
                typeof second === 'string' ||
                (typeof second === 'number' && Number.isFinite(second));
            a = aIsValue ? String(first) : '';
            b = bIsValue ? String(second) : '';

            if (!caseSensitive && !collator) {
                a = a.toLowerCase();
                b = b.toLowerCase();
            }
        }

        // Put non-values at the end.
        if (!aIsValue) {
            return bIsValue ? 1 : 0;
        }

        if (!bIsValue) {
            return -1;
        }

        if (text && collator) {
            return factor * Math.sign(collator.compare(a, b));
        }

        return a === b ? 0 : factor * (a < b ? -1 : 1);
    }
}

defineProperties(AbstractModel, {
    /**
     * The rows, in order. Do not modify the array; setting it replaces all rows (the array is
     * copied, the row objects are not).
     */
    rows: {
        signal: false,
        get() {
            return this._rows;
        },
        set(rows) {
            this._setRows(rows);
        },
    },

    /**
     * The number of rows.
     */
    rowsCount: {
        readOnly: true,
        get() {
            return this.rows.length;
        },
    },

    /**
     * Information about columns that helps sorting and filtering, keyed by column name. See
     * {@link ColumnInfo}: e.g. `{ price: { type: 'number' }, name: { caseSensitive: false } }`.
     */
    columnsInfo: {
        value: null,
        get() {
            return this._columnsInfo;
        },
        set(columnsInfo) {
            if (columnsInfo !== null && typeof columnsInfo !== 'object') {
                throw new TypeError('Columns info must be an object.');
            }

            for (const [column, info] of Object.entries(columnsInfo || {})) {
                if (info.type && !COLUMN_TYPES.includes(info.type)) {
                    throw new RangeError(`Unknown type '${info.type}' of column '${column}'.`);
                }
            }

            this._columnsInfo = { ...columnsInfo };
            this._onSortingChange();
        },
    },

    /**
     * The column that identifies rows, or `null`. With an id column, rows can be addressed by
     * id, and selections keep rows selected while they are sorted or filtered. Ids must be
     * unique.
     */
    idColumn: {
        value: null,
        changed() {
            this._invalidateIndex();

            if (this._idColumn) {
                // Validate the ids right away.
                this._getIndexById();
            }
        },
    },

    /**
     * The column the rows are sorted on, or `null`. Setting a column while the order is
     * `SortOrder.NONE` sorts ascending; setting `null` sets the order to `SortOrder.NONE`.
     */
    sortColumn: {
        value: null,
        set(column) {
            this.sortByColumn(
                column,
                !column
                    ? SortOrder.NONE
                    : this.sortOrder === SortOrder.NONE
                      ? SortOrder.ASCENDING
                      : this.sortOrder
            );

            return false;
        },
    },

    /**
     * The sort order: one of `SortOrder`. Setting `SortOrder.NONE` also sets `sortColumn` to
     * `null`.
     */
    sortOrder: {
        value: SortOrder.NONE,
        set(order) {
            this.sortByColumn(order === SortOrder.NONE ? null : this.sortColumn, order);

            return false;
        },
    },

    /**
     * Whether strings are compared with the rules of the current locale (`Intl.Collator`), so
     * `'é'` sorts next to `'e'`. When `false`, strings are compared by character code, like the
     * original toolkit.
     */
    localeAware: {
        value: true,
        changed() {
            this._onSortingChange();
        },
    },
});
