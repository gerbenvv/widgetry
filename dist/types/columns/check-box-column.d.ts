/**
 * @module columns/check-box-column
 */
import { DataColumn } from './data-column.js';
/**
 * A column that shows boolean values as check boxes.
 *
 * When `editable`, clicking a check box (or pressing Space on the cursor row) toggles the value:
 * the column writes it to the model with `updateRow()` and emits `toggle`.
 *
 * Signals: `toggle` (`column, index, row, active`), where `index` is the row index after the
 * change.
 */
export declare class CheckBoxColumn extends DataColumn {
    /**
     * Toggles the value of a row, as if its check box was clicked. This works when the column is
     * not editable, too.
     *
     * @param {number} index
     * @returns {boolean} The new value.
     */
    toggle(index: number): boolean;
    getCellText(row: any): "" | "✓";
    _createCell(): HTMLElement;
    _renderCell(cell: any, row: any, index: any): void;
    _getTypeClassName(): "wy-table-check-cell" | "wy-table-check-cell wy-editable";
    _measureCell(): number;
    _onCellClick(_cell: any, index: any): boolean;
    _onCellKeyActivate(index: any): boolean;
}

/** The declared properties of {@link CheckBoxColumn}. */
export interface CheckBoxColumn {
    alignment: any;
    ellipsize: any;
    /**
     * Whether clicking a check box toggles the value in the model.
     */
    editable: boolean;
}
