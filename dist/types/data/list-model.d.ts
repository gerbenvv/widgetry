/**
 * @module data/list-model
 */
import { AbstractModel } from './abstract-model.js';
/**
 * A model that holds its rows in a list.
 *
 * @example
 * const model = new ListModel({
 *     rows: [{ id: 1, name: 'Stocks' }, { id: 2, name: 'Bonds' }],
 *     idColumn: 'id',
 *     sortColumn: 'name',
 * });
 *
 * model.appendRow({ id: 3, name: 'Indices' }); // Inserted at index 1, sorted by name.
 */
export declare class ListModel extends AbstractModel {
    /**
     * The rows by id, kept up to date when single rows change, so checking ids stays fast.
     *
     * @type {Map<unknown, object> | null}
     */
    _rowsById: Map<unknown, object> | null;
    /** @type {string | null} */
    _rowsByIdColumn: string | null;
    _sortColumn: any;
    _sortOrder: "ascending";
    _initialize(): void;
    hasRowId(id: any): boolean;
    insertRow(index: any, row: any): any;
    insertRows(index: any, newRows: any): void;
    removeRow(index: any): object;
    removeAllRows(): void;
    replaceRow(index: any, row: any): number;
    updateRow(index: any, changes: any): any;
    sortByColumn(column: any, order?: string): void;
    _setRows(rows: any): void;
    _onSortingChange(): void;
    _sortRows(): void;
    _validateIds(rows: any): void;
    /**
     * Returns the rows by id, building the map when the rows were replaced or the id column
     * changed.
     *
     * @returns {Map<unknown, object>}
     */
    _getRowsById(): Map<unknown, object>;
    /**
     * Keeps the rows by id up to date after a single row changed.
     *
     * @param {unknown} oldId The id of a removed or changed row, or `NO_ID` for an inserted row.
     * @param {object | null} row The inserted or changed row, or `null` for a removed row.
     */
    _updateRowsById(oldId: unknown, row: object | null): void;
    _afterInsert(index: any, id: any): void;
    /**
     * Keeps the rows sorted after a row changed, and emits the signals.
     *
     * @param {number} index
     * @param {object} row
     * @param {string[]} columns The changed columns.
     * @param {unknown} id
     * @param {unknown} oldId
     * @returns {number} The new index.
     */
    _afterChange(index: number, row: object, columns: string[], id: unknown, oldId: unknown): number;
}
