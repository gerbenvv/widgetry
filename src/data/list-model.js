/**
 * @module data/list-model
 */

import { SortOrder } from '../core/enums.js';
import { registerType } from '../core/registry.js';
import { AbstractModel } from './abstract-model.js';

function checkRow(row) {
    if (row === null || typeof row !== 'object') {
        throw new TypeError('A row must be an object.');
    }
}

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
export class ListModel extends AbstractModel {
    insertRow(index, row) {
        checkRow(row);

        const rows = this._rows;
        if (!Number.isInteger(index) || index < 0 || index > rows.length) {
            throw new RangeError(`Invalid row insertion index ${index}.`);
        }

        const idColumn = this.idColumn;
        const id = idColumn ? row[idColumn] : null;
        if (idColumn && this.hasRowId(id)) {
            throw new Error(`Duplicate row id ${String(id)}.`);
        }

        const compare = this._createSortComparator();
        if (compare) {
            index = this._findInsertIndex(rows, row, compare);
        }

        rows.splice(index, 0, row);
        this._afterInsert(index, id);

        return index;
    }

    insertRows(index, newRows) {
        if (!Array.isArray(newRows)) {
            throw new TypeError('Rows must be an array.');
        }

        if (newRows.length === 1) {
            this.insertRow(index, newRows[0]);

            return;
        }

        const rows = this._rows;
        if (!Number.isInteger(index) || index < 0 || index > rows.length) {
            throw new RangeError(`Invalid row insertion index ${index}.`);
        }

        newRows.forEach(checkRow);

        if (!newRows.length) {
            return;
        }

        const updated = [...rows.slice(0, index), ...newRows, ...rows.slice(index)];
        this._validateIds(updated);

        const compare = this._createSortComparator();
        if (compare) {
            // A stable sort keeps the new rows after existing rows they are equal to.
            updated.sort(compare);
        }

        this._rows = updated;
        this._invalidateIndex();

        this.emit('rows-reorder', this);
        this.emit('rows-change', this, 0, updated.length - 1);
    }

    removeRow(index) {
        const row = this.getRow(index);
        const id = this.idColumn ? row[this.idColumn] : null;

        this._rows.splice(index, 1);
        this._invalidateIndex();

        this.emit('row-remove', this, index, id, row);
        this.emit('rows-change', this, index, this._rows.length - 1);

        return row;
    }

    removeAllRows() {
        this._rows = [];
        this._invalidateIndex();

        this.emit('rows-reorder', this);
        this.emit('rows-change', this, 0, -1);
    }

    replaceRow(index, row) {
        checkRow(row);

        const oldRow = this.getRow(index);
        const idColumn = this.idColumn;
        const oldId = idColumn ? oldRow[idColumn] : null;
        const id = idColumn ? row[idColumn] : null;

        if (idColumn && !Object.is(id, oldId) && this.hasRowId(id)) {
            throw new Error(`Duplicate row id ${String(id)}.`);
        }

        this._rows[index] = row;

        return this._afterChange(index, row, Object.keys({ ...oldRow, ...row }), id, oldId);
    }

    updateRow(index, changes) {
        const row = this.getRow(index);
        if (changes === null || typeof changes !== 'object') {
            throw new TypeError('Row changes must be an object.');
        }

        const columns = Object.keys(changes).filter(
            (column) => !Object.is(row[column], changes[column])
        );
        if (!columns.length) {
            return index;
        }

        const idColumn = this.idColumn;
        const oldId = idColumn ? row[idColumn] : null;
        const id = idColumn && columns.includes(idColumn) ? changes[idColumn] : oldId;

        if (idColumn && !Object.is(id, oldId) && this.hasRowId(id)) {
            throw new Error(`Duplicate row id ${String(id)}.`);
        }

        for (const column of columns) {
            row[column] = changes[column];
        }

        return this._afterChange(index, row, columns, id, oldId);
    }

    sortByColumn(column, order = SortOrder.ASCENDING) {
        if (
            order !== SortOrder.NONE &&
            order !== SortOrder.ASCENDING &&
            order !== SortOrder.DESCENDING
        ) {
            throw new RangeError(`Invalid sort order ${order}.`);
        }

        if (!column) {
            column = null;
            order = SortOrder.NONE;
        } else if (order === SortOrder.NONE) {
            column = null;
        }

        const columnChanged = this._sortColumn !== column;
        const orderChanged = this._sortOrder !== order;

        this._sortColumn = column;
        this._sortOrder = order;

        if (columnChanged) {
            this.emit('sort-column-change', this);
        }

        if (orderChanged) {
            this.emit('sort-order-change', this);
        }

        if (columnChanged || orderChanged) {
            this._sortRows();
        }
    }

    _setRows(rows) {
        if (!Array.isArray(rows)) {
            throw new TypeError('Rows must be an array.');
        }

        rows.forEach(checkRow);

        const updated = [...rows];
        this._validateIds(updated);

        const compare = this._createSortComparator();
        if (compare) {
            updated.sort(compare);
        }

        this._rows = updated;
        this._invalidateIndex();

        this.emit('rows-reorder', this);
        this.emit('rows-change', this, 0, updated.length - 1);
    }

    _onSortingChange() {
        this._sortRows();
    }

    _sortRows() {
        const compare = this._createSortComparator();
        if (!compare) {
            return;
        }

        // Array.prototype.sort is stable.
        this._rows.sort(compare);
        this._invalidateIndex();

        this.emit('rows-reorder', this);
        this.emit('rows-change', this, 0, this._rows.length - 1);
    }

    _validateIds(rows) {
        const idColumn = this.idColumn;
        if (!idColumn) {
            return;
        }

        const ids = new Set();
        for (const row of rows) {
            const id = row[idColumn];
            if (ids.has(id)) {
                throw new Error(`Duplicate row id ${String(id)}.`);
            }

            ids.add(id);
        }
    }

    _afterInsert(index, id) {
        this._invalidateIndex();

        this.emit('row-insert', this, index, id);
        this.emit('rows-change', this, index, this._rows.length - 1);
    }

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
    _afterChange(index, row, columns, id, oldId) {
        const rows = this._rows;

        let newIndex = index;
        const compare = this._createSortComparator();
        if (
            compare &&
            (columns.includes(this.sortColumn) || this.getColumnInfo(this.sortColumn).compare)
        ) {
            rows.splice(index, 1);
            newIndex = this._findInsertIndex(rows, row, compare);
            rows.splice(newIndex, 0, row);
        }

        if (newIndex !== index || !Object.is(id, oldId)) {
            this._invalidateIndex();
        }

        if (newIndex !== index) {
            this.emit('row-move', this, index, newIndex, oldId);
        }

        for (const column of columns) {
            this.emit('cell-change', this, newIndex, column);
        }

        this.emit('row-update', this, newIndex, id, oldId);
        this.emit('rows-change', this, Math.min(index, newIndex), Math.max(index, newIndex));

        return newIndex;
    }
}

registerType('list-model', ListModel);
