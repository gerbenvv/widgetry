/**
 * @module widgets/combo-box
 */

import { Align } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement, uniqueId } from '../core/util.js';
import { Key } from '../events/constants.js';
import { getLocaleManager } from '../i18n/locale-manager.js';
import { Popover, PopoverCloseReason } from './popover.js';
import { Widget } from './widget.js';

/**
 * How long in milliseconds typed characters are combined for type-ahead search.
 *
 * @type {number}
 */
export const TYPE_AHEAD_TIMEOUT = 1000;

/**
 * The number of items Page Up and Page Down move in the open list.
 *
 * @type {number}
 */
const PAGE_ITEMS = 10;

/**
 * @typedef {object} ComboBoxItem
 * @property {string | number | null} id An identifier, or `null`.
 * @property {string} label The text shown.
 * @property {boolean} sensitive Whether the item can be chosen.
 */

/**
 * Converts an item description (a label, or an object with `id`, `label` and optionally
 * `sensitive`) to an item.
 *
 * @param {string | number | {id?: string | number | null, label?: unknown, sensitive?: boolean}}
 *     item
 * @returns {ComboBoxItem}
 */
function toItem(item) {
    if (typeof item === 'string' || typeof item === 'number') {
        return { id: null, label: String(item), sensitive: true };
    }

    if (!item || typeof item !== 'object') {
        throw new TypeError('A combo box item must be a string or an object with a label.');
    }

    return {
        id: item.id ?? null,
        label: item.label === null || item.label === undefined ? '' : String(item.label),
        sensitive: item.sensitive !== false,
    };
}

/**
 * Lets the user choose one of a list of items, shown in a popup list.
 *
 * Items have a label and an optional `id`. The chosen item is `activeIndex` (-1 for none), or
 * `activeId`; both stay valid when items are added or removed. Instead of `items`, a `model` can
 * provide the items: its rows are shown by their `column`, and identified by the model's id column.
 *
 * With `hasEntry`, the combo box has a text entry where any text can be typed; choosing an item
 * puts its label in the entry, and typing the label of an item makes it active.
 *
 * Keyboard: Up and Down (and Home and End) choose another item while the list is closed; Space,
 * Enter, Alt+Down and F4 open the list, where Up, Down, Page Up, Page Down, Home and End move
 * through the items and Enter, Space or Tab choose one; Escape closes it. Typing the first letters
 * of an item selects it.
 *
 * Signals: `change` (the active item changed), `activate` (Enter in the entry, with `hasEntry`),
 * `active-index-change`, `active-id-change`, `popup-open-change`.
 *
 * @example
 * const combo = new ComboBox({
 *     items: [{ id: 'red', label: 'Red' }, { id: 'green', label: 'Green' }],
 *     activeId: 'green',
 * });
 */
export class ComboBox extends Widget {
    _initialize() {
        super._initialize();

        /** @type {ComboBoxItem[]} */
        this._items = [];
        this._highlighted = -1;
        this._typeAhead = '';
        this._typeAheadTime = 0;
        this._modelDisconnects = [];
        this._pressOpened = false;
        this._entryText = '';

        this._listId = uniqueId('wy-combo-box-list');

        this._popover = new Popover({ owner: this, matchAnchorWidth: true });
        this._popover.addStyleClass('wy-combo-box-popover');
        this._popover.connect('close', (_popover, reason) => this._onPopoverClose(reason));

        this._listEl = createElement(
            `<div class="wy-combo-box-list" role="listbox" id="${this._listId}"></div>`
        );
        this._popover.contentElement.append(this._listEl);

        this._buttonEl.addEventListener('pointerdown', (event) => this._onButtonPointerDown(event));
        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));
        this._entryEl.addEventListener('input', () => this._onEntryInput());
        this.el.addEventListener('focusout', (event) => this._onFocusOut(event));

        this._listEl.addEventListener('pointermove', (event) => this._onListPointerMove(event));
        this._listEl.addEventListener('click', (event) => this._onListClick(event));

        this._onDocumentPointerUp = this._onDocumentPointerUp.bind(this);

        this._updateEntryMode();
    }

    _render() {
        const element = createElement(`
            <div class="wy-combo-box" role="combobox" aria-haspopup="listbox" aria-expanded="false">
                <input class="wy-combo-box-entry" type="text" autocomplete="off" spellcheck="false" hidden />
                <div class="wy-combo-box-button">
                    <span class="wy-combo-box-label">
                        <span class="wy-combo-box-sizer" aria-hidden="true"></span>
                        <span class="wy-combo-box-text"></span>
                    </span>
                    <span class="wy-combo-box-arrow" aria-hidden="true"></span>
                </div>
            </div>
        `);

        this._entryEl = element.querySelector('.wy-combo-box-entry');
        this._buttonEl = element.querySelector('.wy-combo-box-button');
        this._sizerEl = element.querySelector('.wy-combo-box-sizer');
        this._textEl = element.querySelector('.wy-combo-box-text');

        return element;
    }

    /**
     * The element with the focus: the root element, or the entry with `hasEntry`.
     *
     * @type {HTMLElement}
     */
    get focusElement() {
        return this._hasEntry ? this._entryEl : this.el;
    }

    /**
     * Returns both the root element and the entry, which are the focus element without and with
     * `hasEntry`.
     *
     * @protected
     * @returns {Element[]}
     */
    _getAccessibleNameElements() {
        return [this.el, this._entryEl];
    }

    /**
     * The popover showing the list.
     *
     * @type {Popover}
     */
    get popover() {
        return this._popover;
    }

    /**
     * Returns an item.
     *
     * @param {number} index
     * @returns {ComboBoxItem}
     * @throws {RangeError} If there is no such item.
     */
    getItem(index) {
        const item = this._items[index];
        if (!item) {
            throw new RangeError(`There is no item at index ${index}.`);
        }

        return { ...item };
    }

    /**
     * Returns the index of the first item with an id, or -1.
     *
     * @param {string | number} id
     * @returns {number}
     */
    indexOfId(id) {
        return this._items.findIndex((x) => x.id !== null && x.id === id);
    }

    /**
     * Adds an item at the end.
     *
     * @param {string | {id?: string | number | null, label: string, sensitive?: boolean}} item
     * @returns {number} The index of the item.
     */
    appendItem(item) {
        return this.insertItem(this._items.length, item);
    }

    /**
     * Adds an item at the start.
     *
     * @param {string | {id?: string | number | null, label: string, sensitive?: boolean}} item
     * @returns {number} The index of the item.
     */
    prependItem(item) {
        return this.insertItem(0, item);
    }

    /**
     * Inserts an item. The active item stays active.
     *
     * @param {number} index Between 0 and `itemsCount`.
     * @param {string | {id?: string | number | null, label: string, sensitive?: boolean}} item
     * @returns {number} The index of the item.
     * @throws {RangeError} If the index is out of range.
     */
    insertItem(index, item) {
        this._checkNoModel();

        if (index < 0 || index > this._items.length) {
            throw new RangeError(`Invalid item index ${index}.`);
        }

        this._items.splice(index, 0, toItem(item));

        const active = this._activeIndex;
        this._renderItems();

        if (active >= index) {
            this._setActiveIndex(active + 1, false);
        }

        return index;
    }

    /**
     * Removes an item. When it was active, no item is active afterwards.
     *
     * @param {number} index
     * @throws {RangeError} If there is no such item.
     */
    removeItem(index) {
        this._checkNoModel();
        this.getItem(index);

        this._items.splice(index, 1);

        const active = this._activeIndex;
        this._renderItems();

        if (active === index) {
            this._setActiveIndex(-1, true);
        } else if (active > index) {
            this._setActiveIndex(active - 1, false);
        }
    }

    /**
     * Removes all items.
     */
    removeAllItems() {
        this.items = [];
    }

    /**
     * Opens the list.
     */
    popup() {
        this.popupOpen = true;
    }

    /**
     * Closes the list.
     */
    popdown() {
        this.popupOpen = false;
    }

    /**
     * Opens the list if it is closed, and closes it otherwise.
     */
    togglePopup() {
        this.popupOpen = !this._popupOpen;
    }

    destroy() {
        document.removeEventListener('pointerup', this._onDocumentPointerUp, true);

        this._connectModel(null);
        this._popover.destroy();

        super.destroy();
    }

    _checkNoModel() {
        if (this._model) {
            throw new Error('The items of a combo box with a model come from the model.');
        }
    }

    /**
     * Replaces the items, keeping the active item active if it is still there (by id, or else by
     * label).
     *
     * @protected
     * @param {ComboBoxItem[]} items
     */
    _setItems(items) {
        const old = this._items[this._activeIndex] || null;

        this._items = items;
        this._renderItems();

        let index = -1;
        if (old && old.id !== null) {
            index = this.indexOfId(old.id);
        } else if (old) {
            index = items.findIndex((x) => x.label === old.label);
        }

        const changed = !old || index < 0;
        this._setActiveIndex(index, changed && Boolean(old));
    }

    _renderItems() {
        const document = this.el.ownerDocument;

        this._listEl.textContent = '';
        this._sizerEl.textContent = '';

        this._items.forEach((item, index) => {
            const option = document.createElement('div');
            option.className = 'wy-combo-box-item';
            option.id = `${this._listId}-${index}`;
            option.setAttribute('role', 'option');
            option.dataset.index = String(index);
            option.textContent = item.label || '\u00a0';

            if (!item.sensitive) {
                option.classList.add('wy-insensitive');
                option.setAttribute('aria-disabled', 'true');
            }

            this._listEl.append(option);

            // The sizer holds every label, so the combo box is as wide as its widest item.
            const sizer = document.createElement('span');
            sizer.textContent = item.label;
            this._sizerEl.append(sizer);
        });

        this._highlighted = Math.min(this._highlighted, this._items.length - 1);
        this._syncList();

        if (this._popupOpen) {
            this._popover.reposition();
        }
    }

    _syncList() {
        for (const option of this._listEl.children) {
            const index = Number(option.dataset.index);

            option.setAttribute('aria-selected', String(index === this._activeIndex));
            option.classList.toggle('wy-active', index === this._activeIndex);
            option.classList.toggle('wy-highlighted', index === this._highlighted);
        }

        const target = this.focusElement;
        if (this._popupOpen && this._highlighted >= 0) {
            target.setAttribute('aria-activedescendant', `${this._listId}-${this._highlighted}`);
        } else {
            target.removeAttribute('aria-activedescendant');
        }
    }

    _setActiveIndex(index, emitChange) {
        const oldId = this.activeId;
        const changed = index !== this._activeIndex;

        this._activeIndex = index;

        const item = this._items[index] || null;
        this._textEl.textContent = item ? item.label : '';
        this._buttonEl.classList.toggle('wy-empty', !item);

        if (this._hasEntry && item) {
            this._setEntryText(item.label);
        }

        this._syncList();

        if (changed) {
            this.emit('active-index-change', this);
        }

        if (this.activeId !== oldId) {
            this.emit('active-id-change', this);
        }

        if (emitChange) {
            this.emit('change', this);
        }
    }

    /**
     * Makes an item active because the user chose it.
     *
     * @protected
     * @param {number} index
     */
    _choose(index) {
        const item = this._items[index];
        if (!item || !item.sensitive) {
            return;
        }

        if (this._hasEntry) {
            this._setEntryText(item.label);
        }

        if (index !== this._activeIndex) {
            this._setActiveIndex(index, true);
        }
    }

    /**
     * Puts a text in the entry, as the text of the combo box.
     *
     * @protected
     * @param {string} text
     */
    _setEntryText(text) {
        if (this._entryEl.value !== text) {
            this._entryEl.value = text;
        }

        if (text !== this._entryText) {
            this._entryText = text;
            this.emit('text-change', this);
        }
    }

    _findSensitive(start, step) {
        for (let index = start; index >= 0 && index < this._items.length; index += step) {
            if (this._items[index].sensitive) {
                return index;
            }
        }

        return -1;
    }

    _showPopup() {
        if (this._popupOpen || !this.isSensitive || !this.isVisible || !this._items.length) {
            return false;
        }

        this._popupOpen = true;
        this._highlighted = this._activeIndex >= 0 ? this._activeIndex : this._findSensitive(0, 1);

        this.el.classList.add('wy-active');
        this.focusElement.setAttribute('aria-expanded', 'true');
        this.focusElement.setAttribute('aria-controls', this._listId);

        this._popover.popup(this.el);
        this._syncList();
        this._scrollToHighlighted();

        this.emit('popup-open-change', this);

        return true;
    }

    _hidePopup() {
        if (!this._popupOpen) {
            return false;
        }

        this._popover.popdown();

        return true;
    }

    _onPopoverClose(_reason) {
        if (!this._popupOpen) {
            return;
        }

        this._popupOpen = false;
        this._pressOpened = false;

        this.el.classList.remove('wy-active');
        this.focusElement.setAttribute('aria-expanded', 'false');
        this.focusElement.removeAttribute('aria-controls');

        this._syncList();

        this.emit('popup-open-change', this);
    }

    _scrollToHighlighted() {
        const option = this._listEl.children[this._highlighted];
        option?.scrollIntoView({ block: 'nearest' });
    }

    _highlight(index) {
        if (index < 0 || index === this._highlighted) {
            return;
        }

        this._highlighted = index;
        this._syncList();
        this._scrollToHighlighted();
    }

    _typeAheadSearch(character) {
        const now = performance.now();
        if (now - this._typeAheadTime > TYPE_AHEAD_TIMEOUT) {
            this._typeAhead = '';
        }

        this._typeAheadTime = now;
        this._typeAhead += character;

        const locale = getLocaleManager().locale;
        const prefix = this._typeAhead.toLocaleLowerCase(locale);

        // Typing the same letter again cycles through the items starting with it.
        const repeated = [...prefix].every((x) => x === prefix[0]);
        const search = repeated ? prefix[0] : prefix;
        const current = this._popupOpen ? this._highlighted : this._activeIndex;
        const start = repeated ? current + 1 : Math.max(current, 0);

        const count = this._items.length;
        for (let offset = 0; offset < count; offset++) {
            const index = (start + offset) % count;
            const item = this._items[index];

            if (item.sensitive && item.label.toLocaleLowerCase(locale).startsWith(search)) {
                return index;
            }
        }

        return -1;
    }

    _updateEntryMode() {
        const hasEntry = this._hasEntry;

        // The focus element changes; the list and the focus move along.
        const focused = this.el.contains(document.activeElement);
        this._hidePopup();

        this.el.classList.toggle('wy-has-entry', hasEntry);
        this._entryEl.hidden = !hasEntry;

        if (hasEntry) {
            this.el.removeAttribute('role');
            this.el.removeAttribute('aria-haspopup');
            this.el.removeAttribute('aria-expanded');
            this.el.removeAttribute('tabindex');

            this._entryEl.setAttribute('role', 'combobox');
            this._entryEl.setAttribute('aria-haspopup', 'listbox');
            this._entryEl.setAttribute('aria-autocomplete', 'list');
            this._entryEl.setAttribute('aria-expanded', String(this._popupOpen));

            const item = this._items[this._activeIndex];
            this._entryEl.value = this._entryText;

            if (item) {
                this._setEntryText(item.label);
            }
        } else {
            this._entryEl.tabIndex = -1;

            this.el.setAttribute('role', 'combobox');
            this.el.setAttribute('aria-haspopup', 'listbox');
            this.el.setAttribute('aria-expanded', String(this._popupOpen));
        }

        this._updateTabIndex();

        if (focused) {
            this.focusElement.focus({ preventScroll: true });
        }
    }

    _connectModel(model) {
        for (const disconnect of this._modelDisconnects) {
            disconnect();
        }

        this._modelDisconnects = [];

        if (model) {
            this._modelDisconnects = ['rows-change', 'id-column-change'].map((name) =>
                model.connect(name, () => this._loadModel())
            );
        }
    }

    _loadModel() {
        const model = this._model;
        if (!model) {
            return;
        }

        const rows = typeof model.getRows === 'function' ? model.getRows() : model.rows;
        const idColumn =
            typeof model.getIdColumn === 'function' ? model.getIdColumn() : model.idColumn;
        const column = this._column;

        const items = (rows || []).map((row) => {
            const label = column ? row[column] : Object.values(row)[0];

            return toItem({ id: idColumn ? row[idColumn] : null, label });
        });

        this._setItems(items);
    }

    _onButtonPointerDown(event) {
        if (event.button !== 0 || !this.isSensitive) {
            return;
        }

        // Keep the focus on the entry, which would otherwise lose it to the button.
        if (this._hasEntry) {
            event.preventDefault();
        }

        this.focus();

        if (this._popupOpen) {
            this._hidePopup();
        } else if (this._showPopup()) {
            // Releasing over an item after dragging from the combo box chooses it, like a menu.
            this._pressOpened = true;
            document.addEventListener('pointerup', this._onDocumentPointerUp, true);
        }
    }

    _onDocumentPointerUp(event) {
        document.removeEventListener('pointerup', this._onDocumentPointerUp, true);

        const pressOpened = this._pressOpened;
        this._pressOpened = false;

        if (!pressOpened || !this._popupOpen) {
            return;
        }

        const option = event.target.closest?.('.wy-combo-box-item');
        if (option && this._listEl.contains(option)) {
            this._choose(Number(option.dataset.index));
            this._hidePopup();
        }
    }

    _onListPointerMove(event) {
        const option = event.target.closest('.wy-combo-box-item');
        if (option && !option.classList.contains('wy-insensitive')) {
            this._highlighted = Number(option.dataset.index);
            this._syncList();
        }
    }

    _onListClick(event) {
        const option = event.target.closest('.wy-combo-box-item');
        if (!option || option.classList.contains('wy-insensitive')) {
            return;
        }

        this._choose(Number(option.dataset.index));
        this._hidePopup();
    }

    _onFocusOut(event) {
        // The list closes when the focus leaves the combo box.
        if (this._popupOpen && !this.el.contains(event.relatedTarget)) {
            this._popover.popdown(PopoverCloseReason.BLUR);
        }
    }

    _onEntryInput() {
        const text = this._entryEl.value;
        this._entryText = text;

        // Typing the label of an item makes it active.
        const index = this._items.findIndex((x) => x.label === text);
        if (index !== this._activeIndex) {
            this._setActiveIndex(index, true);
        }

        this.emit('text-change', this);
    }

    _onKeyDown(event) {
        if (event.defaultPrevented || !this.isSensitive || event.isComposing) {
            return;
        }

        const handled = this._popupOpen ? this._onOpenKeyDown(event) : this._onClosedKeyDown(event);
        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    _onClosedKeyDown(event) {
        const count = this._items.length;
        const active = this._activeIndex;

        if ((event.altKey && event.key === Key.DOWN) || event.key === Key.F4) {
            this._showPopup();

            return true;
        }

        if (event.altKey || event.ctrlKey || event.metaKey) {
            return false;
        }

        switch (event.key) {
            case Key.DOWN:
                this._choose(this._findSensitive(active < 0 ? 0 : active + 1, 1));
                return true;

            case Key.UP:
                this._choose(this._findSensitive(active < 0 ? count - 1 : active - 1, -1));
                return true;

            case Key.HOME:
            case Key.PAGE_UP:
                if (this._hasEntry && event.key === Key.HOME) {
                    return false;
                }

                this._choose(this._findSensitive(0, 1));
                return true;

            case Key.END:
            case Key.PAGE_DOWN:
                if (this._hasEntry && event.key === Key.END) {
                    return false;
                }

                this._choose(this._findSensitive(count - 1, -1));
                return true;

            case Key.ENTER:
                if (this._hasEntry) {
                    this.emit('activate', this);

                    return false;
                }

                this._showPopup();
                return true;

            case Key.SPACE:
                if (this._hasEntry) {
                    return false;
                }

                this._showPopup();
                return true;
        }

        if (!this._hasEntry && event.key.length === 1 && event.key !== ' ') {
            this._choose(this._typeAheadSearch(event.key));

            return true;
        }

        return false;
    }

    _onOpenKeyDown(event) {
        const count = this._items.length;
        const highlighted = this._highlighted;

        if (event.altKey && event.key === Key.UP) {
            this._choose(highlighted);
            this._hidePopup();

            return true;
        }

        switch (event.key) {
            case Key.DOWN:
                this._highlight(this._findSensitive(highlighted + 1, 1));
                return true;

            case Key.UP:
                this._highlight(this._findSensitive(Math.max(highlighted - 1, 0), -1));
                return true;

            case Key.PAGE_DOWN:
                this._highlight(
                    this._findSensitive(Math.min(highlighted + PAGE_ITEMS, count - 1), -1)
                );
                return true;

            case Key.PAGE_UP:
                this._highlight(this._findSensitive(Math.max(highlighted - PAGE_ITEMS, 0), 1));
                return true;

            case Key.HOME:
                this._highlight(this._findSensitive(0, 1));
                return true;

            case Key.END:
                this._highlight(this._findSensitive(count - 1, -1));
                return true;

            case Key.ENTER:
            case Key.SPACE:
                if (this._hasEntry && event.key === Key.SPACE) {
                    return false;
                }

                this._choose(highlighted);
                this._hidePopup();
                return true;

            case Key.TAB:
                // Tab chooses the highlighted item and moves on, so do not handle it.
                this._choose(highlighted);
                this._hidePopup();
                return false;
        }

        if (!this._hasEntry && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
            this._highlight(this._typeAheadSearch(event.key));

            return true;
        }

        return false;
    }
}

defineProperties(ComboBox, {
    canFocus: {
        value: true,
    },

    vAlign: { value: Align.CENTER },

    /**
     * The items, as objects with `id`, `label` and `sensitive`. Set an array of labels or of
     * objects with a `label` and optionally an `id` and `sensitive`. The active item stays active
     * if it is still there.
     */
    items: {
        get() {
            return this._items.map((x) => ({ ...x }));
        },
        set(items) {
            this._checkNoModel();

            if (!Array.isArray(items)) {
                throw new TypeError('The items of a combo box must be an array.');
            }

            this._setItems(items.map(toItem));
        },
    },

    /**
     * The number of items.
     */
    itemsCount: {
        readOnly: true,
        get() {
            return this._items.length;
        },
    },

    /**
     * A model providing the items instead of `items`, or `null`: an object with `rows` (or
     * `getRows()`), optionally `idColumn` (or `getIdColumn()`), and a `rows-change` signal.
     */
    model: {
        value: null,
        changed(model) {
            this._connectModel(model);

            if (model) {
                this._loadModel();
            } else {
                this._setItems([]);
            }
        },
    },

    /**
     * The column of the model rows to show, or `null` for the first column.
     */
    column: {
        value: null,
        changed() {
            this._loadModel();
        },
    },

    /**
     * The index of the active item, or -1 if there is none. It is set after the items, so both can
     * be given to the constructor in any order (the same holds for `activeId` and `text`).
     */
    activeIndex: {
        late: true,
        value: -1,
        signal: false,
        coerce(index) {
            const value = Number(index);
            if (!Number.isInteger(value) || value < -1 || value >= this._items.length) {
                throw new RangeError(`There is no item at index ${index}.`);
            }

            return value;
        },
        set(index) {
            this._setActiveIndex(index, true);

            return false;
        },
    },

    /**
     * The id of the active item, or `null` if there is none or it has no id.
     */
    activeId: {
        late: true,
        signal: false,
        get() {
            return this._items[this._activeIndex]?.id ?? null;
        },
        set(id) {
            if (id === null || id === undefined) {
                this.activeIndex = -1;

                return false;
            }

            const index = this.indexOfId(id);
            if (index < 0) {
                throw new Error(`There is no item with id '${id}'.`);
            }

            this.activeIndex = index;

            return false;
        },
    },

    /**
     * The text: the label of the active item, or with `hasEntry` the text of the entry. Setting
     * it without an entry makes the first item with that label active.
     */
    text: {
        late: true,
        signal: false,
        get() {
            if (this._hasEntry) {
                return this._entryText;
            }

            return this._items[this._activeIndex]?.label ?? '';
        },
        set(text) {
            text = text === null || text === undefined ? '' : String(text);

            if (this._hasEntry) {
                if (text === this._entryText) {
                    return false;
                }

                this._entryEl.value = text;
                this._onEntryInput();

                return false;
            }

            this.activeIndex = this._items.findIndex((x) => x.label === text);

            return false;
        },
    },

    /**
     * Whether the combo box has a text entry, where any text can be typed.
     */
    hasEntry: {
        value: false,
        coerce: Boolean,
        changed() {
            this._updateEntryMode();
        },
    },

    /**
     * Whether the list is open. Setting it opens or closes the list.
     */
    popupOpen: {
        value: false,
        signal: false,
        set(open) {
            if (open) {
                this._showPopup();
            } else {
                this._hidePopup();
            }

            return false;
        },
    },

    /**
     * Text shown while no item is active (or the entry is empty), as a hint.
     */
    placeholder: {
        value: '',
        changed(placeholder) {
            this._entryEl.placeholder = placeholder || '';
            this._textEl.dataset.placeholder = placeholder || '';
        },
    },
});

registerType('combo-box', ComboBox);
