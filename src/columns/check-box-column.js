/**
 * @module columns/check-box-column
 */

import { EllipsizeMode, Justification } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { ColumnChange } from './abstract-column.js';
import { DataColumn } from './data-column.js';

/**
 * The width of the drawn check box, in pixels.
 *
 * @type {number}
 */
const CHECK_SIZE = 13;

/**
 * A column that shows boolean values as check boxes.
 *
 * When `editable`, clicking a check box (or pressing Space on the cursor row) toggles the value:
 * the column writes it to the model with `updateRow()` and emits `toggle`.
 *
 * Signals: `toggle` (`column, index, row, active`), where `index` is the row index after the
 * change.
 */
export class CheckBoxColumn extends DataColumn {
    /**
     * Toggles the value of a row, as if its check box was clicked. This works when the column is
     * not editable, too.
     *
     * @param {number} index
     * @returns {boolean} The new value.
     */
    toggle(index) {
        const model = this.model;
        if (!model || this._name === null) {
            throw new Error('The column is not connected to a model.');
        }

        const row = model.getRow(index);
        const active = !this.getValue(row);

        const newIndex = model.updateRow(index, { [this._name]: active });
        this.emit('toggle', this, newIndex, row, active);

        return active;
    }

    getCellText(row) {
        return this.getValue(row) ? '✓' : '';
    }

    _createCell() {
        const cell = super._createCell();

        const check = document.createElement('span');
        check.className = 'wy-table-check';
        check.setAttribute('role', 'checkbox');
        cell.append(check);

        return cell;
    }

    _renderCell(cell, row, index) {
        if (this._renderer) {
            super._renderCell(cell, row, index);

            return;
        }

        let check = cell.firstElementChild;
        if (!check?.classList.contains('wy-table-check')) {
            // A renderer was used before; restore the check box.
            check = this._createCell().firstElementChild;
            cell.replaceChildren(check);
        }

        const active = Boolean(this.getValue(row));

        check.setAttribute('aria-checked', String(active));
        check.setAttribute('aria-readonly', String(!this._editable));
        check.setAttribute('aria-label', this._label);
        check.classList.toggle('wy-active', active);
    }

    _getTypeClassName() {
        return this._editable ? 'wy-table-check-cell wy-editable' : 'wy-table-check-cell';
    }

    _measureCell() {
        return CHECK_SIZE;
    }

    _onCellClick(_cell, index) {
        if (!this._editable) {
            return false;
        }

        this.toggle(index);

        return true;
    }

    _onCellKeyActivate(index) {
        return this._onCellClick(null, index);
    }
}

defineProperties(CheckBoxColumn, {
    alignment: { value: Justification.CENTER },

    ellipsize: { value: EllipsizeMode.NONE },

    /**
     * Whether clicking a check box toggles the value in the model.
     */
    editable: {
        value: true,
        changed() {
            this._updateCellClass();
            this._invalidate(ColumnChange.CELLS);
        },
    },
});

registerType('check-box-column', CheckBoxColumn);
