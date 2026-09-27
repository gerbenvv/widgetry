/**
 * @module widgets/notebook
 */
import { Container } from './container.js';
import { Widget } from './widget.js';
export type NotebookTab = {
    /**
     * The tab.
     */
    tabEl: HTMLElement;
    /**
     * The element the label text or widget is in.
     */
    labelEl: HTMLElement;
    /**
     * The close button.
     */
    closeEl: HTMLElement;
    /**
     * The element the page is in.
     */
    pageEl: HTMLElement;
    /**
     * The label text, when there is no label widget.
     */
    text: string;
    labelWidget: Widget | null;
    /**
     * Releases the label widget.
     */
    release: (() => void) | null;
    /**
     * Whether the tab has a close button; `null` follows the
     * notebook's `closable`.
     */
    closable: boolean | null;
};
/**
 * @typedef {object} NotebookTab
 * @property {HTMLElement} tabEl The tab.
 * @property {HTMLElement} labelEl The element the label text or widget is in.
 * @property {HTMLElement} closeEl The close button.
 * @property {HTMLElement} pageEl The element the page is in.
 * @property {string} text The label text, when there is no label widget.
 * @property {Widget | null} labelWidget
 * @property {(() => void) | null} release Releases the label widget.
 * @property {boolean | null} closable Whether the tab has a close button; `null` follows the
 *     notebook's `closable`.
 */
/**
 * Pages with tabs, of which one page is shown at a time, like GTK's notebook.
 *
 * Add pages with `appendPage(child, tabLabel)`, where the tab label is a text or a widget. The
 * notebook is as large as its largest page. The tabs can be at any side (`tabPosition`), scroll
 * when they do not fit (`scrollable`), have a close button (`closable`, or per page with
 * `setTabClosable()`) and be reordered by dragging (`reorderable`).
 *
 * Keyboard: the tabs take the focus; the arrow keys, Home and End switch pages there, and
 * Delete closes a closable page. Ctrl+Page Up and Ctrl+Page Down switch pages from anywhere in
 * the notebook.
 *
 * Signals: `switch-page` (`notebook, page, index`) after the current page changed,
 * `page-add` and `page-remove` (`notebook, page, index`), `page-reorder` (`notebook, page,
 * index`) and `page-close` (`notebook, page, index`), emitted when the close button of a tab is
 * clicked: the page is destroyed unless a handler returns `true`.
 */
export declare class Notebook extends Container {
    /** @type {Map<Widget, NotebookTab>} */
    _tabs: Map<Widget, NotebookTab>;
    _pendingLabel: string | Widget;
    _drag: {
        child: any;
        move: (moveEvent: any) => void;
        end: () => void;
        started: boolean;
    };
    _current: any;
    _tabsObserver: ResizeObserver;
    _headerEl: Element;
    _tabsEl: Element;
    _backwardEl: Element;
    _forwardEl: Element;
    _bodyEl: Element;
    _currentPage: number;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The tab list, which takes the keyboard focus.
     *
     * @type {HTMLElement}
     */
    get focusElement(): HTMLElement;
    /**
     * Adds a page at the end.
     *
     * @param {Widget} child The page.
     * @param {string | Widget} [tabLabel] The text or widget of its tab.
     * @returns {number} The index of the page.
     */
    appendPage(child: Widget, tabLabel?: string | Widget): number;
    /**
     * Adds a page at the start.
     *
     * @param {Widget} child
     * @param {string | Widget} [tabLabel]
     * @returns {number} The index of the page.
     */
    prependPage(child: Widget, tabLabel?: string | Widget): number;
    /**
     * Inserts a page.
     *
     * @param {Widget} child
     * @param {string | Widget} [tabLabel]
     * @param {number} [position] The index, or -1 (the default) for the end.
     * @returns {number} The index of the page.
     */
    insertPage(child: Widget, tabLabel?: string | Widget, position?: number): number;
    /**
     * Removes a page, without destroying it.
     *
     * @param {number} index The index, or -1 for the last page.
     * @returns {Widget} The removed page.
     */
    removePage(index: number): Widget;
    /**
     * Returns a page.
     *
     * @param {number} index
     * @returns {Widget}
     * @throws {RangeError} If there is no such page.
     */
    getPage(index: number): Widget;
    /**
     * Returns the index of a page, or -1.
     *
     * @param {Widget} child
     * @returns {number}
     */
    pageNum(child: Widget): number;
    /**
     * Switches to the next visible page, if any.
     */
    nextPage(): void;
    /**
     * Switches to the previous visible page, if any.
     */
    previousPage(): void;
    /**
     * Sets the tab label of a page: a text or a widget.
     *
     * @param {Widget} child
     * @param {string | Widget | null} label
     */
    setTabLabel(child: Widget, label: string | Widget | null): void;
    /**
     * Returns the tab label widget of a page, or `null` if it has a text label.
     *
     * @param {Widget} child
     * @returns {Widget | null}
     */
    getTabLabel(child: Widget): Widget | null;
    /**
     * Returns the tab label text of a page, or `null` if it has a label widget.
     *
     * @param {Widget} child
     * @returns {string | null}
     */
    getTabLabelText(child: Widget): string | null;
    /**
     * Sets the tab label text of a page.
     *
     * @param {Widget} child
     * @param {string} text
     */
    setTabLabelText(child: Widget, text: string): void;
    /**
     * Sets whether the tab of a page has a close button, overriding `closable`.
     *
     * @param {Widget} child
     * @param {boolean | null} closable `null` to follow the notebook's `closable`.
     */
    setTabClosable(child: Widget, closable: boolean | null): void;
    /**
     * Returns whether the tab of a page has a close button.
     *
     * @param {Widget} child
     * @returns {boolean}
     */
    getTabClosable(child: Widget): boolean;
    /**
     * Closes a page as if its close button was clicked: emits `page-close`, and destroys the page
     * unless a handler returned `true`.
     *
     * @param {Widget} child
     * @returns {boolean} Whether the page was closed.
     */
    closePage(child: Widget): boolean;
    insertChild(widget: any, index: any): any;
    removeChild(widget: any): number;
    reorderChild(widget: any, index: any): void;
    destroy(): void;
    _getFocusChain(): any[];
    _onIsVisibleChange(isVisible: any): void;
    _onIsSensitiveChange(isSensitive: any): void;
    _onChildVisibleChange(widget: any): void;
    _attachChildElement(widget: any, index: any): void;
    _detachChildElement(widget: any): void;
    _createTab(widget: any): {
        tabEl: HTMLElement;
        labelEl: Element;
        closeEl: Element;
        pageEl: HTMLElement;
        text: string;
        labelWidget: any;
        release: any;
        closable: any;
    };
    _getTab(child: any): NotebookTab;
    _syncTab(child: any): void;
    _syncCurrent(): void;
    _setCurrent(child: any): void;
    _findVisible(start: any, step: any): Widget;
    _step(step: any): void;
    _scrollToCurrentTab(): void;
    _isVerticalTabs(): boolean;
    _syncArrows(): void;
    _syncTabPosition(): void;
    _syncFlags(): void;
    _getChildOfTab(element: any): Widget;
    _onTabsPointerDown(event: any): void;
    _startDrag(event: any, child: any): void;
    _dragTo(child: any, coordinate: any, vertical: any): void;
    _endDrag(): void;
    _onTabsKeyDown(event: any): void;
    _onKeyDown(event: any): void;
    _onTabsWheel(event: any): void;
}
export declare namespace Notebook {
    var builderProperties: {
        /**
         * Builds the pages. A page object may have a `tabLabel` (or `tab-label`): a text, or a widget
         * object to build.
         *
         * @param {object} builder
         * @param {Notebook} notebook
         * @param {object[]} children
         */
        children(builder: object, notebook: Notebook, children: object[]): void;
    };
}

/** The declared properties of {@link Notebook}. */
export interface Notebook {
    /**
     * Notebooks take the keyboard focus on their tabs.
     */
    canFocus: any;
    /**
     * The index of the shown page, or -1 when there is none. Setting an invisible page has no
     * effect.
     */
    currentPage: number;
    /**
     * The number of pages.
     */
    readonly pageCount: any;
    /**
     * The side the tabs are at: one of `Position`.
     */
    tabPosition: any;
    /**
     * Whether the tabs are shown.
     */
    showTabs: boolean;
    /**
     * Whether a border is drawn around the pages.
     */
    showBorder: boolean;
    /**
     * Whether the tabs scroll, with arrow buttons, when they do not fit. Otherwise the notebook
     * is at least as large as all its tabs.
     */
    scrollable: boolean;
    /**
     * Whether tabs have a close button, unless set per page with `setTabClosable()`.
     */
    closable: boolean;
    /**
     * Whether the user can reorder the tabs by dragging them.
     */
    reorderable: boolean;
}
