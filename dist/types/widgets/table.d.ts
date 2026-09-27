/**
 * @module widgets/table
 */
import { AbstractColumn } from '../columns/abstract-column.js';
import { DataColumn } from '../columns/data-column.js';
import { TextColumn } from '../columns/text-column.js';
import { Adjustment } from '../data/adjustment.js';
import { Selection } from '../data/selection.js';
import { Widget } from './widget.js';
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
 * `selectionMode` and `toggleSelection`). The keyboard moves the cursor row (the arrows, Page Up, Page Down, Home and
 * End, with Shift to extend the selection and Control to move only the cursor, except with
 * `browse`), Space selects the
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
 * const table = new Table({ model, selectionMode: SelectionMode.MULTIPLE });
 * table.addColumn(new IndexColumn());
 * table.addColumn(new DateColumn({ name: 'date', label: 'Date', format: 'long-date' }));
 * table.addColumn(new TextColumn({ name: 'name', label: 'Name', expand: true }));
 * table.connect('row-activate', (table, index, row) => open(row));
 */
export declare class Table extends Widget {
    /** @type {AbstractColumn[]} */
    _columns: AbstractColumn[];
    /** @type {AbstractColumn[]} */
    _visibleColumns: AbstractColumn[];
    /**
     * The rendered row elements by row index.
     *
     * @type {Map<number, HTMLElement>}
     */
    _rowEls: Map<number, HTMLElement>;
    /** @type {HTMLElement[]} */
    _freeRowEls: HTMLElement[];
    /** @type {Map<AbstractColumn, HTMLElement>} */
    _headerEls: Map<AbstractColumn, HTMLElement>;
    _rowHeight: number;
    _headerHeight: number;
    _cellPadding: number;
    _headerPadding: number;
    _cellFont: string;
    _headerFont: string;
    _metricsDirty: boolean;
    _structureDirty: boolean;
    _headerDirty: boolean;
    _widthsDirty: boolean;
    _dirtyAll: boolean;
    _dirtyStart: number;
    _dirtyEnd: number;
    _totalWidth: number;
    _lastCount: any;
    _anchor: any;
    _anchorKey: any;
    _cursorKey: any;
    _searchText: string;
    _searchTime: number;
    _pendingScroll: {
        index: number;
        align: "center" | "end" | "start";
    };
    _syncingAdjustments: boolean;
    _resizing: {
        column: any;
        pointerId: any;
        startX: any;
        startWidth: any;
    };
    _pressedHeader: {
        cell: any;
        column: any;
        pointerId: any;
        inside: boolean;
    };
    _rowCounter: number;
    _lastResizerPress: {
        column: any;
        time: any;
    };
    /**
     * The column that shows the tree, when the model is a tree model.
     *
     * @type {AbstractColumn | null}
     */
    _treeColumnInUse: AbstractColumn | null;
    _id: string;
    _selection: Selection;
    _hAdjustment: Adjustment;
    _vAdjustment: Adjustment;
    /**
     * Measures text in the cell font. Columns use it to shorten text in the middle.
     *
     * @type {(text: string) => number}
     */
    _measureCellText: (text: string) => number;
    _viewObserver: ResizeObserver;
    _themeObserver: MutationObserver;
    _disconnectLocale: () => void;
    _viewEl: Element;
    _headerEl: Element;
    _bodyEl: Element;
    _placeholderEl: Element;
    _probeHeaderEl: Element;
    _probeRowEl: Element;
    _probeHeaderHeight: number;
    _fillerEl: HTMLElement;
    _model: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Adds a column at the end.
     *
     * @param {AbstractColumn} column
     * @returns {AbstractColumn} The column.
     */
    addColumn(column: AbstractColumn): AbstractColumn;
    /**
     * Adds a column at the start.
     *
     * @param {AbstractColumn} column
     * @returns {AbstractColumn} The column.
     */
    prependColumn(column: AbstractColumn): AbstractColumn;
    /**
     * Inserts a column at an index. A column can only be in one table.
     *
     * @param {AbstractColumn} column
     * @param {number} index Between 0 and `columnsCount`.
     * @returns {AbstractColumn} The column.
     */
    insertColumn(column: AbstractColumn, index: number): AbstractColumn;
    /**
     * Removes a column.
     *
     * @param {AbstractColumn} column
     * @returns {number} The index the column had.
     * @throws {Error} If the column is not in this table.
     */
    removeColumn(column: AbstractColumn): number;
    /**
     * Removes the column at an index.
     *
     * @param {number} index
     * @returns {AbstractColumn} The removed column.
     */
    removeColumnByIndex(index: number): AbstractColumn;
    /**
     * Removes and destroys all columns, like the original toolkit.
     */
    removeAllColumns(): void;
    /**
     * Moves a column to another index.
     *
     * @param {AbstractColumn} column
     * @param {number} index
     */
    reorderColumn(column: AbstractColumn, index: number): void;
    /**
     * Returns the column at an index.
     *
     * @param {number} index
     * @returns {AbstractColumn}
     * @throws {RangeError} If there is no such column.
     */
    getColumn(index: number): AbstractColumn;
    /**
     * Returns the index of a column, or -1.
     *
     * @param {AbstractColumn} column
     * @returns {number}
     */
    indexOfColumn(column: AbstractColumn): number;
    /**
     * Returns the first data column showing a model column, or `null`.
     *
     * @param {string} name
     * @returns {DataColumn | null}
     */
    getColumnByName(name: string): DataColumn | null;
    /**
     * Sizes a column to fit its header and its cells (at most the first rows and the rendered
     * rows are measured, for large models).
     *
     * @param {AbstractColumn} column
     */
    autoSizeColumn(column: AbstractColumn): void;
    /**
     * Scrolls a row into view.
     *
     * @param {number} index
     * @param {'start' | 'center' | 'end' | null} [align] Where to show the row; by default the
     *     table scrolls as little as possible.
     */
    scrollToRow(index: number, align?: 'start' | 'center' | 'end' | null): void;
    /**
     * Returns the index of the row at a point, or -1.
     *
     * @param {number} x The page x coordinate.
     * @param {number} y The page y coordinate.
     * @returns {number}
     */
    getRowAtPosition(x: number, y: number): number;
    /**
     * Activates a row, as if it was double clicked: emits `row-activate`.
     *
     * @param {number} index
     */
    activateRow(index: number): void;
    destroy(): void;
    _updateLayout(): void;
    _requireModel(): any;
    /**
     * Measures the row height, header height, fonts and paddings from the probe elements.
     *
     * @returns {boolean} Whether the metrics are known (the table is rendered).
     */
    _measureMetrics(): boolean;
    _getSampleIndices(): number[];
    _resetContentWidths(): void;
    /**
     * Grows the measured content widths of auto-width columns to fit the given rows.
     *
     * @param {AbstractColumn[]} columns
     * @param {Iterable<number>} indices
     * @returns {boolean} Whether a width grew.
     */
    _measureColumns(columns: AbstractColumn[], indices: Iterable<number>): boolean;
    /**
     * Returns the width of the indentation and expander of the tree column in a row, or 0 for
     * other columns.
     *
     * @param {AbstractColumn} column
     * @param {object} row
     * @returns {number}
     */
    _getTreeIndent(column: AbstractColumn, row: object): number;
    /**
     * Returns the column that shows the tree: the `treeColumn`, or the first text column (or else
     * the first column). Only tree models have one.
     *
     * @returns {AbstractColumn | null}
     */
    _findTreeColumn(): AbstractColumn | null;
    _getHeaderWidth(column: any): number;
    _onColumnsChange(): void;
    /**
     * Creates the header cells and drops the row elements, whose cells no longer match.
     */
    _buildStructure(): void;
    _updateHeaders(): void;
    _updateWidths(): void;
    _invalidateRows(start: any, end: any): void;
    /**
     * Renders the rows in view, reusing the elements of rows that scrolled out of view.
     */
    _renderRows(): void;
    _createRowElement(): HTMLDivElement;
    /**
     * Creates the cell of the tree column: an expander and the cell of the column.
     *
     * @param {AbstractColumn} column
     * @returns {HTMLElement}
     */
    _createTreeCell(column: AbstractColumn): HTMLElement;
    _bindRow(element: any, index: any): void;
    /**
     * Shows the indentation and the expander of a row in its tree cell.
     *
     * @param {HTMLElement} cell
     * @param {import('../data/tree-model.js').TreeRowInfo} info
     */
    _renderTreeCell(cell: HTMLElement, info: import('../data/tree-model.js').TreeRowInfo): void;
    _getRowClassName(index: any, selected: any): string;
    /**
     * Updates the selected and cursor states of the rendered rows.
     */
    _updateRowStates(): void;
    _updateActiveDescendant(): void;
    _syncAdjustments(): void;
    _onAdjustmentValueChange(adjustment: any): void;
    _onScroll(): void;
    _onViewResize(): void;
    _onThemeChange(): void;
    _onLocaleChange(): void;
    _onColumnChange(column: any, change: any): void;
    _onColumnDestroy(column: any): void;
    _connectModel(model: any): void;
    _onModelRowsChange(_model: any, start: any, end: any): void;
    /**
     * Moves the cursor and the selection anchor along with a row change.
     *
     * @param {(index: number) => number} map Returns the new index of a row.
     */
    _followRows(map: (index: number) => number): void;
    _onModelRowInsert(_model: any, index: any): void;
    _onModelRowRemove(model: any, index: any, id: any): void;
    _onModelRowMove(_model: any, from: any, to: any): void;
    _onModelRowUpdate(_model: any, index: any, id: any, oldId: any): void;
    _onModelRowsReorder(): void;
    _findKey(key: any, index: any): number;
    _rememberCursorKey(): void;
    _rememberAnchorKey(): void;
    _onModelSortChange(): void;
    _onModelDestroy(): void;
    _onSelectionChange(): void;
    /**
     * Handles a press on a row, selecting according to the selection mode, like GTK: with
     * `multiple`, Shift selects the range from the anchor and Control toggles the row; with
     * `single`, Control unselects a selected row; with `browse`, the row is always selected.
     * With `toggleSelection`, a press toggles as a Control+press does.
     *
     * @param {number} index
     * @param {boolean} extend Whether to select a range from the anchor (Shift).
     * @param {boolean} toggle Whether to toggle the row (Control).
     */
    _pressRow(index: number, extend: boolean, toggle: boolean): void;
    /**
     * Moves the cursor with the keyboard.
     *
     * @param {number} index
     * @param {boolean} extend Whether to extend the selection from the anchor (Shift).
     * @param {boolean} cursorOnly Whether to move only the cursor (Control), except with `browse`.
     */
    _moveCursor(index: number, extend: boolean, cursorOnly: boolean): void;
    _getRowIndex(target: any): any;
    _getCellColumn(target: any): {
        cell: Element;
        column: AbstractColumn;
    };
    _onPointerDown(event: any): void;
    _onHeaderPointerDown(event: any, header: any): void;
    _onPointerMove(event: any): void;
    _onPointerUp(event: any, canceled: any): void;
    _onClick(event: any): void;
    /**
     * Returns the index of the row a press is on, or -1 for presses elsewhere (such as on the
     * headers and on expanders), which do not activate rows.
     *
     * @param {PointerEvent} event
     * @returns {number}
     */
    _getDoublePressRow(event: PointerEvent): number;
    _onDoublePress(event: any): void;
    /**
     * Sorts on a column, cycling ascending, descending and (with `allowUnsorted`) unsorted.
     *
     * @param {AbstractColumn} column
     */
    _cycleSort(column: AbstractColumn): void;
    _onKeyDown(event: any): void;
    _handleKey(event: any): boolean;
    /**
     * Handles the tree keys on the cursor row, like GTK.
     *
     * @param {KeyboardEvent} event
     * @param {number} cursor
     * @returns {boolean} Whether the key was used.
     */
    _handleTreeKey(event: KeyboardEvent, cursor: number): boolean;
    /**
     * Moves the cursor to the parent of a row, if it has one.
     *
     * @param {object} row
     * @param {boolean} cursorOnly Whether to move only the cursor (Control).
     */
    _moveToParent(row: object, cursorOnly: boolean): void;
    _onHeaderKeyDown(event: any, header: any): boolean;
    /**
     * Moves the focus to a column header: the given column, the sorted column or the first.
     *
     * @param {AbstractColumn} [column]
     * @returns {boolean} Whether a header got the focus.
     */
    _focusHeader(column?: AbstractColumn): boolean;
    _getSearchColumn(): AbstractColumn | TextColumn;
    /**
     * Moves the cursor to the next row whose search column starts with the typed text.
     *
     * @param {string} character
     * @returns {boolean} Whether the key was used.
     */
    _typeAhead(character: string): boolean;
}
export declare namespace Table {
    var builderProperties: {
        columns(builder: any, table: any, columns: any): void;
    };
}

/** The declared properties of {@link Table}. */
export interface Table {
    /**
     * The model: a `ListModel`, a `FilteredListModel`, a `TreeModel` (making the table a tree
     * view) or another `AbstractModel`, or `null`.
     */
    model: any;
    /**
     * The column that shows the tree of a `TreeModel` (the indentation and the expanders), or
     * `null` for the first text column (or else the first column).
     */
    treeColumn: any;
    /**
     * Whether rows of a tree have expanders. Without them, rows are only indented by
     * `levelIndentation`, and expanded and collapsed with the keyboard.
     */
    showExpanders: boolean;
    /**
     * The extra indentation of every level of a tree, in pixels, besides the width of the
     * expanders.
     */
    levelIndentation: number;
    /**
     * The `Selection` of the rows.
     */
    readonly selection: any;
    /**
     * How rows can be selected: one of `SelectionMode`, like in GTK. `single` (the default)
     * selects at most one row, `browse` one row that the user cannot unselect, `multiple` any
     * number of rows, and `none` disables selecting. Changing it changes the mode of the
     * `selection`.
     */
    selectionMode: string;
    /**
     * The row with the keyboard cursor, or -1. It is distinct from the selection: Control with
     * the arrow keys moves only the cursor.
     */
    cursor: number;
    /**
     * The columns, in order. Do not modify the array.
     */
    readonly columns: any;
    /**
     * The number of columns.
     */
    readonly columnsCount: number;
    /**
     * Whether the column headers are shown.
     */
    headerVisible: boolean;
    /**
     * Another name of `headerVisible`.
     */
    showHeaders: boolean;
    /**
     * Whether every other row has a slightly darker background.
     */
    alternatingRowColors: boolean;
    /**
     * Whether the table has a border.
     */
    hasFrame: boolean;
    /**
     * Whether a click toggles the selection of a row, as a Control+click does: a click on a
     * selected row unselects it (except with `browse`), and with `multiple`, a click on another
     * row adds it to the selection. It is also the `toggleSelection` of the `selection`.
     */
    toggleSelection: boolean;
    /**
     * The text shown when the model has no rows (or there is no model).
     */
    placeholder: string;
    /**
     * The model column that type-ahead search uses, or `null` for the sort column (or else the
     * first text column).
     */
    searchColumn: any;
    /**
     * Whether typing searches the rows.
     */
    enableSearch: any;
    /**
     * Whether clicking the header of a column sorted descending removes the sorting, instead of
     * sorting ascending again.
     */
    allowUnsorted: any;
    /**
     * The height of every row in pixels, from `--wy-row-height` (0 until the table is shown).
     */
    readonly rowHeight: any;
    /**
     * The horizontal `Adjustment` of the scroll position, in pixels. Only change its value; the
     * table sets the rest.
     */
    readonly hAdjustment: any;
    /**
     * The vertical `Adjustment` of the scroll position, in pixels. Only change its value; the
     * table sets the rest.
     */
    readonly vAdjustment: any;
}
