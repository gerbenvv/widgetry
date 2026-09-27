/**
 * @module columns/abstract-column
 */
import { Instance } from '../core/instance.js';
/**
 * What changed about a column, telling the table what to update.
 *
 * @enum {string}
 */
export declare const ColumnChange: Readonly<{
    STRUCTURE: "structure";
    WIDTH: "width";
    HEADER: "header";
    CELLS: "cells";
}>;
/**
 * Base class of table columns. A column renders a header and a cell per row; the table creates
 * and recycles the cell elements, and asks the column to fill them.
 *
 * Columns are plain instances (not widgets): the table lays them out as the tracks of a CSS grid.
 * All rows have the same height, `--wy-row-height` in CSS.
 *
 * A column's width is `width` when set, and otherwise its natural width: the widest of the header
 * and the cells measured so far, like the original toolkit. Columns with `expand` share the extra
 * space. When no column expands, an empty filler column takes it.
 *
 * Signals: the property change signals, `table-change` (`column`) and `destroy`. A destroyed
 * column is removed from its table.
 */
export declare class AbstractColumn extends Instance {
    /** @type {import('../widgets/table.js').Table | null} */
    _table: import('../widgets/table.js').Table | null;
    _contentWidth: number;
    _userResized: boolean;
    _allocatedWidth: number;
    _cellClass: string;
    _initialize(): void;
    /**
     * The model of the table the column is in, or `null`.
     *
     * @type {import('../data/abstract-model.js').AbstractModel | null}
     */
    get model(): import('../data/abstract-model.js').AbstractModel | null;
    /**
     * Whether the column sorts its table when its header is clicked.
     *
     * @type {boolean}
     */
    get isSortable(): boolean;
    /**
     * Whether the table can measure the natural width of the cells (the text of the cells).
     *
     * @type {boolean}
     */
    get isAutoWidth(): boolean;
    /**
     * Returns the text of the cell of a row, used for measuring, type-ahead search and
     * accessibility.
     *
     * @param {object} _row
     * @param {number} _index
     * @returns {string}
     */
    getCellText(_row: object, _index: number): string;
    /**
     * Creates the element of a cell. The table sets its class names.
     *
     * @protected
     * @returns {HTMLElement}
     */
    protected _createCell(): HTMLElement;
    /**
     * Fills a cell for a row. The default shows `getCellText()`.
     *
     * @protected
     * @param {HTMLElement} cell
     * @param {object} row
     * @param {number} index
     */
    protected _renderCell(cell: HTMLElement, row: object, index: number): void;
    /**
     * Shows text in a cell, shortened according to `ellipsize`.
     *
     * @protected
     * @param {HTMLElement} cell
     * @param {string} text
     */
    protected _renderText(cell: HTMLElement, text: string): void;
    /**
     * Returns the class names of a cell.
     *
     * @protected
     * @param {object} row
     * @param {number} index
     * @returns {string}
     */
    protected _getCellClassName(row: object, index: number): string;
    /**
     * Returns the class names of the cells that are specific to the column type.
     *
     * @protected
     * @returns {string}
     */
    protected _getTypeClassName(): string;
    /**
     * Measures the natural width of the content of a cell, without padding.
     *
     * @protected
     * @param {object} row
     * @param {number} index
     * @param {(text: string) => number} measureText
     * @returns {number}
     */
    protected _measureCell(row: object, index: number, measureText: (text: string) => number): number;
    /**
     * Handles a click on a cell, e.g. to toggle a check box.
     *
     * @protected
     * @param {HTMLElement} _cell
     * @param {number} _index
     * @param {MouseEvent} _event
     * @returns {boolean} Whether the click was handled.
     */
    protected _onCellClick(_cell: HTMLElement, _index: number, _event: MouseEvent): boolean;
    /**
     * Handles the Space key on the cursor row. Columns with editable cells toggle them.
     *
     * @protected
     * @param {number} _index
     * @returns {boolean} Whether the key was handled.
     */
    protected _onCellKeyActivate(_index: number): boolean;
    /**
     * Returns the model column the table is sorted on when the header is clicked, or `null`.
     *
     * @protected
     * @returns {string | null}
     */
    protected _getSortKey(): string | null;
    /**
     * Sets the table. Called by the table.
     *
     * @protected
     * @param {import('../widgets/table.js').Table | null} table
     */
    protected _setTable(table: import('../widgets/table.js').Table | null): void;
    /**
     * Tells the table that something changed.
     *
     * @protected
     * @param {string} change One of {@link ColumnChange}.
     */
    protected _invalidate(change: string): void;
    _updateCellClass(): void;
    _ellipsizeMiddle(text: any): any;
}

/** The declared properties of {@link AbstractColumn}. */
export interface AbstractColumn {
    /**
     * The text of the header.
     */
    label: string;
    /**
     * Another name of `label`.
     */
    title: string;
    /**
     * Whether the column is shown.
     */
    visible: boolean;
    /**
     * The width in pixels, or -1 for the natural width. Resizing the column by dragging its
     * header sets this.
     */
    width: number;
    /**
     * The minimum width in pixels, also when resizing.
     */
    minWidth: number;
    /**
     * Whether the column takes a share of the extra width.
     */
    expand: boolean;
    /**
     * Whether the user can resize the column by dragging the right edge of its header.
     */
    resizable: boolean;
    /**
     * The alignment of the cell contents: one of `Justification` (`FILL` is `START`).
     */
    alignment: string;
    /**
     * How text that does not fit is shortened: one of `EllipsizeMode`.
     */
    ellipsize: string;
    /**
     * A function `(row, index, column) => string` returning extra class names for a cell, or
     * `null`. Use it to style cells by their value, e.g. negative numbers in red.
     */
    cellClassName: any;
    /**
     * The table the column is in, or `null`.
     */
    readonly table: any;
}
