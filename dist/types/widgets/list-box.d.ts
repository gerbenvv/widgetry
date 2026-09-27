/**
 * @module widgets/list-box
 */
import { AbstractModel } from '../data/abstract-model.js';
import { Bin } from './bin.js';
import { Container } from './container.js';
import { Widget } from './widget.js';
/**
 * A row of a `ListBox`. It holds one child widget. Widgets added to a list box that are not rows
 * are wrapped in a row automatically.
 *
 * A row takes the keyboard focus (the list box moves it between rows with the arrow keys) and
 * shows the selection. It may have a header above it, usually set by the list box's header
 * function.
 *
 * Signals: `activate` (`row`) when the row was activated, and the property change signals.
 */
export declare class ListBoxRow extends Bin {
    _releaseHeader: any;
    _filtered: boolean;
    _modelKey: any;
    _headerEl: Element;
    _bodyEl: Element;
    _selected: any;
    _header: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The element with the focus and the selection: the row without its header.
     *
     * @type {HTMLElement}
     */
    get focusElement(): HTMLElement;
    /**
     * The list box the row is in, or `null`.
     *
     * @type {ListBox | null}
     */
    get listBox(): ListBox | null;
    /**
     * Activates the row, as a click (or Enter) does: emits `activate`, and `row-activate` on the
     * list box. Nothing happens when the row is not `activatable`.
     */
    activate(): void;
    /**
     * Tells the list box that the row changed in a way that affects its filtering, sorting or
     * header, so that they are updated.
     */
    changed(): void;
    destroy(): void;
    /**
     * Whether the row is shown: it is `visible` and not filtered out.
     *
     * @protected
     * @returns {boolean}
     */
    protected _isRowShown(): boolean;
    _getFocusChain(): Widget[];
    _onIsVisibleChange(isVisible: any): void;
    _onIsSensitiveChange(isSensitive: any): void;
    _updateTabIndex(): void;
    /**
     * Sets whether the filter of the list box hides the row.
     *
     * @protected
     * @param {boolean} filtered
     */
    protected _setFiltered(filtered: boolean): void;
    /**
     * Updates the selected state. Called by the list box.
     *
     * @protected
     * @param {boolean} selected
     * @returns {boolean} Whether the state changed.
     */
    protected _setSelected(selected: boolean): boolean;
    _syncSelected(): void;
    _setCursor(cursor: any): void;
    _onHeaderDestroy(): void;
}
/**
 * A vertical list of rows that hold any widgets, like GTK 3's list box. It is typically put in a
 * scroll area.
 *
 * Rows are `ListBoxRow`s; other widgets are wrapped in one when added. Rows can be selected
 * according to `selectionMode` (and `toggleSelection`) and activated (`row-activate`) with a click
 * (a double click without `activateOnSingleClick`), Enter or Space.
 *
 * Rows can be filtered (`filterFunction`), sorted (`sortFunction`) and get headers
 * (`setHeaderFunction()`), for example section titles or separators; call `invalidateFilter()`,
 * `invalidateSort()` or `invalidateHeaders()` when the outcome changes, or `row.changed()` for one
 * row. A `placeholder` widget is shown while no row is shown. With `bindModel()`, the rows are made
 * from the rows of a model and follow its changes.
 *
 * Keyboard: Up, Down, Home, End, Page Up and Page Down move the cursor row and select it (with
 * Control only the cursor moves, except with `browse`, and Shift extends the selection with
 * `multiple`). Space and Enter
 * select and activate the cursor row, Control+Space toggles its selection, and Control+A selects
 * all rows (Shift+Control+A deselects them).
 *
 * Signals: `row-activate` (`listBox, row`), `row-select` (`listBox, row`) when the selected row
 * changed in the `single` and `browse` modes (`row` may be `null`), and `selected-rows-change`
 * (`listBox`) once per change of the selection.
 *
 * @example
 * const list = new ListBox({ selectionMode: SelectionMode.BROWSE });
 * list.bindModel(model, (row) => new Label({ text: row.name, margin: 6 }));
 * list.connect('row-activate', (_list, row) => open(model.getRow(row.index)));
 */
export declare class ListBox extends Container {
    _releasePlaceholder: any;
    _selectionBatch: number;
    _tabStopRow: any;
    _lastSelection: any[] | Widget[];
    _lastSelectedRow: any;
    _modelDisconnects: any[] | (() => void)[];
    _binding: boolean;
    _bodyEl: Element;
    _placeholderEl: Element;
    _model: AbstractModel;
    _createWidgetFunction: (row: object, index: number) => Widget;
    _cursorRow: any;
    _anchorRow: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Adds a widget at an index. A widget that is not a `ListBoxRow` is wrapped in a new row. With
     * a `sortFunction`, the row is inserted at its sorted position instead.
     *
     * @param {Widget} widget
     * @param {number} index Between 0 and `childrenCount`.
     * @returns {ListBoxRow} The row.
     * @throws {Error} If the list box is bound to a model.
     */
    insertChild(widget: Widget, index: number): ListBoxRow;
    /**
     * Removes a row. For a widget in a row, its row is removed.
     *
     * @param {Widget} widget A row, or the child of a row.
     * @returns {number} The index the row had.
     * @throws {Error} If the widget is not in the list box.
     */
    removeChild(widget: Widget): number;
    /**
     * Returns the row at an index, or `null`.
     *
     * @param {number} index
     * @returns {ListBoxRow | null}
     */
    getRowAtIndex(index: number): ListBoxRow | null;
    /**
     * Selects a row. Except with `multiple`, the other rows are deselected.
     *
     * @param {ListBoxRow | null} row The row, or `null` to deselect all rows (except with
     *     `browse`).
     */
    selectRow(row: ListBoxRow | null): void;
    /**
     * Deselects a row.
     *
     * @param {ListBoxRow} row
     */
    unselectRow(row: ListBoxRow): void;
    /**
     * Selects all rows that are shown and selectable. Only with `multiple`.
     */
    selectAll(): void;
    /**
     * Deselects all rows, except with `browse`.
     */
    unselectAll(): void;
    /**
     * Returns the first selected row, or `null`.
     *
     * @returns {ListBoxRow | null}
     */
    getSelectedRow(): ListBoxRow | null;
    /**
     * Calls a function for every selected row, in order.
     *
     * @param {(row: ListBoxRow) => void} method
     * @param {object} [context]
     */
    forEachSelected(method: (row: ListBoxRow) => void, context?: object): void;
    /**
     * Sets the filter function. GTK's name for setting `filterFunction`.
     *
     * @param {((row: ListBoxRow) => boolean) | null} filterFunction
     */
    setFilterFunction(filterFunction: ((row: ListBoxRow) => boolean) | null): void;
    /**
     * Sets the sort function. GTK's name for setting `sortFunction`.
     *
     * @param {((first: ListBoxRow, second: ListBoxRow) => number) | null} sortFunction
     */
    setSortFunction(sortFunction: ((first: ListBoxRow, second: ListBoxRow) => number) | null): void;
    /**
     * Sets the header function, which is called for every shown row with the row and the shown row
     * before it (or `null` for the first row), and sets the row's `header`, for example to a
     * label when a new section starts. It may keep the row's current header. Setting `null` removes
     * all headers.
     *
     * @param {((row: ListBoxRow, before: ListBoxRow | null) => void) | null} headerFunction
     */
    setHeaderFunction(headerFunction: ((row: ListBoxRow, before: ListBoxRow | null) => void) | null): void;
    /**
     * Filters all rows again with the filter function.
     */
    invalidateFilter(): void;
    /**
     * Sorts all rows again with the sort function. Rows bound to a model keep its order.
     */
    invalidateSort(): void;
    /**
     * Updates the headers of all rows with the header function.
     */
    invalidateHeaders(): void;
    /**
     * Makes the rows from a model, and keeps them in sync with it: rows are added, removed, moved
     * and recreated as the model changes. While bound, rows cannot be added or removed otherwise,
     * and `sortFunction` does not apply. `bindModel(null)` unbinds the model and removes the rows.
     *
     * @param {AbstractModel | null} model A model, such as a `ListModel` or `FilteredListModel`.
     * @param {(row: object, index: number) => Widget} [createWidgetFunction] Creates the widget
     *     for a row of the model: a `ListBoxRow`, or another widget, which is wrapped in one.
     * @throws {TypeError} If the model or the function is invalid.
     */
    bindModel(model: AbstractModel | null, createWidgetFunction?: (row: object, index: number) => Widget): void;
    destroy(): void;
    /**
     * The row that is the tab stop of the list: the cursor row, or else the first shown row.
     *
     * @protected
     * @returns {ListBoxRow | null}
     */
    protected _getTabStop(): ListBoxRow | null;
    /**
     * Updates the tab stop row after the cursor or the shown rows changed, and the tab indexes of
     * the rows that stopped or started being the tab stop.
     *
     * @protected
     */
    protected _refreshTabStop(): void;
    _getFocusChain(): any[];
    _onIsVisibleChange(isVisible: any): void;
    _onIsSensitiveChange(isSensitive: any): void;
    _attachChildElement(widget: any, index: any): void;
    _onChildVisibleChange(widget: any): void;
    _onChildrenChange(): void;
    _detachChildElement(widget: any): void;
    _updateLayout(): void;
    /**
     * Updates everything that depends on which rows are shown: the placeholder, the tab stop and
     * (at the end of the task) the headers.
     *
     * @protected
     */
    protected _updateShownRows(): void;
    _onRowChanged(row: any): void;
    _wrap(widget: any): ListBoxRow;
    _checkRow(row: any): void;
    _findSortedIndex(row: any): number;
    _applyFilter(row: any): void;
    _isNavigable(row: any): any;
    _getNavigableRows(): Widget[];
    _canSelect(row: any): any;
    /**
     * Runs a function that changes the selection, and emits the selection signals once afterwards
     * if it changed.
     *
     * @protected
     * @param {() => void} method
     */
    protected _changeSelection(method: () => void): void;
    _syncSelectionState(): void;
    _unselectAllExcept(keep: any): void;
    _selectRange(from: any, to: any, replace: any): void;
    /**
     * Moves the cursor to a row.
     *
     * @protected
     * @param {ListBoxRow | null} row
     * @param {boolean} focus Whether to give the row the keyboard focus.
     */
    protected _setCursorRow(row: ListBoxRow | null, focus: boolean): void;
    /**
     * Selects a row because the user pressed it, like GTK: with `multiple`, Control toggles it and
     * Shift selects the range from the anchor; with `single`, Control deselects a selected row.
     *
     * @protected
     * @param {ListBoxRow} row
     * @param {boolean} modify Whether Control was held.
     * @param {boolean} extend Whether Shift was held.
     */
    protected _updateSelection(row: ListBoxRow, modify: boolean, extend: boolean): void;
    /**
     * Moves the cursor with the keyboard, selecting as GTK does.
     *
     * @protected
     * @param {ListBoxRow | null} row
     * @param {boolean} modify Whether Control was held: only the cursor moves (except with
     *     `browse`).
     * @param {boolean} extend Whether Shift was held: the selection is extended (with `multiple`).
     */
    protected _moveCursor(row: ListBoxRow | null, modify: boolean, extend: boolean): void;
    /**
     * Returns the row a page away from the cursor row, as far as the visible part of the list.
     *
     * @protected
     * @param {number} direction 1 for Page Down, -1 for Page Up.
     * @returns {ListBoxRow | null}
     */
    protected _getPageRow(direction: number): ListBoxRow | null;
    _getViewportHeight(): number;
    _getRowFromTarget(target: any, onlyBody: any): ListBoxRow;
    _onPointerDown(event: any): void;
    _onClick(event: any): void;
    _onDoublePress(event: any): void;
    _onFocusIn(event: any): void;
    _onKeyDown(event: any): void;
    _syncSelectionMode(): void;
    _createModelRow(index: any): ListBoxRow;
    _runBinding(method: any): void;
    _getModelKey(index: any): unknown;
    _rebuildFromModel(): void;
    _onModelRowInsert(index: any): void;
    _onModelRowRemove(index: any): void;
    _onModelRowMove(from: any, to: any): void;
    _onModelRowUpdate(index: any): void;
}

/** The declared properties of {@link ListBoxRow}. */
export interface ListBoxRow {
    /**
     * Whether the row can be activated (by a click or Enter), emitting `row-activate`.
     */
    activatable: boolean;
    /**
     * Whether the row can be selected.
     */
    selectable: boolean;
    /**
     * Whether the row is selected. Use the list box's `selectRow()` and `unselectRow()` to change
     * it.
     */
    readonly selected: any;
    /**
     * The position of the row in its list box, or -1.
     */
    readonly index: any;
    /**
     * A widget shown above the row, such as a section title or a separator, or `null`. The row
     * owns it: replacing it destroys the old header.
     */
    header: any;
}

/** The declared properties of {@link ListBox}. */
export interface ListBox {
    /**
     * How rows can be selected: one of `SelectionMode`, like in GTK. `single` (the default)
     * selects at most one row, `browse` one row that the user cannot unselect, `multiple` any
     * number of rows, and `none` disables selecting. Changing it keeps at most the first selected
     * row, except with `multiple`.
     */
    selectionMode: string;
    /**
     * Whether a click toggles the selection of a row, as a Control+click does: a click on a
     * selected row unselects it (except with `browse`), and with `multiple`, a click on another
     * row adds it to the selection.
     */
    toggleSelection: any;
    /**
     * Whether a single click activates a row. Otherwise a double click does.
     */
    activateOnSingleClick: any;
    /**
     * The selected rows, in order.
     */
    readonly selectedRows: any;
    /**
     * The row with the keyboard cursor, or `null`.
     */
    readonly cursorRow: any;
    /**
     * A function that decides which rows are shown, or `null` to show all rows. It gets a row and
     * returns whether to show it. Rows that are filtered out are deselected.
     */
    filterFunction: (row: ListBoxRow) => boolean;
    /**
     * A function that orders the rows, or `null` to keep them in the order they were added. It
     * gets two rows and returns a negative number, zero or a positive number, like the compare
     * function of `Array.prototype.sort()`.
     */
    sortFunction: (first: ListBoxRow, second: ListBoxRow) => number;
    /**
     * The header function (see `setHeaderFunction()`), or `null`.
     */
    headerFunction: (row: ListBoxRow, before: ListBoxRow | null) => void;
    /**
     * A widget shown instead of the rows while no row is shown, such as a label saying the list is
     * empty, or `null`. The list box owns it.
     */
    placeholder: any;
    /**
     * The bound model (see `bindModel()`), or `null`.
     */
    readonly model: any;
}
