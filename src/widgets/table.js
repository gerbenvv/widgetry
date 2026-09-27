/**
 * @module widgets/table
 */

import { AbstractColumn, ColumnChange } from '../columns/abstract-column.js';
import { CheckBoxColumn } from '../columns/check-box-column.js';
import { DataColumn, SortIndicator } from '../columns/data-column.js';
import { TextColumn } from '../columns/text-column.js';
import { getCursor } from '../core/cursor.js';
import { CursorShape, SelectionModes, SortOrder } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { settings } from '../core/settings.js';
import { clamp, createElement, uniqueId } from '../core/util.js';
import { AbstractModel } from '../data/abstract-model.js';
import { Adjustment } from '../data/adjustment.js';
import { Selection } from '../data/selection.js';
import { TreeModel } from '../data/tree-model.js';
import { Key } from '../events/constants.js';
import { getLocaleManager } from '../i18n/locale-manager.js';
import { attachDoublePress } from './double-press.js';
import { Widget } from './widget.js';

/**
 * The number of rows rendered above and below the visible rows, so scrolling stays smooth.
 *
 * @type {number}
 */
const ROW_BUFFER = 8;

/**
 * The time in milliseconds after which type-ahead search starts a new search text.
 *
 * @type {number}
 */
const TYPE_AHEAD_TIMEOUT = 1000;

/**
 * The number of rows measured for the natural column widths when a model is set.
 *
 * @type {number}
 */
const INITIAL_MEASURE_ROWS = 200;

/**
 * The maximum number of rows measured when a column is sized to fit (by double clicking the edge
 * of its header).
 *
 * @type {number}
 */
const AUTO_SIZE_ROWS = 20000;

/**
 * The space reserved in a sortable column header for the sort arrow, in pixels.
 *
 * @type {number}
 */
const SORT_ARROW_WIDTH = 14;

/**
 * The distance in pixels the arrow keys scroll horizontally, and resize a column in the header.
 *
 * @type {number}
 */
const HORIZONTAL_STEP = 20;

/**
 * The width of the expander of tree rows, in pixels. Every level is indented by it (plus the
 * `levelIndentation`), like in GTK.
 *
 * @type {number}
 */
const EXPANDER_WIDTH = 16;

/**
 * The `aria-sort` values of sort indicators.
 *
 * @type {Readonly<Record<string, string>>}
 */
const ARIA_SORT = Object.freeze({
    [SortIndicator.NONE]: 'none',
    [SortIndicator.ASCENDING]: 'ascending',
    [SortIndicator.DESCENDING]: 'descending',
});

/**
 * A canvas context shared by all tables to measure text.
 *
 * @type {CanvasRenderingContext2D | null}
 */
let measureContext = null;

/**
 * Measures the width of text in a CSS font.
 *
 * @param {string} text
 * @param {string} font
 * @returns {number}
 */
function measureText(text, font) {
    if (!text) {
        return 0;
    }

    if (!measureContext) {
        measureContext = document.createElement('canvas').getContext('2d');
    }

    if (measureContext.font !== font) {
        measureContext.font = font;
    }

    return Math.ceil(measureContext.measureText(text).width);
}

/**
 * Returns the CSS font of an element's computed style.
 *
 * @param {CSSStyleDeclaration} style
 * @returns {string}
 */
function getFont(style) {
    return (
        style.font ||
        `${style.fontStyle} ${style.fontWeight} ${style.fontSize} / ${style.lineHeight} ${style.fontFamily}`
    );
}

/**
 * Returns the horizontal padding and borders of an element's computed style.
 *
 * @param {CSSStyleDeclaration} style
 * @returns {number}
 */
function getHorizontalFrame(style) {
    return (
        parseFloat(style.paddingLeft) +
        parseFloat(style.paddingRight) +
        parseFloat(style.borderLeftWidth) +
        parseFloat(style.borderRightWidth)
    );
}

/**
 * A table (a tree view without the tree, in GTK terms) that shows the rows of a model in
 * columns, with a header to sort and resize the columns.
 *
 * Only the visible rows (plus a few above and below) have elements, which are reused while
 * scrolling, so tables with hundreds of thousands of rows stay fast. All rows have the same
 * height, the `--wy-row-height` of the theme, which is measured again when the theme changes.
 *
 * Interaction follows GTK: clicking a header sorts on the column (again to reverse), dragging the
 * edge between headers resizes a column and double clicking it sizes the column to fit. Rows are
 * selected by clicking, with Shift for ranges and Control to toggle (depending on
 * `selectionModes`). The keyboard moves the cursor row (the arrows, Page Up, Page Down, Home and
 * End, with Shift to extend the selection and Control to move only the cursor), Space selects the
 * cursor row or toggles its check box, Control+Space toggles its selection, Control+A selects all
 * rows and Enter activates the row. Typing searches the search column. Up on the first row moves
 * the focus to the headers, where Left and Right move between columns, Enter sorts and Shift+Left
 * and Shift+Right resize.
 *
 * With a `TreeModel`, the table is a tree view: the `treeColumn` (by default the first text
 * column) indents the rows by their level and shows expanders, which toggle the rows when
 * clicked (with Shift, recursively). The keyboard follows GTK: Right expands the cursor row or
 * moves to its first child, Left collapses it or moves to its parent, `+` and `-` expand and
 * collapse, `*` expands all rows below, `/` collapses them, Shift+Right and Shift+Left expand and
 * collapse recursively and Backspace moves to the parent. The table then has the ARIA role
 * `treegrid`.
 *
 * Signals: `row-activate` (`table, index, row`) on double click and Enter, `column-add` and
 * `column-remove` (`table, column`), `cursor-change`.
 *
 * @example
 * const table = new Table({ model, selectionModes: SelectionModes.MULTI });
 * table.addColumn(new IndexColumn());
 * table.addColumn(new DateColumn({ name: 'date', label: 'Date', format: 'long-date' }));
 * table.addColumn(new TextColumn({ name: 'name', label: 'Name', expand: true }));
 * table.connect('row-activate', (table, index, row) => open(row));
 */
export class Table extends Widget {
    _initialize() {
        /** @type {AbstractColumn[]} */
        this._columns = [];

        /** @type {AbstractColumn[]} */
        this._visibleColumns = [];

        /**
         * The rendered row elements by row index.
         *
         * @type {Map<number, HTMLElement>}
         */
        this._rowEls = new Map();

        /** @type {HTMLElement[]} */
        this._freeRowEls = [];

        /** @type {Map<AbstractColumn, HTMLElement>} */
        this._headerEls = new Map();

        this._rowHeight = 0;
        this._headerHeight = 0;
        this._cellPadding = 0;
        this._headerPadding = 0;
        this._cellFont = '';
        this._headerFont = '';
        this._metricsDirty = true;

        this._structureDirty = true;
        this._headerDirty = true;
        this._widthsDirty = true;
        this._dirtyAll = true;
        this._dirtyStart = Infinity;
        this._dirtyEnd = -1;
        this._totalWidth = 0;
        this._lastCount = 0;

        this._anchor = -1;
        this._anchorKey = undefined;
        this._cursorKey = undefined;
        this._searchText = '';
        this._searchTime = 0;
        this._pendingScroll = null;
        this._syncingAdjustments = false;
        this._resizing = null;
        this._pressedHeader = null;
        this._rowCounter = 0;
        this._lastResizerPress = null;

        /**
         * The column that shows the tree, when the model is a tree model.
         *
         * @type {AbstractColumn | null}
         */
        this._treeColumnInUse = null;

        super._initialize();

        this._id = uniqueId('wy-table');

        this._selection = new Selection({ modes: SelectionModes.NONE });
        this._selection.connect('change', this._onSelectionChange, this);

        this._hAdjustment = new Adjustment({ stepIncrement: HORIZONTAL_STEP });
        this._vAdjustment = new Adjustment();
        this._hAdjustment.connect('value-change', this._onAdjustmentValueChange, this);
        this._vAdjustment.connect('value-change', this._onAdjustmentValueChange, this);

        /**
         * Measures text in the cell font. Columns use it to shorten text in the middle.
         *
         * @type {(text: string) => number}
         */
        this._measureCellText = (text) => measureText(text, this._cellFont);

        this.el.addEventListener('pointerdown', (event) => this._onPointerDown(event));
        this.el.addEventListener('pointermove', (event) => this._onPointerMove(event));
        this.el.addEventListener('pointerup', (event) => this._onPointerUp(event, false));
        this.el.addEventListener('pointercancel', (event) => this._onPointerUp(event, true));
        this.el.addEventListener('click', (event) => this._onClick(event));
        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));
        this._viewEl.addEventListener('scroll', () => this._onScroll(), { passive: true });

        // Rows are activated on the second press of a double press, counted by the toolkit: the
        // browser's dblclick is not reliable (it may be retargeted, or not sent at all).
        attachDoublePress(this.el, (event) => this._onDoublePress(event), {
            key: (event) => this._getDoublePressRow(event),
        });

        // Measure again when the view is resized, or when the theme changes the row height or
        // fonts (which resizes the probe).
        this._viewObserver = new ResizeObserver(() => this._onViewResize());
        this._viewObserver.observe(this._viewEl);
        this._viewObserver.observe(this._probeRowEl);
        this._viewObserver.observe(this._probeHeaderEl);

        this._themeObserver = new MutationObserver(() => this._onThemeChange());
        this._themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-wy-theme', 'class', 'style'],
        });

        this._disconnectLocale = getLocaleManager().connect(
            'locale-change',
            this._onLocaleChange,
            this
        );

        this._refreshExpand();
        this._queueLayout();
    }

    _render() {
        const element = createElement(`
            <div class="wy-table wy-has-frame wy-alternating" role="grid" aria-rowcount="1">
                <div class="wy-table-view">
                    <div class="wy-table-header" role="row" aria-rowindex="1"></div>
                    <div class="wy-table-body" role="rowgroup"></div>
                </div>
                <div class="wy-table-placeholder" hidden></div>
                <div class="wy-table-probe" aria-hidden="true">
                    <div class="wy-table-header">
                        <div class="wy-table-column-header">
                            <span class="wy-table-column-label">X</span>
                        </div>
                    </div>
                    <div class="wy-table-row"><div class="wy-table-cell">X</div></div>
                </div>
            </div>
        `);

        this._viewEl = element.querySelector('.wy-table-view');
        this._headerEl = this._viewEl.querySelector('.wy-table-header');
        this._bodyEl = element.querySelector('.wy-table-body');
        this._placeholderEl = element.querySelector('.wy-table-placeholder');
        this._probeHeaderEl = element.querySelector('.wy-table-probe .wy-table-column-header');
        this._probeRowEl = element.querySelector('.wy-table-probe .wy-table-row');

        return element;
    }

    /**
     * Adds a column at the end.
     *
     * @param {AbstractColumn} column
     * @returns {AbstractColumn} The column.
     */
    addColumn(column) {
        return this.insertColumn(column, this._columns.length);
    }

    /**
     * Adds a column at the start.
     *
     * @param {AbstractColumn} column
     * @returns {AbstractColumn} The column.
     */
    prependColumn(column) {
        return this.insertColumn(column, 0);
    }

    /**
     * Inserts a column at an index. A column can only be in one table.
     *
     * @param {AbstractColumn} column
     * @param {number} index Between 0 and `columnsCount`.
     * @returns {AbstractColumn} The column.
     */
    insertColumn(column, index) {
        if (!(column instanceof AbstractColumn)) {
            throw new TypeError('Only columns can be added to a table.');
        }

        if (column.table) {
            throw new Error('The column has already been added to a table.');
        }

        if (!Number.isInteger(index) || index < 0 || index > this._columns.length) {
            throw new RangeError(`Invalid column index ${index}.`);
        }

        column._setTable(this);
        column.connect('destroy', this._onColumnDestroy, this);
        this._columns.splice(index, 0, column);

        this._measureColumns([column], this._getSampleIndices());
        this._onColumnsChange();
        this.emit('column-add', this, column);

        return column;
    }

    /**
     * Removes a column.
     *
     * @param {AbstractColumn} column
     * @returns {number} The index the column had.
     * @throws {Error} If the column is not in this table.
     */
    removeColumn(column) {
        const index = this._columns.indexOf(column);
        if (index < 0) {
            throw new Error('The column is not in this table.');
        }

        this._columns.splice(index, 1);
        column.disconnect('destroy', this._onColumnDestroy, this);
        column._setTable(null);

        this._onColumnsChange();
        this.emit('column-remove', this, column);

        return index;
    }

    /**
     * Removes the column at an index.
     *
     * @param {number} index
     * @returns {AbstractColumn} The removed column.
     */
    removeColumnByIndex(index) {
        const column = this.getColumn(index);
        this.removeColumn(column);

        return column;
    }

    /**
     * Removes and destroys all columns, like the original toolkit.
     */
    removeAllColumns() {
        for (const column of [...this._columns].reverse()) {
            this.removeColumn(column);
            column.destroy();
        }
    }

    /**
     * Moves a column to another index.
     *
     * @param {AbstractColumn} column
     * @param {number} index
     */
    reorderColumn(column, index) {
        const oldIndex = this._columns.indexOf(column);
        if (oldIndex < 0) {
            throw new Error('The column is not in this table.');
        }

        this._columns.splice(oldIndex, 1);
        this._columns.splice(clamp(index, 0, this._columns.length), 0, column);

        this._onColumnsChange();
    }

    /**
     * Returns the column at an index.
     *
     * @param {number} index
     * @returns {AbstractColumn}
     * @throws {RangeError} If there is no such column.
     */
    getColumn(index) {
        const column = this._columns[index];
        if (!column) {
            throw new RangeError(`There is no column at index ${index}.`);
        }

        return column;
    }

    /**
     * Returns the index of a column, or -1.
     *
     * @param {AbstractColumn} column
     * @returns {number}
     */
    indexOfColumn(column) {
        return this._columns.indexOf(column);
    }

    /**
     * Returns the first data column showing a model column, or `null`.
     *
     * @param {string} name
     * @returns {DataColumn | null}
     */
    getColumnByName(name) {
        return (
            this._columns.find((column) => column instanceof DataColumn && column.name === name) ||
            null
        );
    }

    /**
     * Sizes a column to fit its header and its cells (at most the first rows and the rendered
     * rows are measured, for large models).
     *
     * @param {AbstractColumn} column
     */
    autoSizeColumn(column) {
        if (!this._columns.includes(column)) {
            throw new Error('The column is not in this table.');
        }

        this._measureMetrics();

        const count = Math.min(this.model?.rowsCount || 0, AUTO_SIZE_ROWS);
        const indices = [...Array(count).keys(), ...this._rowEls.keys()];

        const measure = this._measureCellText;
        let content = 0;
        for (const index of new Set(indices)) {
            const row = this.model.getRow(index);

            content = Math.max(
                content,
                column._measureCell(row, index, measure) + this._getTreeIndent(column, row)
            );
        }

        column._userResized = false;
        column.width = Math.max(
            column.minWidth,
            this._getHeaderWidth(column),
            content + this._cellPadding
        );
    }

    /**
     * Scrolls a row into view.
     *
     * @param {number} index
     * @param {'start' | 'center' | 'end' | null} [align] Where to show the row; by default the
     *     table scrolls as little as possible.
     */
    scrollToRow(index, align = null) {
        const count = this.model?.rowsCount || 0;
        if (!Number.isInteger(index) || index < 0 || index >= count) {
            throw new RangeError(`There is no row at index ${index}.`);
        }

        if (!this._rowHeight || !this._viewEl.clientHeight) {
            // Not laid out yet; scroll once it is.
            this._pendingScroll = { index, align };
            this._queueLayout();

            return;
        }

        const height = this._rowHeight;
        const top = index * height;
        const view = this._viewEl;
        const page = Math.max(height, view.clientHeight - this._headerHeight);

        let scrollTop = view.scrollTop;
        if (align === 'start') {
            scrollTop = top;
        } else if (align === 'end') {
            scrollTop = top + height - page;
        } else if (align === 'center') {
            scrollTop = top - (page - height) / 2;
        } else if (top < scrollTop) {
            scrollTop = top;
        } else if (top + height > scrollTop + page) {
            scrollTop = top + height - page;
        }

        if (scrollTop !== view.scrollTop) {
            view.scrollTop = Math.max(0, scrollTop);
            this._renderRows();
        }
    }

    /**
     * Returns the index of the row at a point, or -1.
     *
     * @param {number} x The page x coordinate.
     * @param {number} y The page y coordinate.
     * @returns {number}
     */
    getRowAtPosition(x, y) {
        const clientX = x - window.scrollX;
        const clientY = y - window.scrollY;
        const view = this._viewEl.getBoundingClientRect();

        if (
            !this._rowHeight ||
            clientX < view.left ||
            clientX >= view.right ||
            clientY < view.top + this._headerHeight ||
            clientY >= view.bottom
        ) {
            return -1;
        }

        const index = Math.floor(
            (clientY - this._bodyEl.getBoundingClientRect().top) / this._rowHeight
        );

        return index >= 0 && index < (this.model?.rowsCount || 0) ? index : -1;
    }

    /**
     * Activates a row, as if it was double clicked: emits `row-activate`.
     *
     * @param {number} index
     */
    activateRow(index) {
        const row = this._requireModel().getRow(index);

        this.emit('row-activate', this, index, row);
    }

    destroy() {
        this._viewObserver.disconnect();
        this._themeObserver.disconnect();
        this._disconnectLocale();

        if (this._resizing) {
            getCursor().popShape('table-resize');
            this._resizing = null;
        }

        this._connectModel(null);

        // Like the original toolkit, the table owns its columns.
        for (const column of [...this._columns]) {
            column.disconnect('destroy', this._onColumnDestroy, this);
            column._setTable(null);
            column.destroy();
        }

        this._columns = [];

        this._selection.destroy();
        this._hAdjustment.destroy();
        this._vAdjustment.destroy();

        super.destroy();
    }

    _updateLayout() {
        if (this.destroyed) {
            return;
        }

        if (this._metricsDirty) {
            this._measureMetrics();
        }

        if (this._structureDirty) {
            this._buildStructure();
        }

        if (this._headerDirty) {
            this._updateHeaders();
        }

        if (this._widthsDirty) {
            this._updateWidths();
        }

        this._renderRows();
    }

    _requireModel() {
        if (!this._model) {
            throw new Error('The table has no model.');
        }

        return this._model;
    }

    /**
     * Measures the row height, header height, fonts and paddings from the probe elements.
     *
     * @returns {boolean} Whether the metrics are known (the table is rendered).
     */
    _measureMetrics() {
        const rowHeight = this._probeRowEl.getBoundingClientRect().height;
        if (!rowHeight) {
            return false;
        }

        this._metricsDirty = false;

        const cellStyle = getComputedStyle(this._probeRowEl.firstElementChild);
        const headerStyle = getComputedStyle(this._probeHeaderEl);

        const metrics = {
            rowHeight,
            headerHeight: this._probeHeaderEl.parentElement.getBoundingClientRect().height,
            cellFont: getFont(cellStyle),
            headerFont: getFont(getComputedStyle(this._probeHeaderEl.firstElementChild)),
            cellPadding: getHorizontalFrame(cellStyle),
            headerPadding: getHorizontalFrame(headerStyle),
        };

        const changed =
            metrics.rowHeight !== this._rowHeight ||
            metrics.headerHeight !== this._probeHeaderHeight ||
            metrics.cellFont !== this._cellFont ||
            metrics.headerFont !== this._headerFont ||
            metrics.cellPadding !== this._cellPadding ||
            metrics.headerPadding !== this._headerPadding;

        if (!changed) {
            return true;
        }

        this._rowHeight = metrics.rowHeight;
        this._probeHeaderHeight = metrics.headerHeight;
        this._headerHeight = this._headerVisible ? metrics.headerHeight : 0;
        this._cellFont = metrics.cellFont;
        this._headerFont = metrics.headerFont;
        this._cellPadding = metrics.cellPadding;
        this._headerPadding = metrics.headerPadding;

        this.el.style.setProperty('--wy-table-header-height', `${this._headerHeight}px`);

        // Text widths depend on the fonts: measure again.
        this._resetContentWidths();
        this._dirtyAll = true;

        return true;
    }

    _getSampleIndices() {
        const count = Math.min(this.model?.rowsCount || 0, INITIAL_MEASURE_ROWS);

        return [...new Set([...Array(count).keys(), ...this._rowEls.keys()])];
    }

    _resetContentWidths() {
        for (const column of this._columns) {
            column._contentWidth = 0;
        }

        this._measureColumns(this._columns, this._getSampleIndices());
    }

    /**
     * Grows the measured content widths of auto-width columns to fit the given rows.
     *
     * @param {AbstractColumn[]} columns
     * @param {Iterable<number>} indices
     * @returns {boolean} Whether a width grew.
     */
    _measureColumns(columns, indices) {
        const model = this.model;
        if (!model || !this._cellFont) {
            return false;
        }

        const autoColumns = columns.filter((column) => column.visible && column.isAutoWidth);
        if (!autoColumns.length) {
            return false;
        }

        const measure = this._measureCellText;
        const count = model.rowsCount;

        let grown = false;
        for (const index of indices) {
            if (index >= count) {
                continue;
            }

            const row = model.getRow(index);

            for (const column of autoColumns) {
                const width =
                    column._measureCell(row, index, measure) + this._getTreeIndent(column, row);
                if (width > column._contentWidth) {
                    column._contentWidth = width;
                    grown = true;
                }
            }
        }

        if (grown) {
            this._widthsDirty = true;
        }

        return grown;
    }

    /**
     * Returns the width of the indentation and expander of the tree column in a row, or 0 for
     * other columns.
     *
     * @param {AbstractColumn} column
     * @param {object} row
     * @returns {number}
     */
    _getTreeIndent(column, row) {
        if (column !== this._treeColumnInUse || !(this.model instanceof TreeModel)) {
            return 0;
        }

        const expander = this._showExpanders ? EXPANDER_WIDTH : 0;

        return this.model.getDepth(row) * (this._levelIndentation + expander) + expander;
    }

    /**
     * Returns the column that shows the tree: the `treeColumn`, or the first text column (or else
     * the first column). Only tree models have one.
     *
     * @returns {AbstractColumn | null}
     */
    _findTreeColumn() {
        if (!(this._model instanceof TreeModel)) {
            return null;
        }

        const columns = this._visibleColumns;
        if (this._treeColumn && columns.includes(this._treeColumn)) {
            return this._treeColumn;
        }

        return columns.find((column) => column instanceof TextColumn) || columns[0] || null;
    }

    _getHeaderWidth(column) {
        const label = measureText(column.label, this._headerFont);

        return Math.ceil(label + this._headerPadding + (column.isSortable ? SORT_ARROW_WIDTH : 0));
    }

    _onColumnsChange() {
        this._structureDirty = true;
        this._widthsDirty = true;
        this._queueLayout();
    }

    /**
     * Creates the header cells and drops the row elements, whose cells no longer match.
     */
    _buildStructure() {
        this._structureDirty = false;
        this._visibleColumns = this._columns.filter((column) => column.visible);
        this._treeColumnInUse = this._findTreeColumn();

        this._headerEls.clear();
        this._headerEl.replaceChildren();

        this._visibleColumns.forEach((column, index) => {
            const cell = createElement(`
                <div class="wy-table-column-header" role="columnheader" tabindex="-1">
                    <span class="wy-table-column-label"></span>
                    <span class="wy-table-sort-arrow" aria-hidden="true"></span>
                    <div class="wy-table-resizer" aria-hidden="true"></div>
                </div>
            `);
            cell.setAttribute('aria-colindex', String(index + 1));
            cell.wyColumn = column;

            this._headerEls.set(column, cell);
            this._headerEl.append(cell);
        });

        this._fillerEl = createElement(
            '<div class="wy-table-column-header wy-filler" aria-hidden="true"></div>'
        );
        this._headerEl.append(this._fillerEl);

        this._rowEls.clear();
        this._freeRowEls = [];
        this._bodyEl.replaceChildren();

        this.el.setAttribute('aria-colcount', String(this._visibleColumns.length));
        this.el.setAttribute('role', this._treeColumnInUse ? 'treegrid' : 'grid');
        this.el.classList.toggle('wy-tree', Boolean(this._treeColumnInUse));

        this._headerDirty = true;
        this._widthsDirty = true;
        this._dirtyAll = true;
    }

    _updateHeaders() {
        this._headerDirty = false;

        for (const [column, cell] of this._headerEls) {
            const indicator =
                column instanceof DataColumn ? column.sortIndicator : SortIndicator.NONE;

            cell.firstElementChild.textContent = column.label;
            cell.title = column.label;
            cell.className =
                `wy-table-column-header wy-align-${column.alignment}` +
                (column.isSortable ? ' wy-sortable' : '') +
                (column.resizable ? ' wy-resizable' : '') +
                (indicator !== SortIndicator.NONE ? ` wy-sorted wy-sort-${indicator}` : '') +
                (this._pressedHeader?.cell === cell && this._pressedHeader.inside
                    ? ' wy-pressed'
                    : '');

            if (column.isSortable) {
                cell.setAttribute('aria-sort', ARIA_SORT[indicator]);
            } else {
                cell.removeAttribute('aria-sort');
            }
        }
    }

    _updateWidths() {
        this._widthsDirty = false;

        const columns = this._visibleColumns;
        const tracks = [];
        let total = 0;
        let expands = false;

        for (const column of columns) {
            let width = column.width;
            if (width < 0) {
                width = Math.max(
                    this._getHeaderWidth(column),
                    column._contentWidth + this._cellPadding
                );
            }

            width = Math.max(width, column.minWidth);
            total += width;

            if (column.expand && !column._userResized) {
                expands = true;
                tracks.push(`minmax(${width}px, 1fr)`);
            } else {
                tracks.push(`${width}px`);
            }

            column._allocatedWidth = width;
        }

        // Without an expanding column, an empty filler column takes the extra space.
        if (!expands) {
            tracks.push('minmax(0, 1fr)');
        }

        this._fillerEl.hidden = expands;
        this._totalWidth = total;

        this.el.style.setProperty('--wy-table-columns', tracks.join(' '));
        this._headerEl.style.minWidth = `${total}px`;
        this._bodyEl.style.minWidth = `${total}px`;

        // Expanding columns may get more; read the real widths once laid out, for shortening text in
        // the middle.
        if (expands && columns.some((column) => column.ellipsize === 'middle')) {
            for (const column of columns) {
                const cell = this._headerEls.get(column);
                column._allocatedWidth = cell
                    ? cell.getBoundingClientRect().width
                    : column._allocatedWidth;
            }

            this._dirtyAll = true;
        }
    }

    _invalidateRows(start, end) {
        this._dirtyStart = Math.min(this._dirtyStart, start);
        this._dirtyEnd = Math.max(this._dirtyEnd, end);
        this._queueLayout();
    }

    /**
     * Renders the rows in view, reusing the elements of rows that scrolled out of view.
     */
    _renderRows() {
        if (this.destroyed || this._structureDirty) {
            return;
        }

        const model = this.model;
        const count = model ? model.rowsCount : 0;
        const height = this._rowHeight;

        this._bodyEl.style.height = `${count * height}px`;
        this.el.setAttribute('aria-rowcount', String(count + 1));

        const placeholder = !count && Boolean(this._placeholderText);
        this._placeholderEl.hidden = !placeholder;
        this._placeholderEl.textContent = this._placeholderText;

        if (!height) {
            return;
        }

        const view = this._viewEl;
        const scrollTop = view.scrollTop;
        const bodyHeight = Math.max(0, view.clientHeight - this._headerHeight);

        const first = Math.max(0, Math.floor(scrollTop / height) - ROW_BUFFER);
        const last = Math.min(count - 1, Math.ceil((scrollTop + bodyHeight) / height) + ROW_BUFFER);

        for (const [index, element] of this._rowEls) {
            if (index < first || index > last) {
                this._rowEls.delete(index);

                element.hidden = true;
                element.wyIndex = -1;
                this._freeRowEls.push(element);
            }
        }

        const added = [];
        for (let index = first; index <= last; ++index) {
            let element = this._rowEls.get(index);

            if (!element) {
                element = this._freeRowEls.pop() || this._createRowElement();
                element.hidden = false;

                this._rowEls.set(index, element);
                this._bindRow(element, index);
                added.push(index);
            } else if (this._dirtyAll || (index >= this._dirtyStart && index <= this._dirtyEnd)) {
                this._bindRow(element, index);
            }
        }

        this._dirtyAll = false;
        this._dirtyStart = Infinity;
        this._dirtyEnd = -1;

        // The number of rows changes the width of index columns.
        const measured = count !== this._lastCount ? [...this._rowEls.keys()] : added;
        this._lastCount = count;

        if (this._measureColumns(this._visibleColumns, measured)) {
            this._updateWidths();

            if (this._dirtyAll) {
                this._dirtyAll = false;
                for (const [index, element] of this._rowEls) {
                    this._bindRow(element, index);
                }
            }
        }

        this._updateActiveDescendant();
        this._syncAdjustments();

        if (this._pendingScroll && view.clientHeight) {
            const { index, align } = this._pendingScroll;
            this._pendingScroll = null;

            if (index < count) {
                this.scrollToRow(index, align);
            }
        }
    }

    _createRowElement() {
        const element = document.createElement('div');
        element.className = 'wy-table-row';
        element.id = `${this._id}-row-${++this._rowCounter}`;
        element.setAttribute('role', 'row');

        for (const column of this._visibleColumns) {
            const cell =
                column === this._treeColumnInUse
                    ? this._createTreeCell(column)
                    : column._createCell();

            cell.classList.add('wy-table-cell');
            element.append(cell);
        }

        this._bodyEl.append(element);

        return element;
    }

    /**
     * Creates the cell of the tree column: an expander and the cell of the column.
     *
     * @param {AbstractColumn} column
     * @returns {HTMLElement}
     */
    _createTreeCell(column) {
        const cell = createElement(`
            <div role="gridcell">
                <span class="wy-table-expander" aria-hidden="true"></span>
            </div>
        `);

        const content = column._createCell();
        content.removeAttribute('role');
        content.className = 'wy-table-tree-content';
        cell.append(content);

        cell.wyExpander = cell.firstElementChild;
        cell.wyContent = content;

        return cell;
    }

    _bindRow(element, index) {
        const row = this.model.getRow(index);
        const selected = this._selection.isSelected(index);
        const tree = this._treeColumnInUse;
        const info = tree ? this.model._getRowInfo(row) : null;

        element.wyIndex = index;
        element.style.transform = `translateY(${index * this._rowHeight}px)`;
        element.setAttribute('aria-rowindex', String(index + 2));
        element.className = this._getRowClassName(index, selected);

        if (this._selectionModes) {
            element.setAttribute('aria-selected', String(selected));
        } else {
            element.removeAttribute('aria-selected');
        }

        if (info) {
            element.setAttribute('aria-level', String(info.level));
            element.setAttribute('aria-setsize', String(info.size));
            element.setAttribute('aria-posinset', String(info.position));

            if (info.expandable) {
                element.setAttribute('aria-expanded', String(info.expanded));
            } else {
                element.removeAttribute('aria-expanded');
            }

            if (info.loading) {
                element.setAttribute('aria-busy', 'true');
            } else {
                element.removeAttribute('aria-busy');
            }
        }

        const cells = element.children;
        this._visibleColumns.forEach((column, columnIndex) => {
            const cell = cells[columnIndex];
            let className = column._getCellClassName(row, index);

            if (column === tree) {
                className += ' wy-table-tree-cell';
            }

            if (cell.wyClassName !== className) {
                cell.wyClassName = className;
                cell.className = className;
            }

            if (column === tree) {
                this._renderTreeCell(cell, info);
                column._renderCell(cell.wyContent, row, index);
            } else {
                column._renderCell(cell, row, index);
            }
        });
    }

    /**
     * Shows the indentation and the expander of a row in its tree cell.
     *
     * @param {HTMLElement} cell
     * @param {import('../data/tree-model.js').TreeRowInfo} info
     */
    _renderTreeCell(cell, info) {
        const expander = this._showExpanders ? EXPANDER_WIDTH : 0;
        const indent = `${(info.level - 1) * (this._levelIndentation + expander)}px`;

        if (cell.wyIndent !== indent) {
            cell.wyIndent = indent;
            cell.style.setProperty('--wy-table-indent', indent);
        }

        let className = 'wy-table-expander';
        if (!info.expandable) {
            className += ' wy-leaf';
        } else if (info.expanded) {
            className += ' wy-expanded';
        }

        if (info.loading) {
            className += ' wy-loading';
        }

        if (cell.wyExpander.className !== className) {
            cell.wyExpander.className = className;
        }
    }

    _getRowClassName(index, selected) {
        return (
            'wy-table-row' +
            (index & 1 ? ' wy-odd' : '') +
            (selected ? ' wy-selected' : '') +
            (index === this._cursor ? ' wy-cursor' : '')
        );
    }

    /**
     * Updates the selected and cursor states of the rendered rows.
     */
    _updateRowStates() {
        const count = this.model?.rowsCount || 0;

        for (const [index, element] of this._rowEls) {
            // Rows past the end are released by the next render.
            if (index >= count) {
                continue;
            }

            const selected = this._selection.isSelected(index);

            element.className = this._getRowClassName(index, selected);

            if (this._selectionModes) {
                element.setAttribute('aria-selected', String(selected));
            }
        }

        this._updateActiveDescendant();
    }

    _updateActiveDescendant() {
        const element = this._cursor >= 0 ? this._rowEls.get(this._cursor) : null;

        if (element) {
            this.el.setAttribute('aria-activedescendant', element.id);
        } else {
            this.el.removeAttribute('aria-activedescendant');
        }
    }

    _syncAdjustments() {
        const view = this._viewEl;
        const count = this.model?.rowsCount || 0;
        const page = Math.max(0, view.clientHeight - this._headerHeight);

        this._syncingAdjustments = true;
        try {
            this._vAdjustment.set({
                lower: 0,
                upper: count * this._rowHeight,
                pageSize: page,
                stepIncrement: this._rowHeight,
                pageIncrement: Math.max(this._rowHeight, page - this._rowHeight),
                value: view.scrollTop,
            });

            this._hAdjustment.set({
                lower: 0,
                upper: Math.max(view.clientWidth, this._totalWidth),
                pageSize: view.clientWidth,
                pageIncrement: view.clientWidth,
                value: view.scrollLeft,
            });
        } finally {
            this._syncingAdjustments = false;
        }
    }

    _onAdjustmentValueChange(adjustment) {
        if (this._syncingAdjustments) {
            return;
        }

        if (adjustment === this._vAdjustment) {
            this._viewEl.scrollTop = adjustment.value;
        } else {
            this._viewEl.scrollLeft = adjustment.value;
        }

        this._renderRows();
    }

    _onScroll() {
        this._renderRows();
    }

    _onViewResize() {
        if (this.destroyed) {
            return;
        }

        this._metricsDirty = true;
        this._updateLayout();
    }

    _onThemeChange() {
        this._metricsDirty = true;
        this._queueLayout();
    }

    _onLocaleChange() {
        // Formatted values and their widths depend on the locale.
        this._resetContentWidths();
        this._widthsDirty = true;
        this._dirtyAll = true;
        this._queueLayout();
    }

    _onColumnChange(column, change) {
        switch (change) {
            case ColumnChange.STRUCTURE:
                this._measureColumns([column], this._getSampleIndices());
                this._onColumnsChange();
                break;

            case ColumnChange.WIDTH:
                this._measureColumns([column], this._getSampleIndices());
                this._widthsDirty = true;
                break;

            case ColumnChange.HEADER:
                this._headerDirty = true;
                this._widthsDirty = true;
                break;

            default:
                this._measureColumns([column], this._getSampleIndices());
                this._dirtyAll = true;
                break;
        }

        this._queueLayout();
    }

    _onColumnDestroy(column) {
        if (this._columns.includes(column)) {
            this.removeColumn(column);
        }
    }

    _connectModel(model) {
        const old = this._model;
        if (old) {
            old.disconnect('rows-change', this._onModelRowsChange, this);
            old.disconnect('row-insert', this._onModelRowInsert, this);
            old.disconnect('row-remove', this._onModelRowRemove, this);
            old.disconnect('row-move', this._onModelRowMove, this);
            old.disconnect('rows-reorder', this._onModelRowsReorder, this);
            old.disconnect('sort-column-change', this._onModelSortChange, this);
            old.disconnect('sort-order-change', this._onModelSortChange, this);
            old.disconnect('destroy', this._onModelDestroy, this);
        }

        this._model = model;

        if (model) {
            model.connect('rows-change', this._onModelRowsChange, this);
            model.connect('row-insert', this._onModelRowInsert, this);
            model.connect('row-remove', this._onModelRowRemove, this);
            model.connect('row-move', this._onModelRowMove, this);
            model.connect('rows-reorder', this._onModelRowsReorder, this);
            model.connect('sort-column-change', this._onModelSortChange, this);
            model.connect('sort-order-change', this._onModelSortChange, this);
            model.connect('destroy', this._onModelDestroy, this);
        }

        if (!this._selection.destroyed) {
            this._selection.model = model;
        }
    }

    _onModelRowsChange(_model, start, end) {
        this._invalidateRows(start, end < start ? Infinity : end);
    }

    /**
     * Moves the cursor and the selection anchor along with a row change.
     *
     * @param {(index: number) => number} map Returns the new index of a row.
     */
    _followRows(map) {
        const count = this.model?.rowsCount || 0;

        if (this._anchor >= 0) {
            this._anchor = clamp(map(this._anchor), -1, count - 1);
            this._rememberAnchorKey();
        }

        if (this._cursor >= 0) {
            this.cursor = clamp(map(this._cursor), -1, count - 1);
        }
    }

    _onModelRowInsert(_model, index) {
        this._followRows((x) => (x >= index ? x + 1 : x));
    }

    _onModelRowRemove(model, index, id) {
        const cursorRemoved = index === this._cursor;

        this._followRows((x) => (x > index ? x - 1 : x));

        // In a tree, the cursor moves from a row that was hidden to its collapsed ancestor, like
        // in GTK.
        if (cursorRemoved && model instanceof TreeModel) {
            const nearest = model.getNearestRowIndex(id);
            if (nearest >= 0) {
                this.cursor = nearest;
            }
        }
    }

    _onModelRowMove(_model, from, to) {
        this._followRows((x) => {
            if (x === from) {
                return to;
            }

            if (from < to && x > from && x <= to) {
                return x - 1;
            }

            return to < from && x >= to && x < from ? x + 1 : x;
        });
    }

    _onModelRowsReorder() {
        // With ids, the cursor and anchor stay on their rows; otherwise at their index.
        const cursor = this._findKey(this._cursorKey, this._cursor);
        const anchor = this._findKey(this._anchorKey, this._anchor);

        this._anchor = anchor;
        this._rememberAnchorKey();
        this.cursor = cursor;

        this._resetContentWidths();
        this._widthsDirty = true;
        this._dirtyAll = true;
        this._queueLayout();
    }

    _findKey(key, index) {
        const count = this.model?.rowsCount || 0;

        if (index < 0) {
            return -1;
        }

        if (this._selection.byId && key !== undefined) {
            const found = this._selection.getIndex(key);

            // In a tree, a hidden row is represented by its nearest shown ancestor.
            return found < 0 && this.model instanceof TreeModel
                ? this.model.getNearestRowIndex(key)
                : found;
        }

        return Math.min(index, count - 1);
    }

    _rememberAnchorKey() {
        this._anchorKey =
            this._anchor >= 0 && this._selection.byId
                ? this.model.getRowIdByIndex(this._anchor)
                : undefined;
    }

    _onModelSortChange() {
        this._headerDirty = true;
        this._queueLayout();
    }

    _onModelDestroy() {
        this.model = null;
    }

    _onSelectionChange() {
        this._updateRowStates();
    }

    /**
     * Handles a press on a row, selecting according to the selection modes.
     *
     * @param {number} index
     * @param {boolean} extend Whether to select a range from the anchor (Shift).
     * @param {boolean} toggle Whether to toggle the row (Control).
     */
    _pressRow(index, extend, toggle) {
        const modes = this._selectionModes;
        const selection = this._selection;

        this.cursor = index;

        if (!modes) {
            return;
        }

        if (modes & SelectionModes.MULTI) {
            if (extend && this._anchor >= 0) {
                selection.selectRange(this._anchor, index, toggle);

                return;
            }

            if (toggle || modes & SelectionModes.TOGGLE) {
                selection.toggle(index);
            } else {
                selection.selectOnly(index);
            }
        } else if ((toggle || modes & SelectionModes.TOGGLE) && selection.isSelected(index)) {
            selection.unselectAll();
        } else {
            selection.selectOnly(index);
        }

        this._anchor = index;
        this._rememberAnchorKey();
    }

    /**
     * Moves the cursor with the keyboard.
     *
     * @param {number} index
     * @param {boolean} extend Whether to extend the selection from the anchor (Shift).
     * @param {boolean} cursorOnly Whether to move only the cursor (Control).
     */
    _moveCursor(index, extend, cursorOnly) {
        const count = this.model?.rowsCount || 0;
        if (!count) {
            return;
        }

        index = clamp(index, 0, count - 1);

        if (extend && this._selectionModes & SelectionModes.MULTI) {
            if (this._anchor < 0) {
                this._anchor = this._cursor >= 0 ? this._cursor : index;
                this._rememberAnchorKey();
            }

            this.cursor = index;
            this._selection.selectRange(this._anchor, index, cursorOnly);
        } else if (cursorOnly) {
            this.cursor = index;
        } else {
            this.cursor = index;

            if (this._selectionModes) {
                this._selection.selectOnly(index);
            }

            this._anchor = index;
            this._rememberAnchorKey();
        }

        this.scrollToRow(index);
    }

    _getRowIndex(target) {
        const element = target instanceof Element ? target.closest('.wy-table-row') : null;

        return element && element.parentElement === this._bodyEl && element.wyIndex >= 0
            ? element.wyIndex
            : -1;
    }

    _getCellColumn(target) {
        const cell = target instanceof Element ? target.closest('.wy-table-cell') : null;
        const element = cell?.parentElement;

        if (!element || element.parentElement !== this._bodyEl) {
            return null;
        }

        const column = this._visibleColumns[Array.prototype.indexOf.call(element.children, cell)];

        return column ? { cell, column } : null;
    }

    _onPointerDown(event) {
        const header = event.target.closest?.('.wy-table-column-header');
        if (header && this._headerEl.contains(header)) {
            this._onHeaderPointerDown(event, header);

            return;
        }

        const index = this._getRowIndex(event.target);
        if (index < 0 || (event.button !== 0 && event.button !== 2)) {
            return;
        }

        // Pressing an expander toggles the row on click, without selecting it.
        if (event.button === 0 && event.target.closest('.wy-table-expander')) {
            return;
        }

        const toggle = event.ctrlKey || event.metaKey;

        if (event.button === 2) {
            // Keep a selection for context menus.
            if (!this._selection.isSelected(index)) {
                this._pressRow(index, false, false);
            } else {
                this.cursor = index;
            }

            return;
        }

        this._pressRow(index, event.shiftKey, toggle);
    }

    _onHeaderPointerDown(event, header) {
        const column = header.wyColumn;
        if (event.button !== 0 || !column) {
            return;
        }

        if (event.target.closest('.wy-table-resizer') && column.resizable) {
            event.preventDefault();

            // A double press sizes the column to fit.
            const last = this._lastResizerPress;
            const now = event.timeStamp;
            this._lastResizerPress = { column, time: now };

            if (last?.column === column && now - last.time <= settings.multiplePressInterval) {
                this._lastResizerPress = null;
                this.autoSizeColumn(column);

                return;
            }

            this._resizing = {
                column,
                pointerId: event.pointerId,
                startX: event.clientX,
                startWidth: header.getBoundingClientRect().width,
            };

            header.setPointerCapture?.(event.pointerId);
            getCursor().pushShape(CursorShape.RESIZE_H, 'table-resize');

            return;
        }

        if (column.isSortable) {
            this._pressedHeader = {
                cell: header,
                column,
                pointerId: event.pointerId,
                inside: true,
            };
            header.classList.add('wy-pressed');
            header.setPointerCapture?.(event.pointerId);
        }
    }

    _onPointerMove(event) {
        const resizing = this._resizing;
        if (resizing && event.pointerId === resizing.pointerId) {
            const width = Math.round(resizing.startWidth + event.clientX - resizing.startX);

            resizing.column._userResized = true;
            resizing.column.width = Math.max(resizing.column.minWidth, width);

            return;
        }

        const pressed = this._pressedHeader;
        if (pressed && event.pointerId === pressed.pointerId) {
            const rect = pressed.cell.getBoundingClientRect();
            pressed.inside =
                event.clientX >= rect.left &&
                event.clientX < rect.right &&
                event.clientY >= rect.top &&
                event.clientY < rect.bottom;

            pressed.cell.classList.toggle('wy-pressed', pressed.inside);
        }
    }

    _onPointerUp(event, canceled) {
        if (this._resizing && event.pointerId === this._resizing.pointerId) {
            this._resizing = null;
            getCursor().popShape('table-resize');

            return;
        }

        const pressed = this._pressedHeader;
        if (pressed && event.pointerId === pressed.pointerId) {
            this._pressedHeader = null;
            pressed.cell.classList.remove('wy-pressed');

            if (pressed.inside && !canceled) {
                this._cycleSort(pressed.column);
            }
        }
    }

    _onClick(event) {
        if (event.button !== 0) {
            return;
        }

        const index = this._getRowIndex(event.target);

        // Clicking an expander toggles its row, with Shift recursively.
        const expander = event.target.closest?.('.wy-table-expander');
        if (expander && index >= 0 && this._treeColumnInUse) {
            if (!expander.classList.contains('wy-leaf')) {
                this.model.toggle(index, event.shiftKey);
            }

            event.preventDefault();

            return;
        }

        if (event.shiftKey || event.ctrlKey || event.metaKey) {
            return;
        }

        const target = this._getCellColumn(event.target);

        if (index >= 0 && target && target.column._onCellClick(target.cell, index, event)) {
            event.preventDefault();
        }
    }

    /**
     * Returns the index of the row a press is on, or -1 for presses elsewhere (such as on the
     * headers and on expanders), which do not activate rows.
     *
     * @param {PointerEvent} event
     * @returns {number}
     */
    _getDoublePressRow(event) {
        if (event.target.closest?.('.wy-table-header, .wy-table-expander')) {
            return -1;
        }

        return this._getRowIndex(event.target);
    }

    _onDoublePress(event) {
        const index = this._getDoublePressRow(event);
        if (index < 0) {
            return;
        }

        // Double clicking an editable check box toggles it twice; do not also activate the row.
        const target = this._getCellColumn(event.target);
        if (target?.column instanceof CheckBoxColumn && target.column.editable) {
            return;
        }

        this.activateRow(index);
    }

    /**
     * Sorts on a column, cycling ascending, descending and (with `allowUnsorted`) unsorted.
     *
     * @param {AbstractColumn} column
     */
    _cycleSort(column) {
        if (!column.isSortable || !this.model) {
            return;
        }

        if (column.sortIndicator === SortIndicator.DESCENDING && this._allowUnsorted) {
            column.sort(SortOrder.NONE);
        } else {
            column.sort();
        }
    }

    _onKeyDown(event) {
        if (event.defaultPrevented || event.altKey) {
            return;
        }

        const header = event.target.closest?.('.wy-table-column-header');
        if (header && this._headerEl.contains(header)) {
            if (this._onHeaderKeyDown(event, header)) {
                event.preventDefault();
            }

            return;
        }

        if (this._handleKey(event)) {
            event.preventDefault();
        }
    }

    _handleKey(event) {
        const count = this.model?.rowsCount || 0;
        const cursor = this._cursor;
        const shift = event.shiftKey;
        const control = event.ctrlKey || event.metaKey;
        const page = Math.max(
            1,
            Math.floor((this._viewEl.clientHeight - this._headerHeight) / (this._rowHeight || 1)) -
                1
        );

        if (this._treeColumnInUse && cursor >= 0 && this._handleTreeKey(event, cursor)) {
            return true;
        }

        switch (event.key) {
            case Key.UP:
                if (cursor <= 0 && !shift && !control && this._focusHeader()) {
                    return true;
                }

                this._moveCursor(cursor - 1, shift, control);

                return true;

            case Key.DOWN:
                this._moveCursor(cursor < 0 ? 0 : cursor + 1, shift, control);

                return true;

            case Key.PAGE_UP:
                this._moveCursor(Math.max(0, cursor) - page, shift, control);

                return true;

            case Key.PAGE_DOWN:
                this._moveCursor(Math.max(0, cursor) + page, shift, control);

                return true;

            case Key.HOME:
                this._moveCursor(0, shift, control);

                return true;

            case Key.END:
                this._moveCursor(count - 1, shift, control);

                return true;

            case Key.LEFT:
            case Key.RIGHT:
                this._viewEl.scrollLeft +=
                    event.key === Key.LEFT ? -HORIZONTAL_STEP : HORIZONTAL_STEP;

                return true;

            case Key.ENTER:
                if (cursor >= 0) {
                    this.activateRow(cursor);

                    return true;
                }

                return false;

            case Key.SPACE:
                if (cursor < 0) {
                    this._moveCursor(0, false, false);

                    return count > 0;
                }

                if (
                    !shift &&
                    !control &&
                    this._visibleColumns.some((column) => column._onCellKeyActivate(cursor))
                ) {
                    return true;
                }

                this._pressRow(cursor, shift, control);

                return true;
        }

        if (control && !shift && event.key.toLowerCase() === Key.A) {
            if (this._selectionModes & SelectionModes.MULTI) {
                this._selection.selectAll();
            }

            return true;
        }

        if (this._enableSearch && event.key.length === 1 && !control && event.key !== ' ') {
            return this._typeAhead(event.key);
        }

        return false;
    }

    /**
     * Handles the tree keys on the cursor row, like GTK.
     *
     * @param {KeyboardEvent} event
     * @param {number} cursor
     * @returns {boolean} Whether the key was used.
     */
    _handleTreeKey(event, cursor) {
        const model = this.model;
        const row = model.getRow(cursor);
        const shift = event.shiftKey;
        const control = event.ctrlKey || event.metaKey;

        switch (event.key) {
            case Key.RIGHT:
                if (shift) {
                    model.expand(row, true);
                } else if (!model.isExpanded(row)) {
                    model.expand(row);
                } else if (
                    cursor + 1 < model.rowsCount &&
                    model.getParent(model.getRow(cursor + 1)) === row
                ) {
                    // Move to the first child.
                    this._moveCursor(cursor + 1, false, control);
                }

                return true;

            case Key.LEFT:
                if (shift) {
                    model.collapse(row, true);
                } else if (model.isExpanded(row) && model.hasChildren(row)) {
                    model.collapse(row);
                } else {
                    this._moveToParent(row, control);
                }

                return true;

            case Key.BACKSPACE:
                this._moveToParent(row, control);

                return true;

            case '+':
                model.expand(row);

                return true;

            case '-':
                model.collapse(row);

                return true;

            case '*':
                model.expand(row, true);

                return true;

            case '/':
                model.collapse(row, true);

                return true;
        }

        return false;
    }

    /**
     * Moves the cursor to the parent of a row, if it has one.
     *
     * @param {object} row
     * @param {boolean} cursorOnly Whether to move only the cursor (Control).
     */
    _moveToParent(row, cursorOnly) {
        const parent = this.model.getParent(row);
        const index = parent ? this.model.getRowIndex(parent) : -1;

        if (index >= 0) {
            this._moveCursor(index, false, cursorOnly);
        }
    }

    _onHeaderKeyDown(event, header) {
        const columns = this._visibleColumns;
        const index = columns.indexOf(header.wyColumn);
        const column = header.wyColumn;

        switch (event.key) {
            case Key.LEFT:
            case Key.RIGHT: {
                const direction = event.key === Key.LEFT ? -1 : 1;

                if (event.shiftKey) {
                    if (column.resizable) {
                        const width =
                            header.getBoundingClientRect().width +
                            (direction * HORIZONTAL_STEP) / 2;

                        column._userResized = true;
                        column.width = Math.max(column.minWidth, Math.round(width));
                    }

                    return true;
                }

                this._focusHeader(columns[clamp(index + direction, 0, columns.length - 1)]);

                return true;
            }

            case Key.HOME:
            case Key.END:
                this._focusHeader(columns[event.key === Key.HOME ? 0 : columns.length - 1]);

                return true;

            case Key.ENTER:
            case Key.SPACE:
                this._cycleSort(column);

                return true;

            case Key.DOWN:
            case Key.ESCAPE:
                this.el.focus({ preventScroll: true });

                if (event.key === Key.DOWN && this._cursor < 0 && this.model?.rowsCount) {
                    this._moveCursor(0, false, false);
                }

                return true;
        }

        return false;
    }

    /**
     * Moves the focus to a column header: the given column, the sorted column or the first.
     *
     * @param {AbstractColumn} [column]
     * @returns {boolean} Whether a header got the focus.
     */
    _focusHeader(column) {
        if (!this._headerVisible || !this._visibleColumns.length) {
            return false;
        }

        if (!column) {
            column =
                this._visibleColumns.find(
                    (x) => x instanceof DataColumn && x.sortIndicator !== SortIndicator.NONE
                ) || this._visibleColumns[0];
        }

        const cell = this._headerEls.get(column);
        if (!cell) {
            return false;
        }

        cell.focus({ preventScroll: true });
        cell.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });

        return true;
    }

    _getSearchColumn() {
        const columns = this._visibleColumns.filter(
            (column) => column instanceof DataColumn && !(column instanceof CheckBoxColumn)
        );

        if (this._searchColumn) {
            return columns.find((column) => column.name === this._searchColumn) || null;
        }

        const sortColumn = this.model?.sortColumn;

        return (
            (sortColumn && columns.find((column) => column._getSortKey() === sortColumn)) ||
            columns.find((column) => column instanceof TextColumn) ||
            columns[0] ||
            null
        );
    }

    /**
     * Moves the cursor to the next row whose search column starts with the typed text.
     *
     * @param {string} character
     * @returns {boolean} Whether the key was used.
     */
    _typeAhead(character) {
        const model = this.model;
        const column = this._getSearchColumn();
        if (!model || !model.rowsCount || !column) {
            return false;
        }

        const now = performance.now();
        if (now - this._searchTime > TYPE_AHEAD_TIMEOUT) {
            this._searchText = '';
        }

        this._searchTime = now;

        const locale = getLocaleManager().locale;
        this._searchText += character.toLocaleLowerCase(locale);

        // Typing the same letter again moves to the next row starting with it.
        const text = this._searchText;
        const repeated = [...text].every((x) => x === text[0]);
        const search = repeated ? text[0] : text;

        const count = model.rowsCount;
        const start = this._cursor < 0 ? 0 : repeated ? this._cursor + 1 : this._cursor;

        for (let offset = 0; offset < count; ++offset) {
            const index = (start + offset) % count;
            const cellText = column
                .getCellText(model.getRow(index), index)
                .toLocaleLowerCase(locale);

            if (cellText.startsWith(search)) {
                this._moveCursor(index, false, false);

                return true;
            }
        }

        return true;
    }
}

defineProperties(Table, {
    canFocus: { value: true },

    hExpand: { value: true },

    vExpand: { value: true },

    /**
     * The model: a `ListModel`, a `FilteredListModel`, a `TreeModel` (making the table a tree
     * view) or another `AbstractModel`, or `null`.
     */
    model: {
        value: null,
        set(model) {
            if (model !== null && !(model instanceof AbstractModel)) {
                throw new TypeError('The model of a table must be a model.');
            }

            this._connectModel(model);

            this._cursor = -1;
            this._cursorKey = undefined;
            this._anchor = -1;
            this._anchorKey = undefined;
            this._viewEl.scrollTop = 0;

            this._resetContentWidths();
            this._structureDirty = true;
            this._headerDirty = true;
            this._widthsDirty = true;
            this._dirtyAll = true;
            this._queueLayout();
        },
    },

    /**
     * The column that shows the tree of a `TreeModel` (the indentation and the expanders), or
     * `null` for the first text column (or else the first column).
     */
    treeColumn: {
        value: null,
        coerce(column) {
            if (column !== null && !(column instanceof AbstractColumn)) {
                throw new TypeError('The tree column must be a column or null.');
            }

            return column;
        },
        changed() {
            this._onColumnsChange();
        },
    },

    /**
     * Whether rows of a tree have expanders. Without them, rows are only indented by
     * `levelIndentation`, and expanded and collapsed with the keyboard.
     */
    showExpanders: {
        value: true,
        changed(show) {
            this.el.classList.toggle('wy-no-expanders', !show);
            this._resetContentWidths();
            this._widthsDirty = true;
            this._dirtyAll = true;
            this._queueLayout();
        },
    },

    /**
     * The extra indentation of every level of a tree, in pixels, besides the width of the
     * expanders.
     */
    levelIndentation: {
        value: 0,
        coerce(indentation) {
            return Math.max(0, Math.round(Number(indentation) || 0));
        },
        changed() {
            this._resetContentWidths();
            this._widthsDirty = true;
            this._dirtyAll = true;
            this._queueLayout();
        },
    },

    /**
     * The `Selection` of the rows.
     */
    selection: {
        readOnly: true,
        get() {
            return this._selection;
        },
    },

    /**
     * How rows can be selected: a mask of `SelectionModes`. `NONE` (the default) disables
     * selecting.
     */
    selectionModes: {
        value: SelectionModes.NONE,
        changed(modes) {
            this._selection.modes = modes;

            if (modes & SelectionModes.MULTI) {
                this.el.setAttribute('aria-multiselectable', 'true');
            } else {
                this.el.removeAttribute('aria-multiselectable');
            }

            this._dirtyAll = true;
            this._queueLayout();
        },
    },

    /**
     * The row with the keyboard cursor, or -1. It is distinct from the selection: Control with
     * the arrow keys moves only the cursor.
     */
    cursor: {
        value: -1,
        coerce(index) {
            if (!Number.isInteger(index)) {
                throw new TypeError('The cursor must be a row index.');
            }

            const count = this.model?.rowsCount || 0;

            return index < 0 || !count ? -1 : Math.min(index, count - 1);
        },
        changed(index) {
            this._cursorKey =
                index >= 0 && this._selection.byId ? this.model.getRowIdByIndex(index) : undefined;
            this._updateRowStates();
        },
    },

    /**
     * The columns, in order. Do not modify the array.
     */
    columns: {
        readOnly: true,
        get() {
            return this._columns;
        },
    },

    /**
     * The number of columns.
     */
    columnsCount: {
        readOnly: true,
        get() {
            return this._columns.length;
        },
    },

    /**
     * Whether the column headers are shown.
     */
    headerVisible: {
        value: true,
        changed(visible) {
            this.el.classList.toggle('wy-headers-hidden', !visible);
            // Measure again, so the header height is updated.
            this._metricsDirty = true;
            this._probeHeaderHeight = -1;
            this._queueLayout();
        },
    },

    /**
     * Another name of `headerVisible`.
     */
    showHeaders: {
        signal: false,
        get() {
            return this._headerVisible;
        },
        set(show) {
            this.headerVisible = show;

            return false;
        },
    },

    /**
     * Whether every other row has a slightly darker background.
     */
    alternatingRowColors: {
        value: true,
        changed(alternating) {
            this.el.classList.toggle('wy-alternating', alternating);
        },
    },

    /**
     * Whether the table has a border.
     */
    hasFrame: {
        value: true,
        changed(hasFrame) {
            this.el.classList.toggle('wy-has-frame', hasFrame);
        },
    },

    /**
     * The text shown when the model has no rows (or there is no model).
     */
    placeholderText: {
        value: '',
        coerce(text) {
            return text === null || text === undefined ? '' : String(text);
        },
        changed() {
            this._queueLayout();
        },
    },

    /**
     * The model column that type-ahead search uses, or `null` for the sort column (or else the
     * first text column).
     */
    searchColumn: { value: null },

    /**
     * Whether typing searches the rows.
     */
    enableSearch: { value: true },

    /**
     * Whether clicking the header of a column sorted descending removes the sorting, instead of
     * sorting ascending again.
     */
    allowUnsorted: { value: false },

    /**
     * The height of every row in pixels, from `--wy-row-height` (0 until the table is shown).
     */
    rowHeight: {
        readOnly: true,
        get() {
            return this._rowHeight;
        },
    },

    /**
     * The horizontal `Adjustment` of the scroll position, in pixels. Only change its value; the
     * table sets the rest.
     */
    hAdjustment: {
        readOnly: true,
        get() {
            return this._hAdjustment;
        },
    },

    /**
     * The vertical `Adjustment` of the scroll position, in pixels. Only change its value; the
     * table sets the rest.
     */
    vAdjustment: {
        readOnly: true,
        get() {
            return this._vAdjustment;
        },
    },
});

Table.builderProperties = {
    columns(builder, table, columns) {
        if (!Array.isArray(columns)) {
            throw new Error('Table columns must be an array.');
        }

        for (const column of builder.build(columns)) {
            table.addColumn(column);
        }
    },
};

registerType('table', Table);
