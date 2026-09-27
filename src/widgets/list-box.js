/**
 * @module widgets/list-box
 */

import { SelectionModes } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { AbstractModel } from '../data/abstract-model.js';
import { Key } from '../events/constants.js';
import {
    attachAuxiliaryWidget,
    getAuxiliaryFocusChain,
    refreshAuxiliaryWidgets,
} from './auxiliary.js';
import { Bin } from './bin.js';
import { Container } from './container.js';
import { attachDoublePress } from './double-press.js';
import { Widget } from './widget.js';

/**
 * How the rows of a list box can be selected, as in GTK.
 *
 * @enum {string}
 */
export const SelectionMode = Object.freeze({
    NONE: 'none', // No row can be selected.
    SINGLE: 'single', // At most one row; Control+click deselects it.
    BROWSE: 'browse', // One row, which the user cannot deselect.
    MULTIPLE: 'multiple', // Any number of rows, extended with Shift and Control.
});

/**
 * The selection modes, for validating `selectionMode`.
 *
 * @type {ReadonlySet<string>}
 */
const SELECTION_MODES = new Set(Object.values(SelectionMode));

/**
 * Converts a selection mode, or a mask of `SelectionModes` as tables use, to a `SelectionMode`:
 * `MULTI` gives `multiple`, `SINGLE_TOGGLE` gives `single`, `SINGLE` gives `browse` and `NONE`
 * gives `none`.
 *
 * @param {string | number} mode
 * @returns {string}
 */
function toSelectionMode(mode) {
    if (typeof mode === 'number') {
        if (mode & SelectionModes.MULTI) {
            return SelectionMode.MULTIPLE;
        }

        if (mode & SelectionModes.SINGLE) {
            return mode & SelectionModes.TOGGLE ? SelectionMode.SINGLE : SelectionMode.BROWSE;
        }

        return SelectionMode.NONE;
    }

    if (!SELECTION_MODES.has(mode)) {
        throw new RangeError(`Invalid selection mode '${mode}'.`);
    }

    return mode;
}

/**
 * Checks an optional function value.
 *
 * @param {unknown} value
 * @param {string} name
 * @returns {Function | null}
 */
function checkFunction(value, name) {
    if (value !== null && value !== undefined && typeof value !== 'function') {
        throw new TypeError(`The ${name} must be a function or null.`);
    }

    return value || null;
}

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
export class ListBoxRow extends Bin {
    _initialize() {
        this._releaseHeader = null;
        this._filtered = false;

        // The key of the model row the row was made from, when the list box is bound to a model.
        this._modelKey = undefined;

        super._initialize();
    }

    _render() {
        const element = createElement(`
            <div class="wy-list-box-row" role="none">
                <div class="wy-list-box-row-header" hidden></div>
                <div class="wy-list-box-row-body" role="option"></div>
            </div>
        `);

        this._headerEl = element.querySelector('.wy-list-box-row-header');
        this._bodyEl = element.querySelector('.wy-list-box-row-body');

        return element;
    }

    /**
     * The element with the focus and the selection: the row without its header.
     *
     * @type {HTMLElement}
     */
    get focusElement() {
        return this._bodyEl;
    }

    /**
     * The list box the row is in, or `null`.
     *
     * @type {ListBox | null}
     */
    get listBox() {
        return this._parent instanceof ListBox ? this._parent : null;
    }

    /**
     * Activates the row, as a click (or Enter) does: emits `activate`, and `row-activate` on the
     * list box. Nothing happens when the row is not `activatable`.
     */
    activate() {
        if (!this._activatable || !this.isSensitive) {
            return;
        }

        this.emit('activate', this);
        this.listBox?.emit('row-activate', this.listBox, this);
    }

    /**
     * Tells the list box that the row changed in a way that affects its filtering, sorting or
     * header, so that they are updated.
     */
    changed() {
        this.listBox?._onRowChanged(this);
    }

    destroy() {
        this._header?.destroy();

        super.destroy();
    }

    /**
     * Whether the row is shown: it is `visible` and not filtered out.
     *
     * @protected
     * @returns {boolean}
     */
    _isRowShown() {
        return this._visible && !this._filtered;
    }

    _getFocusChain() {
        return [...getAuxiliaryFocusChain(this._header), ...super._getFocusChain()];
    }

    _onIsVisibleChange(isVisible) {
        super._onIsVisibleChange(isVisible);

        refreshAuxiliaryWidgets([this._header]);
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        refreshAuxiliaryWidgets([this._header]);
    }

    _updateTabIndex() {
        super._updateTabIndex();

        // Only one row of a list box is a tab stop: the cursor row, or else the first row.
        const listBox = this.listBox;
        if (listBox && this.focusElement.tabIndex === 0 && listBox._getTabStop() !== this) {
            this.focusElement.tabIndex = -1;
        }
    }

    /**
     * Sets whether the filter of the list box hides the row.
     *
     * @protected
     * @param {boolean} filtered
     */
    _setFiltered(filtered) {
        this._filtered = filtered;
        this.el.classList.toggle('wy-filtered-out', filtered);
    }

    /**
     * Updates the selected state. Called by the list box.
     *
     * @protected
     * @param {boolean} selected
     * @returns {boolean} Whether the state changed.
     */
    _setSelected(selected) {
        if (selected === this._selected) {
            return false;
        }

        this._selected = selected;
        this._syncSelected();

        this.emit('selected-change', this);

        return true;
    }

    _syncSelected() {
        const selectable = this.listBox?.selectionMode !== SelectionMode.NONE;

        this.el.classList.toggle('wy-selected', this._selected);

        if (selectable) {
            this._bodyEl.setAttribute('aria-selected', String(this._selected));
        } else {
            this._bodyEl.removeAttribute('aria-selected');
        }
    }

    _setCursor(cursor) {
        this.el.classList.toggle('wy-cursor', cursor);
    }

    _onHeaderDestroy() {
        this._releaseHeader = null;
        this._header = null;
        this._headerEl.hidden = true;

        this.emit('header-change', this);
    }
}

defineProperties(ListBoxRow, {
    canFocus: { value: true },

    /**
     * Whether the row can be activated (by a click or Enter), emitting `row-activate`.
     */
    activatable: {
        value: true,
        coerce: Boolean,
        changed(activatable) {
            this.el.classList.toggle('wy-activatable', activatable);
        },
    },

    /**
     * Whether the row can be selected.
     */
    selectable: {
        value: true,
        coerce: Boolean,
        changed(selectable) {
            if (!selectable) {
                this.listBox?.unselectRow(this);
            }
        },
    },

    /**
     * Whether the row is selected. Use the list box's `selectRow()` and `unselectRow()` to change
     * it.
     */
    selected: { value: false, readOnly: true },

    /**
     * The position of the row in its list box, or -1.
     */
    index: {
        readOnly: true,
        get() {
            return this._parent ? this._parent.indexOf(this) : -1;
        },
    },

    /**
     * A widget shown above the row, such as a section title or a separator, or `null`. The row
     * owns it: replacing it destroys the old header.
     */
    header: {
        value: null,
        set(widget) {
            if (widget !== null && !(widget instanceof Widget)) {
                throw new TypeError('The header of a row must be a widget or null.');
            }

            const old = this._header;
            if (old) {
                this._releaseHeader?.();
                this._releaseHeader = null;
                old.destroy();
            }

            this._header = widget;
            this._headerEl.hidden = !widget;

            if (widget) {
                this._releaseHeader = attachAuxiliaryWidget(this, widget, this._headerEl, () =>
                    this._onHeaderDestroy()
                );
            }
        },
    },
});

/**
 * A vertical list of rows that hold any widgets, like GTK 3's list box. It is typically put in a
 * scroll area.
 *
 * Rows are `ListBoxRow`s; other widgets are wrapped in one when added. Rows can be selected
 * according to `selectionMode` and activated (`row-activate`) with a click (a double click without
 * `activateOnSingleClick`), Enter or Space.
 *
 * Rows can be filtered (`filterFunction`), sorted (`sortFunction`) and get headers
 * (`setHeaderFunction()`), for example section titles or separators; call `invalidateFilter()`,
 * `invalidateSort()` or `invalidateHeaders()` when the outcome changes, or `row.changed()` for one
 * row. A `placeholder` widget is shown while no row is shown. With `bindModel()`, the rows are made
 * from the rows of a model and follow its changes.
 *
 * Keyboard: Up, Down, Home, End, Page Up and Page Down move the cursor row and select it (with
 * Control only the cursor moves, and Shift extends the selection with `multiple`). Space and Enter
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
export class ListBox extends Container {
    _initialize() {
        this._releasePlaceholder = null;
        this._selectionBatch = 0;
        this._tabStopRow = null;
        this._lastSelection = [];
        this._lastSelectedRow = null;
        this._modelDisconnects = [];
        this._binding = false;

        super._initialize();

        this.el.addEventListener('pointerdown', (event) => this._onPointerDown(event));
        this.el.addEventListener('click', (event) => this._onClick(event));
        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));
        this.el.addEventListener('focusin', (event) => this._onFocusIn(event));

        // Without single click activation, a double press activates a row. The toolkit counts
        // presses itself, which works the same in all browsers.
        attachDoublePress(this.el, (event) => this._onDoublePress(event), {
            key: (event) => this._getRowFromTarget(event.target, true),
        });

        this._syncSelectionMode();
    }

    _render() {
        const element = createElement(`
            <div class="wy-list-box" role="listbox" aria-orientation="vertical">
                <div class="wy-list-box-rows" role="none"></div>
                <div class="wy-list-box-placeholder" hidden></div>
            </div>
        `);

        this._bodyEl = element.querySelector('.wy-list-box-rows');
        this._placeholderEl = element.querySelector('.wy-list-box-placeholder');

        return element;
    }

    /**
     * Adds a widget at an index. A widget that is not a `ListBoxRow` is wrapped in a new row. With
     * a `sortFunction`, the row is inserted at its sorted position instead.
     *
     * @param {Widget} widget
     * @param {number} index Between 0 and `childrenCount`.
     * @returns {ListBoxRow} The row.
     * @throws {Error} If the list box is bound to a model.
     */
    insertChild(widget, index) {
        if (this._model && !this._binding) {
            throw new Error('A list box bound to a model gets its rows from the model.');
        }

        const row = widget instanceof ListBoxRow ? widget : this._wrap(widget);

        if (this._sortFunction && !this._model) {
            index = this._findSortedIndex(row);
        }

        super.insertChild(row, index);

        return row;
    }

    /**
     * Removes a row. For a widget in a row, its row is removed.
     *
     * @param {Widget} widget A row, or the child of a row.
     * @returns {number} The index the row had.
     * @throws {Error} If the widget is not in the list box.
     */
    removeChild(widget) {
        if (this._model && !this._binding && !widget.destroyed) {
            throw new Error('A list box bound to a model gets its rows from the model.');
        }

        const row =
            !this._children.includes(widget) && widget?.parent instanceof ListBoxRow
                ? widget.parent
                : widget;

        return super.removeChild(row);
    }

    /**
     * Returns the row at an index, or `null`.
     *
     * @param {number} index
     * @returns {ListBoxRow | null}
     */
    getRowAtIndex(index) {
        return this._children[index] || null;
    }

    /**
     * Selects a row. Except with `multiple`, the other rows are deselected.
     *
     * @param {ListBoxRow | null} row The row, or `null` to deselect all rows (except with
     *     `browse`).
     */
    selectRow(row) {
        if (row === null) {
            this.unselectAll();

            return;
        }

        this._checkRow(row);

        if (!this._canSelect(row)) {
            return;
        }

        this._changeSelection(() => {
            if (this._selectionMode !== SelectionMode.MULTIPLE) {
                this._unselectAllExcept(row);
            }

            row._setSelected(true);
        });
    }

    /**
     * Deselects a row.
     *
     * @param {ListBoxRow} row
     */
    unselectRow(row) {
        this._checkRow(row);

        this._changeSelection(() => row._setSelected(false));
    }

    /**
     * Selects all rows that are shown and selectable. Only with `multiple`.
     */
    selectAll() {
        if (this._selectionMode !== SelectionMode.MULTIPLE) {
            return;
        }

        this._changeSelection(() => {
            for (const row of this._children) {
                if (this._canSelect(row)) {
                    row._setSelected(true);
                }
            }
        });
    }

    /**
     * Deselects all rows, except with `browse`.
     */
    unselectAll() {
        if (this._selectionMode === SelectionMode.BROWSE) {
            return;
        }

        this._changeSelection(() => this._unselectAllExcept(null));
    }

    /**
     * Returns the first selected row, or `null`.
     *
     * @returns {ListBoxRow | null}
     */
    getSelectedRow() {
        return this._children.find((x) => x.selected) || null;
    }

    /**
     * Calls a function for every selected row, in order.
     *
     * @param {(row: ListBoxRow) => void} method
     * @param {object} [context]
     */
    forEachSelected(method, context) {
        for (const row of this.selectedRows) {
            method.call(context, row);
        }
    }

    /**
     * Sets the filter function. GTK's name for setting `filterFunction`.
     *
     * @param {((row: ListBoxRow) => boolean) | null} filterFunction
     */
    setFilterFunction(filterFunction) {
        this.filterFunction = filterFunction;
    }

    /**
     * Sets the sort function. GTK's name for setting `sortFunction`.
     *
     * @param {((first: ListBoxRow, second: ListBoxRow) => number) | null} sortFunction
     */
    setSortFunction(sortFunction) {
        this.sortFunction = sortFunction;
    }

    /**
     * Sets the header function, which is called for every shown row with the row and the shown row
     * before it (or `null` for the first row), and sets the row's `header`, for example to a
     * label when a new section starts. It may keep the row's current header. Setting `null` removes
     * all headers.
     *
     * @param {((row: ListBoxRow, before: ListBoxRow | null) => void) | null} headerFunction
     */
    setHeaderFunction(headerFunction) {
        this.headerFunction = headerFunction;
    }

    /**
     * Filters all rows again with the filter function.
     */
    invalidateFilter() {
        this._changeSelection(() => {
            for (const row of this._children) {
                this._applyFilter(row);
            }
        });

        this._updateShownRows();
    }

    /**
     * Sorts all rows again with the sort function. Rows bound to a model keep its order.
     */
    invalidateSort() {
        const compare = this._sortFunction;
        if (!compare || this._model) {
            return;
        }

        // The sort is stable, so equal rows keep their order.
        const sorted = [...this._children].sort((a, b) => compare(a, b));
        sorted.forEach((row, index) => {
            if (this._children[index] !== row) {
                this.reorderChild(row, index);
            }
        });

        this._updateShownRows();
    }

    /**
     * Updates the headers of all rows with the header function.
     */
    invalidateHeaders() {
        const headerFunction = this._headerFunction;
        if (!headerFunction) {
            return;
        }

        let before = null;
        for (const row of this._children) {
            if (row._isRowShown()) {
                headerFunction(row, before);
                before = row;
            }
        }
    }

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
    bindModel(model, createWidgetFunction) {
        if (model !== null && !(model instanceof AbstractModel)) {
            throw new TypeError('A list box can only be bound to a model.');
        }

        if (model && typeof createWidgetFunction !== 'function') {
            throw new TypeError('Binding a model needs a function that creates the widgets.');
        }

        for (const disconnect of this._modelDisconnects) {
            disconnect();
        }

        this._modelDisconnects = [];

        this._binding = true;
        try {
            this._changeSelection(() => this.removeAllChildren());
        } finally {
            this._binding = false;
        }

        this._model = model;
        this._createWidgetFunction = model ? createWidgetFunction : null;

        if (!model) {
            this.emit('model-change', this);

            return;
        }

        this._modelDisconnects = [
            model.connect('row-insert', (_model, index) => this._onModelRowInsert(index)),
            model.connect('row-remove', (_model, index) => this._onModelRowRemove(index)),
            model.connect('row-move', (_model, from, to) => this._onModelRowMove(from, to)),
            model.connect('row-update', (_model, index) => this._onModelRowUpdate(index)),
            model.connect('rows-reorder', () => this._rebuildFromModel()),
            model.connect('destroy', () => this.bindModel(null)),
        ];

        this._rebuildFromModel();
        this.emit('model-change', this);
    }

    destroy() {
        for (const disconnect of this._modelDisconnects) {
            disconnect();
        }

        this._modelDisconnects = [];
        this._model = null;

        this._placeholder?.destroy();

        super.destroy();
    }

    /**
     * The row that is the tab stop of the list: the cursor row, or else the first shown row.
     *
     * @protected
     * @returns {ListBoxRow | null}
     */
    _getTabStop() {
        return this._tabStopRow;
    }

    /**
     * Updates the tab stop row after the cursor or the shown rows changed, and the tab indexes of
     * the rows that stopped or started being the tab stop.
     *
     * @protected
     */
    _refreshTabStop() {
        const shown = (row) => row.visible && row._isRowShown();
        const cursor = this._cursorRow;
        const tabStop =
            cursor && cursor.parent === this && shown(cursor)
                ? cursor
                : this._children.find(shown) || null;

        const old = this._tabStopRow;
        if (tabStop === old) {
            return;
        }

        this._tabStopRow = tabStop;

        if (old && !old.destroyed) {
            old._updateTabIndex();
        }

        tabStop?._updateTabIndex();
    }

    _getFocusChain() {
        const tabStop = this._getTabStop();
        const chain = [];

        for (const row of this._children) {
            if (!row.isVisible || !row.isSensitive || !row._isRowShown()) {
                continue;
            }

            // Only the tab stop row itself takes part, but the widgets in all rows do.
            if (row === tabStop) {
                chain.push(row);
            }

            chain.push(...row._getFocusChain());
        }

        if (!this._placeholderEl.hidden) {
            chain.push(...getAuxiliaryFocusChain(this._placeholder));
        }

        return chain;
    }

    _onIsVisibleChange(isVisible) {
        super._onIsVisibleChange(isVisible);

        refreshAuxiliaryWidgets([this._placeholder]);
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        refreshAuxiliaryWidgets([this._placeholder]);
    }

    _attachChildElement(widget, index) {
        super._attachChildElement(widget, index);

        this._applyFilter(widget);
        widget._syncSelected();
        widget._updateTabIndex();
    }

    _onChildVisibleChange(widget) {
        super._onChildVisibleChange(widget);

        this._updateShownRows();
    }

    _onChildrenChange() {
        super._onChildrenChange();

        // The removed rows no longer count for the cursor, the anchor and the selection.
        if (this._cursorRow && !this._children.includes(this._cursorRow)) {
            this._cursorRow._setCursor(false);
            this._cursorRow = null;
        }

        if (this._anchorRow && !this._children.includes(this._anchorRow)) {
            this._anchorRow = null;
        }

        this._syncSelectionState();
        this._updateShownRows();
    }

    _detachChildElement(widget) {
        super._detachChildElement(widget);

        if (widget instanceof ListBoxRow && widget.selected) {
            this._changeSelection(() => widget._setSelected(false));
        }

        widget._setCursor(false);
    }

    _updateLayout() {
        super._updateLayout();

        this.invalidateHeaders();
    }

    /**
     * Updates everything that depends on which rows are shown: the placeholder, the tab stop and
     * (at the end of the task) the headers.
     *
     * @protected
     */
    _updateShownRows() {
        const hasRows = this._children.some((x) => x.visible && x._isRowShown());
        this._placeholderEl.hidden = hasRows || !this._placeholder;
        this.el.classList.toggle('wy-empty', !hasRows);

        refreshAuxiliaryWidgets([this._placeholder]);

        this._refreshTabStop();
        this._queueLayout();
    }

    _onRowChanged(row) {
        this._changeSelection(() => this._applyFilter(row));

        if (this._sortFunction && !this._model) {
            const index = this._findSortedIndex(row);
            const current = this._children.indexOf(row);
            this.reorderChild(row, index > current ? index - 1 : index);
        }

        this._updateShownRows();
    }

    _wrap(widget) {
        if (!(widget instanceof Widget)) {
            throw new TypeError('Only widgets can be added to a list box.');
        }

        const row = new ListBoxRow();
        row.addChild(widget);

        return row;
    }

    _checkRow(row) {
        if (!(row instanceof ListBoxRow) || row.parent !== this) {
            throw new Error('The row is not in this list box.');
        }
    }

    _findSortedIndex(row) {
        const compare = this._sortFunction;
        const index = this._children.findIndex((x) => x !== row && compare(row, x) < 0);

        return index < 0 ? this._children.length : index;
    }

    _applyFilter(row) {
        const shown = !this._filterFunction || Boolean(this._filterFunction(row));
        if (shown === !row._filtered) {
            return;
        }

        const hadFocus = row._containsFocusWidget();
        row._setFiltered(!shown);

        if (!shown) {
            // Filtered rows are deselected, and the focus moves to the next row.
            row._setSelected(false);

            if (row === this._cursorRow) {
                row._setCursor(false);
                this._cursorRow = null;
            }

            if (hadFocus) {
                const next = this._getNavigableRows()[0];
                if (next) {
                    this._setCursorRow(next, true);
                } else {
                    this.window?._onFocusWidgetGone(row);
                }
            }
        }
    }

    _isNavigable(row) {
        return row.visible && row._isRowShown() && row.isSensitive;
    }

    _getNavigableRows() {
        return this._children.filter((x) => this._isNavigable(x));
    }

    _canSelect(row) {
        return this._selectionMode !== SelectionMode.NONE && row.selectable && row._isRowShown();
    }

    /**
     * Runs a function that changes the selection, and emits the selection signals once afterwards
     * if it changed.
     *
     * @protected
     * @param {() => void} method
     */
    _changeSelection(method) {
        this._selectionBatch += 1;

        try {
            method();
        } finally {
            this._selectionBatch -= 1;
        }

        if (!this._selectionBatch) {
            this._syncSelectionState();
        }
    }

    _syncSelectionState() {
        if (this._selectionBatch) {
            return;
        }

        const selected = this._children.filter((x) => x.selected);
        const old = this._lastSelection;

        const changed =
            old.length !== selected.length || old.some((row, index) => row !== selected[index]);

        this._lastSelection = selected;

        if (!changed) {
            return;
        }

        this.emit('selected-rows-change', this);

        if (
            this._selectionMode === SelectionMode.SINGLE ||
            this._selectionMode === SelectionMode.BROWSE
        ) {
            const row = selected[0] || null;
            if (row !== this._lastSelectedRow) {
                this._lastSelectedRow = row;
                this.emit('row-select', this, row);
            }
        }
    }

    _unselectAllExcept(keep) {
        for (const row of this._children) {
            if (row !== keep) {
                row._setSelected(false);
            }
        }
    }

    _selectRange(from, to, replace) {
        const start = Math.min(this._children.indexOf(from), this._children.indexOf(to));
        const end = Math.max(this._children.indexOf(from), this._children.indexOf(to));

        this._children.forEach((row, index) => {
            const inRange = index >= start && index <= end && this._canSelect(row);

            if (inRange) {
                row._setSelected(true);
            } else if (replace) {
                row._setSelected(false);
            }
        });
    }

    /**
     * Moves the cursor to a row.
     *
     * @protected
     * @param {ListBoxRow | null} row
     * @param {boolean} focus Whether to give the row the keyboard focus.
     */
    _setCursorRow(row, focus) {
        if (this._cursorRow !== row) {
            this._cursorRow?._setCursor(false);
            this._cursorRow = row;
            row?._setCursor(true);

            this._refreshTabStop();
        }

        if (row && focus) {
            if (!row.focus()) {
                row.focusElement.focus();
            }

            row.focusElement.scrollIntoView?.({ block: 'nearest' });
        }
    }

    /**
     * Selects a row because the user pressed it, like GTK: with `multiple`, Control toggles it and
     * Shift selects the range from the anchor; with `single`, Control deselects a selected row.
     *
     * @protected
     * @param {ListBoxRow} row
     * @param {boolean} modify Whether Control was held.
     * @param {boolean} extend Whether Shift was held.
     */
    _updateSelection(row, modify, extend) {
        this._setCursorRow(row, true);

        if (!this._canSelect(row)) {
            return;
        }

        const mode = this._selectionMode;

        this._changeSelection(() => {
            if (mode === SelectionMode.MULTIPLE) {
                if (extend && this._anchorRow) {
                    this._selectRange(this._anchorRow, row, !modify);

                    return;
                }

                if (modify) {
                    row._setSelected(!row.selected);
                } else {
                    this._unselectAllExcept(row);
                    row._setSelected(true);
                }

                this._anchorRow = row;
            } else if (mode === SelectionMode.SINGLE && modify && row.selected) {
                row._setSelected(false);
            } else {
                this._unselectAllExcept(row);
                row._setSelected(true);
            }
        });
    }

    /**
     * Moves the cursor with the keyboard, selecting as GTK does.
     *
     * @protected
     * @param {ListBoxRow | null} row
     * @param {boolean} modify Whether Control was held: only the cursor moves.
     * @param {boolean} extend Whether Shift was held: the selection is extended (with `multiple`).
     */
    _moveCursor(row, modify, extend) {
        if (!row) {
            return;
        }

        const previous = this._cursorRow;
        this._setCursorRow(row, true);

        if (!this._canSelect(row)) {
            return;
        }

        const mode = this._selectionMode;

        this._changeSelection(() => {
            if (mode === SelectionMode.MULTIPLE && extend) {
                if (!this._anchorRow) {
                    this._anchorRow = previous || row;
                }

                this._selectRange(this._anchorRow, row, !modify);
            } else if (!modify) {
                this._unselectAllExcept(row);
                row._setSelected(true);
                this._anchorRow = row;
            }
        });
    }

    /**
     * Returns the row a page away from the cursor row, as far as the visible part of the list.
     *
     * @protected
     * @param {number} direction 1 for Page Down, -1 for Page Up.
     * @returns {ListBoxRow | null}
     */
    _getPageRow(direction) {
        const rows = this._getNavigableRows();
        const cursor = rows.includes(this._cursorRow) ? this._cursorRow : null;
        if (!cursor) {
            return direction > 0 ? rows[rows.length - 1] || null : rows[0] || null;
        }

        const page = this._getViewportHeight();
        const top = cursor.focusElement.getBoundingClientRect().top;
        const target = top + direction * page;

        let result = cursor;
        for (const row of direction > 0 ? rows : [...rows].reverse()) {
            const rowTop = row.focusElement.getBoundingClientRect().top;
            if (direction > 0 ? rowTop > target : rowTop < target) {
                break;
            }

            result = row;
        }

        // Always move at least one row.
        if (result === cursor) {
            const index = rows.indexOf(cursor) + direction;
            result = rows[Math.max(0, Math.min(index, rows.length - 1))];
        }

        return result;
    }

    _getViewportHeight() {
        for (let element = this.el.parentElement; element; element = element.parentElement) {
            const style = getComputedStyle(element);

            if (
                /(auto|scroll)/.test(style.overflowY) &&
                element.scrollHeight > element.clientHeight
            ) {
                return element.clientHeight;
            }
        }

        return Math.min(this.el.clientHeight, window.innerHeight);
    }

    _getRowFromTarget(target, onlyBody) {
        let widget = Widget.fromElement(target);

        while (widget && widget.parent !== this) {
            // Presses on a widget in the row that handles them itself are left to it.
            if (onlyBody && widget.canFocus && !(widget instanceof ListBoxRow)) {
                return null;
            }

            widget = widget.parent;
        }

        if (!(widget instanceof ListBoxRow) || !widget.focusElement.contains(target)) {
            return null;
        }

        return widget;
    }

    _onPointerDown(event) {
        if (event.button !== 0 || !this.isSensitive) {
            return;
        }

        const row = this._getRowFromTarget(event.target, true);
        if (!row || !row.isSensitive) {
            return;
        }

        this._updateSelection(row, event.ctrlKey || event.metaKey, event.shiftKey);
    }

    _onClick(event) {
        const row = this._getRowFromTarget(event.target, true);
        if (
            !row ||
            !this._activateOnSingleClick ||
            event.detail > 1 ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey
        ) {
            return;
        }

        row.activate();
    }

    _onDoublePress(event) {
        const row = this._getRowFromTarget(event.target, true);
        if (row && !this._activateOnSingleClick) {
            row.activate();
        }
    }

    _onFocusIn(event) {
        const row = this._getRowFromTarget(event.target, false);
        if (row && event.target === row.focusElement) {
            this._setCursorRow(row, false);
        }
    }

    _onKeyDown(event) {
        if (event.defaultPrevented || event.altKey || !this.isSensitive) {
            return;
        }

        const row = this._getRowFromTarget(event.target, false);
        if (!row || event.target !== row.focusElement) {
            return;
        }

        const modify = event.ctrlKey || event.metaKey;
        const extend = event.shiftKey;
        const rows = this._getNavigableRows();
        const index = rows.indexOf(row);

        switch (event.key) {
            case Key.UP:
                this._moveCursor(rows[Math.max(0, index - 1)], modify, extend);
                break;

            case Key.DOWN:
                this._moveCursor(rows[Math.min(rows.length - 1, index + 1)], modify, extend);
                break;

            case Key.HOME:
                this._moveCursor(rows[0], modify, extend);
                break;

            case Key.END:
                this._moveCursor(rows[rows.length - 1], modify, extend);
                break;

            case Key.PAGE_UP:
                this._moveCursor(this._getPageRow(-1), modify, extend);
                break;

            case Key.PAGE_DOWN:
                this._moveCursor(this._getPageRow(1), modify, extend);
                break;

            case Key.SPACE:
            case Key.ENTER:
                if (modify && event.key === Key.SPACE) {
                    this._updateSelection(row, true, false);
                } else {
                    this._updateSelection(row, false, extend);
                    row.activate();
                }

                break;

            default:
                if (modify && event.key.toLowerCase() === Key.A) {
                    if (extend) {
                        this.unselectAll();
                    } else {
                        this.selectAll();
                    }

                    break;
                }

                return;
        }

        event.preventDefault();
    }

    _syncSelectionMode() {
        const mode = this._selectionMode;

        this.el.classList.toggle('wy-selectable-rows', mode !== SelectionMode.NONE);

        if (mode === SelectionMode.MULTIPLE) {
            this.el.setAttribute('aria-multiselectable', 'true');
        } else {
            this.el.removeAttribute('aria-multiselectable');
        }

        for (const row of this._children) {
            row._syncSelected();
        }
    }

    _createModelRow(index) {
        const widget = this._createWidgetFunction(this._model.getRow(index), index);
        if (!(widget instanceof Widget)) {
            throw new TypeError('The function of a bound list box must return a widget.');
        }

        return widget instanceof ListBoxRow ? widget : this._wrap(widget);
    }

    _runBinding(method) {
        this._binding = true;
        try {
            this._changeSelection(method);
        } finally {
            this._binding = false;
        }
    }

    _getModelKey(index) {
        const model = this._model;

        return model.idColumn ? model.getRowIdByIndex(index) : model.getRow(index);
    }

    _rebuildFromModel() {
        const model = this._model;

        // Keep the selection and the cursor on the same model rows (by id, or else by object).
        const selectedKeys = new Set();
        let cursorKey;
        let cursorHadFocus = false;

        for (const row of this._children) {
            if (row.selected) {
                selectedKeys.add(row._modelKey);
            }

            if (row === this._cursorRow) {
                cursorKey = row._modelKey;
                cursorHadFocus = row._containsFocusWidget();
            }
        }

        this._runBinding(() => {
            this.removeAllChildren();

            for (let index = 0; index < model.rowsCount; ++index) {
                const row = this._createModelRow(index);
                row._modelKey = this._getModelKey(index);
                super.insertChild(row, index);

                if (selectedKeys.has(row._modelKey)) {
                    row._setSelected(true);
                }

                if (cursorKey !== undefined && row._modelKey === cursorKey) {
                    this._setCursorRow(row, cursorHadFocus);
                }
            }
        });
    }

    _onModelRowInsert(index) {
        this._runBinding(() => {
            const row = this._createModelRow(index);
            row._modelKey = this._getModelKey(index);
            super.insertChild(row, index);
        });
    }

    _onModelRowRemove(index) {
        const row = this._children[index];
        if (!row) {
            return;
        }

        const hadFocus = row._containsFocusWidget();

        this._runBinding(() => row.destroy());

        if (hadFocus) {
            const rows = this._getNavigableRows();
            this._setCursorRow(rows[Math.min(index, rows.length - 1)] || null, true);
        }
    }

    _onModelRowMove(from, to) {
        const row = this._children[from];
        if (row) {
            this.reorderChild(row, to);
        }
    }

    _onModelRowUpdate(index) {
        const old = this._children[index];
        if (!old) {
            return;
        }

        // The row is made again; it keeps its selection and the cursor.
        const selected = old.selected;
        const cursor = old === this._cursorRow;
        const hadFocus = old._containsFocusWidget();

        this._runBinding(() => {
            old.destroy();

            const row = this._createModelRow(index);
            row._modelKey = this._getModelKey(index);
            super.insertChild(row, index);

            if (selected) {
                row._setSelected(true);
            }

            if (cursor) {
                this._setCursorRow(row, hadFocus);
            }
        });
    }
}

defineProperties(ListBox, {
    /**
     * How rows can be selected: one of `SelectionMode`. A mask of `SelectionModes` (as tables use)
     * is converted. Changing it keeps at most the first selected row, except with `multiple`.
     */
    selectionMode: {
        value: SelectionMode.SINGLE,
        coerce: toSelectionMode,
        changed(mode) {
            this._changeSelection(() => {
                if (mode === SelectionMode.NONE) {
                    this._unselectAllExcept(null);
                } else if (mode !== SelectionMode.MULTIPLE) {
                    this._unselectAllExcept(this.getSelectedRow());
                }
            });

            this._syncSelectionMode();
        },
    },

    /**
     * Whether a single click activates a row. Otherwise a double click does.
     */
    activateOnSingleClick: { value: true, coerce: Boolean },

    /**
     * The selected rows, in order.
     */
    selectedRows: {
        readOnly: true,
        get() {
            return this._children.filter((x) => x.selected);
        },
    },

    /**
     * The row with the keyboard cursor, or `null`.
     */
    cursorRow: {
        readOnly: true,
        get() {
            return this._cursorRow || null;
        },
    },

    /**
     * A function that decides which rows are shown, or `null` to show all rows. It gets a row and
     * returns whether to show it. Rows that are filtered out are deselected.
     */
    filterFunction: {
        value: null,
        coerce: (x) => checkFunction(x, 'filter function'),
        changed() {
            this.invalidateFilter();
        },
    },

    /**
     * A function that orders the rows, or `null` to keep them in the order they were added. It
     * gets two rows and returns a negative number, zero or a positive number, like the compare
     * function of `Array.prototype.sort()`.
     */
    sortFunction: {
        value: null,
        coerce: (x) => checkFunction(x, 'sort function'),
        changed() {
            this.invalidateSort();
        },
    },

    /**
     * The header function (see `setHeaderFunction()`), or `null`.
     */
    headerFunction: {
        value: null,
        coerce: (x) => checkFunction(x, 'header function'),
        changed(headerFunction) {
            if (headerFunction) {
                this.invalidateHeaders();
            } else {
                for (const row of this._children) {
                    row.header = null;
                }
            }
        },
    },

    /**
     * A widget shown instead of the rows while no row is shown, such as a label saying the list is
     * empty, or `null`. The list box owns it.
     */
    placeholder: {
        value: null,
        set(widget) {
            if (widget !== null && !(widget instanceof Widget)) {
                throw new TypeError('The placeholder of a list box must be a widget or null.');
            }

            const old = this._placeholder;
            if (old) {
                this._releasePlaceholder?.();
                this._releasePlaceholder = null;
                old.destroy();
            }

            this._placeholder = widget;

            if (widget) {
                this._releasePlaceholder = attachAuxiliaryWidget(
                    this,
                    widget,
                    this._placeholderEl,
                    () => {
                        this._releasePlaceholder = null;
                        this._placeholder = null;
                        this._updateShownRows();
                    }
                );
            }

            this._updateShownRows();
        },
    },

    /**
     * The bound model (see `bindModel()`), or `null`.
     */
    model: { value: null, readOnly: true },
});

registerType('list-box', ListBox);
registerType('list-box-row', ListBoxRow);
