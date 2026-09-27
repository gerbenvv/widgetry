/**
 * @module widgets/combo-box
 */
import { Popover } from './popover.js';
import { Widget } from './widget.js';
/**
 * How long in milliseconds typed characters are combined for type-ahead search.
 *
 * @type {number}
 */
export declare const TYPE_AHEAD_TIMEOUT: number;
export type ComboBoxItem = {
    /**
     * An identifier, or `null`.
     */
    id: string | number | null;
    /**
     * The text shown.
     */
    label: string;
    /**
     * Whether the item can be chosen.
     */
    sensitive: boolean;
};
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
export declare class ComboBox extends Widget {
    /** @type {ComboBoxItem[]} */
    _items: ComboBoxItem[];
    _highlighted: any;
    _typeAhead: string;
    _typeAheadTime: number;
    _modelDisconnects: any[];
    _pressOpened: boolean;
    _entryText: any;
    _listId: string;
    _popover: Popover;
    _listEl: HTMLElement;
    _entryEl: Element;
    _buttonEl: Element;
    _sizerEl: Element;
    _textEl: Element;
    items: any[];
    popupOpen: boolean;
    _activeIndex: any;
    _popupOpen: boolean;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The element with the focus: the root element, or the entry with `hasEntry`.
     *
     * @type {HTMLElement}
     */
    get focusElement(): HTMLElement;
    /**
     * The popover showing the list.
     *
     * @type {Popover}
     */
    get popover(): Popover;
    /**
     * Returns an item.
     *
     * @param {number} index
     * @returns {ComboBoxItem}
     * @throws {RangeError} If there is no such item.
     */
    getItem(index: number): ComboBoxItem;
    /**
     * Returns the index of the first item with an id, or -1.
     *
     * @param {string | number} id
     * @returns {number}
     */
    indexOfId(id: string | number): number;
    /**
     * Adds an item at the end.
     *
     * @param {string | {id?: string | number | null, label: string, sensitive?: boolean}} item
     * @returns {number} The index of the item.
     */
    appendItem(item: string | {
        id?: string | number | null;
        label: string;
        sensitive?: boolean;
    }): number;
    /**
     * Adds an item at the start.
     *
     * @param {string | {id?: string | number | null, label: string, sensitive?: boolean}} item
     * @returns {number} The index of the item.
     */
    prependItem(item: string | {
        id?: string | number | null;
        label: string;
        sensitive?: boolean;
    }): number;
    /**
     * Inserts an item. The active item stays active.
     *
     * @param {number} index Between 0 and `itemsCount`.
     * @param {string | {id?: string | number | null, label: string, sensitive?: boolean}} item
     * @returns {number} The index of the item.
     * @throws {RangeError} If the index is out of range.
     */
    insertItem(index: number, item: string | {
        id?: string | number | null;
        label: string;
        sensitive?: boolean;
    }): number;
    /**
     * Removes an item. When it was active, no item is active afterwards.
     *
     * @param {number} index
     * @throws {RangeError} If there is no such item.
     */
    removeItem(index: number): void;
    /**
     * Removes all items.
     */
    removeAllItems(): void;
    /**
     * Opens the list.
     */
    openPopup(): void;
    /**
     * Closes the list.
     */
    closePopup(): void;
    /**
     * Opens the list if it is closed, and closes it otherwise.
     */
    togglePopup(): void;
    destroy(): void;
    _checkNoModel(): void;
    /**
     * Replaces the items, keeping the active item active if it is still there (by id, or else by
     * label).
     *
     * @protected
     * @param {ComboBoxItem[]} items
     */
    protected _setItems(items: ComboBoxItem[]): void;
    _renderItems(): void;
    _syncList(): void;
    _setActiveIndex(index: any, emitChange: any): void;
    /**
     * Makes an item active because the user chose it.
     *
     * @protected
     * @param {number} index
     */
    protected _choose(index: number): void;
    _findSensitive(start: any, step: any): any;
    _showPopup(): boolean;
    _hidePopup(): boolean;
    _onPopoverClose(_reason: any): void;
    _scrollToHighlighted(): void;
    _highlight(index: any): void;
    _typeAheadSearch(character: any): number;
    _updateEntryMode(): void;
    _connectModel(model: any): void;
    _loadModel(): void;
    _onButtonPointerDown(event: any): void;
    _onDocumentPointerUp(event: any): void;
    _onListPointerMove(event: any): void;
    _onListClick(event: any): void;
    _onFocusOut(event: any): void;
    _onEntryInput(): void;
    _onKeyDown(event: any): void;
    _onClosedKeyDown(event: any): boolean;
    _onOpenKeyDown(event: any): boolean;
}

/** The declared properties of {@link ComboBox}. */
export interface ComboBox {
    canFocus: boolean;
    vAlign: any;
    /**
     * The number of items.
     */
    readonly itemsCount: any;
    /**
     * A model providing the items instead of `items`, or `null`: an object with `rows` (or
     * `getRows()`), optionally `idColumn` (or `getIdColumn()`), and a `rows-change` signal.
     */
    model: any;
    /**
     * The column of the model rows to show, or `null` for the first column.
     */
    column: any;
    /**
     * The index of the active item, or -1 if there is none.
     */
    activeIndex: number;
    /**
     * The same as `activeIndex`.
     */
    active: any;
    /**
     * The id of the active item, or `null` if there is none or it has no id.
     */
    activeId: any;
    /**
     * The text: the label of the active item, or with `hasEntry` the text of the entry. Setting
     * it without an entry makes the first item with that label active.
     */
    text: any;
    /**
     * Whether the combo box has a text entry, where any text can be typed.
     */
    hasEntry: boolean;
    /**
     * Text shown while no item is active (or the entry is empty), as a hint.
     */
    placeholder: string;
    /**
     * The accessible name of the combo box, for combo boxes without a visible label.
     */
    accessibleName: string;
}
