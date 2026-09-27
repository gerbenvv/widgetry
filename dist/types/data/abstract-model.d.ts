/**
 * @module data/abstract-model
 */
import { Instance } from '../core/instance.js';
/**
 * The column types `columnsInfo` accepts. `'auto'` detects the type from the values.
 *
 * @type {ReadonlyArray<string>}
 */
export declare const COLUMN_TYPES: ReadonlyArray<string>;
/**
 * Converts a value to a timestamp in milliseconds, or `NaN` if it is not a point in time.
 *
 * @param {unknown} value A `Date`, a timestamp or a date string.
 * @returns {number}
 */
export declare function toTimestamp(value: unknown): number;
export type ColumnInfo = {
    /**
     * One of {@link COLUMN_TYPES}. Defaults to `'auto'`.
     */
    type?: string;
    /**
     * Whether strings are compared case sensitively. Defaults to
     * `true`. The original kebab-case spelling `'case-sensitive'` is accepted as well.
     */
    caseSensitive?: boolean;
    /**
     * A custom comparison of two
     * values, returning a negative number, zero or a positive number. It replaces the type-based
     * comparison.
     */
    compare?: (first: unknown, second: unknown) => number;
};
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
export declare class AbstractModel extends Instance {
    /** @type {object[]} */
    _rows: object[];
    /** @type {Map<unknown, number> | null} */
    _indexById: Map<unknown, number> | null;
    _indexDirty: boolean;
    _columnsInfo: {};
    sortOrder: unknown;
    columnsInfo: any;
    /**
     * @param {Record<string, unknown> | object[]} [properties] Property values, or (like the
     *     original toolkit) the initial rows, followed by the other arguments.
     * @param {string | null} [idColumn] The id column, when the rows are passed as an array.
     * @param {string | null} [sortColumn] The sort column, when the rows are passed as an array.
     * @param {number} [sortOrder] The sort order, when the rows are passed as an array.
     */
    constructor(properties?: Record<string, unknown> | object[], idColumn?: string | null, sortColumn?: string | null, sortOrder?: number);
    _initialize(): void;
    /**
     * Sets several properties. The sort column and order are applied together, so the rows are
     * sorted once.
     *
     * @param {Record<string, unknown>} properties
     * @returns {boolean}
     */
    set(properties: Record<string, unknown>): boolean;
    /**
     * Whether rows have ids (`getRowIdByIndex()`, `getRowIndexById()` and so on work), which is
     * when the model has an id column. Selections select rows by id when they do. Tree models
     * always do: without an id column, a row object is its own id.
     *
     * @type {boolean}
     */
    get hasRowIds(): boolean;
    /**
     * Gets a row.
     *
     * @param {number} index
     * @returns {object}
     * @throws {RangeError} If there is no row at the index.
     */
    getRow(index: number): object;
    /**
     * Gets a row by its id.
     *
     * @param {unknown} id
     * @returns {object}
     * @throws {Error} If there is no id column or no row with the id.
     */
    getRowById(id: unknown): object;
    /**
     * Gets the index of a row by its id.
     *
     * @param {unknown} id
     * @returns {number}
     * @throws {Error} If there is no id column or no row with the id.
     */
    getRowIndexById(id: unknown): number;
    /**
     * Gets the id of the row at an index.
     *
     * @param {number} index
     * @returns {unknown}
     * @throws {Error} If there is no id column or no row at the index.
     */
    getRowIdByIndex(index: number): unknown;
    /**
     * Checks whether there is a row with an id.
     *
     * @param {unknown} id
     * @returns {boolean}
     * @throws {Error} If there is no id column.
     */
    hasRowId(id: unknown): boolean;
    /**
     * Gets a value.
     *
     * @param {number} index The row index.
     * @param {string} column
     * @returns {unknown}
     */
    getCellValue(index: number, column: string): unknown;
    /**
     * Gets a value by row id.
     *
     * @param {unknown} id
     * @param {string} column
     * @returns {unknown}
     */
    getCellValueById(id: unknown, column: string): unknown;
    /**
     * Appends a row. If the model is sorted, the row is placed at its sorted position instead.
     *
     * @param {object} row
     * @returns {number} The index of the new row.
     */
    appendRow(row: object): number;
    /**
     * Prepends a row. If the model is sorted, the row is placed at its sorted position instead.
     *
     * @param {object} row
     * @returns {number} The index of the new row.
     */
    prependRow(row: object): number;
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
    insertRow(_index: any, _row: any): number;
    /**
     * Appends several rows at once. If the model is sorted, the rows are placed at their sorted
     * positions. With more than one row, listeners get a single `rows-reorder` signal instead of
     * one `row-insert` per row.
     *
     * @param {object[]} rows
     */
    appendRows(rows: object[]): void;
    /**
     * Inserts several rows at an index. If the model is sorted, the rows are placed at their
     * sorted positions. With more than one row, listeners get a single `rows-reorder` signal
     * instead of one `row-insert` per row.
     *
     * @param {number} index
     * @param {object[]} rows
     */
    insertRows(_index: any, _rows: any): void;
    /**
     * Removes a row.
     *
     * @param {number} index
     * @returns {object} The removed row.
     */
    removeRow(_index: any): object;
    /**
     * Removes a row by id.
     *
     * @param {unknown} id
     * @returns {object} The removed row.
     */
    removeRowById(id: unknown): object;
    /**
     * Removes all rows.
     */
    removeAllRows(): void;
    /**
     * Replaces a row by another row object. The model stays sorted.
     *
     * @param {number} index
     * @param {object} row
     * @returns {number} The index of the new row.
     */
    replaceRow(_index: any, _row: any): number;
    /**
     * Replaces a row by id.
     *
     * @param {unknown} id
     * @param {object} row
     * @returns {number} The index of the new row.
     */
    replaceRowById(id: unknown, row: object): number;
    /**
     * Changes values of a row: the given columns are assigned to the row object. The model stays
     * sorted, so the row may move.
     *
     * @param {number} index
     * @param {Record<string, unknown>} changes Values by column.
     * @returns {number} The index of the row after the change.
     */
    updateRow(_index: any, _changes: any): number;
    /**
     * Changes values of a row by id.
     *
     * @param {unknown} id
     * @param {Record<string, unknown>} changes
     * @returns {number} The index of the row after the change.
     */
    updateRowById(id: unknown, changes: Record<string, unknown>): number;
    /**
     * Sets a single value. The model stays sorted, so the row may move.
     *
     * @param {number} index
     * @param {string} column
     * @param {unknown} value
     * @returns {number} The index of the row after the change.
     */
    setCellValue(index: number, column: string, value: unknown): number;
    /**
     * Sets a single value by row id.
     *
     * @param {unknown} id
     * @param {string} column
     * @param {unknown} value
     * @returns {number} The index of the row after the change.
     */
    setCellValueById(id: unknown, column: string, value: unknown): number;
    /**
     * Calls a function for every row, in order.
     *
     * @param {(row: object, index: number) => void} method
     * @param {object} [context]
     */
    forEachRow(method: (row: object, index: number) => void, context?: object): void;
    /**
     * Sorts the model on a column. The model keeps itself sorted when rows change.
     *
     * @param {string | null} column The column, or `null` to stop sorting.
     * @param {number} [order] One of `SortOrder`. `SortOrder.NONE` stops sorting.
     */
    sortByColumn(_column: any, _order?: 1): void;
    /**
     * Compares two rows on a column, using `columnsInfo`.
     *
     * @param {number} firstIndex
     * @param {number} secondIndex
     * @param {string} column
     * @returns {number} -1, 0 or 1.
     */
    compareRows(firstIndex: number, secondIndex: number, column: string): number;
    /**
     * Compares two rows on a column by row id.
     *
     * @param {unknown} firstId
     * @param {unknown} secondId
     * @param {string} column
     * @returns {number} -1, 0 or 1.
     */
    compareRowsById(firstId: unknown, secondId: unknown, column: string): number;
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
    compareValues(first: unknown, second: unknown, type?: string, caseSensitive?: boolean): number;
    /**
     * Returns the info of a column (see `columnsInfo`).
     *
     * @param {string} column
     * @returns {ColumnInfo}
     */
    getColumnInfo(column: string): ColumnInfo;
    /**
     * Sets the info of a single column, keeping the other columns' info.
     *
     * @param {string} column
     * @param {ColumnInfo} info
     */
    setColumnInfo(column: string, info: ColumnInfo): void;
    /**
     * Returns the id index, building it when the rows changed.
     *
     * @protected
     * @returns {Map<unknown, number>}
     */
    protected _getIndexById(): Map<unknown, number>;
    /**
     * Marks the id index as outdated.
     *
     * @protected
     */
    protected _invalidateIndex(): void;
    _compareColumn(firstRow: any, secondRow: any, column: any): number;
    /**
     * Creates the comparison function of rows for the current sort column and order. Values that
     * are not values always come last, in both orders.
     *
     * @protected
     * @returns {((first: object, second: object) => number) | null}
     */
    protected _createSortComparator(): ((first: object, second: object) => number) | null;
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
    protected _findInsertIndex(rows: object[], row: object, compare: (first: object, second: object) => number): number;
    /**
     * Returns the collator for string comparisons, or `null` to compare by character code.
     *
     * @param {boolean} caseSensitive
     * @returns {Intl.Collator | null}
     */
    _getCollator(caseSensitive: boolean): Intl.Collator | null;
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
    _compareTyped(first: unknown, second: unknown, type: string, caseSensitive: boolean, factor: number, collator: Intl.Collator | null): number;
}

/** The declared properties of {@link AbstractModel}. */
export interface AbstractModel {
    /**
     * The rows, in order. Do not modify the array; setting it replaces all rows (the array is
     * copied, the row objects are not).
     */
    rows: any;
    /**
     * The number of rows.
     */
    readonly rowsCount: any;
    /**
     * The column that identifies rows, or `null`. With an id column, rows can be addressed by
     * id, and selections keep rows selected while they are sorted or filtered. Ids must be
     * unique.
     */
    idColumn: any;
    /**
     * The column the rows are sorted on, or `null`. Setting a column while the order is
     * `SortOrder.NONE` sorts ascending; setting `null` sets the order to `SortOrder.NONE`.
     */
    sortColumn: any;
    /**
     * Whether strings are compared with the rules of the current locale (`Intl.Collator`), so
     * `'é'` sorts next to `'e'`. When `false`, strings are compared by character code, like the
     * original toolkit.
     */
    localeAware: boolean;
}
