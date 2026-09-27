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
    _sortColumn: any;
    _sortOrder: 1;
    insertRow(index: any, row: any): any;
    insertRows(index: any, newRows: any): void;
    removeRow(index: any): object;
    removeAllRows(): void;
    replaceRow(index: any, row: any): number;
    updateRow(index: any, changes: any): any;
    sortByColumn(column: any, order?: 1): void;
    _setRows(rows: any): void;
    _onSortingChange(): void;
    _sortRows(): void;
    _validateIds(rows: any): void;
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
