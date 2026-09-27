/**
 * @module widgets/notebook
 */

import { Position } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { settings } from '../core/settings.js';
import { createElement, uniqueId } from '../core/util.js';
import { Key } from '../events/constants.js';
import {
    attachAuxiliaryWidget,
    getAuxiliaryFocusChain,
    refreshAuxiliaryWidgets,
} from './auxiliary.js';
import { Container } from './container.js';
import { Widget } from './widget.js';

/**
 * The tab positions, for validating `tabPosition`.
 *
 * @type {ReadonlySet<string>}
 */
const TAB_POSITIONS = new Set(Object.values(Position));

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
export class Notebook extends Container {
    _initialize() {
        super._initialize();

        /** @type {Map<Widget, NotebookTab>} */
        this._tabs = new Map();

        // The tab label of the page being inserted.
        this._pendingLabel = '';
        this._drag = null;
        this._current = null;

        this._tabsEl.addEventListener('pointerdown', (event) => this._onTabsPointerDown(event));
        this._tabsEl.addEventListener('keydown', (event) => this._onTabsKeyDown(event));
        this._tabsEl.addEventListener('wheel', (event) => this._onTabsWheel(event), {
            passive: false,
        });
        this._tabsEl.addEventListener('scroll', () => this._syncArrows());
        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));

        this._backwardEl.addEventListener('click', () => this.previousPage());
        this._forwardEl.addEventListener('click', () => this.nextPage());

        this._tabsObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            this._tabsObserver = new ResizeObserver(() => {
                if (!this.destroyed) {
                    this._scrollToCurrentTab();
                }
            });

            this._tabsObserver.observe(this._tabsEl);
        }

        this._syncTabPosition();
        this._syncFlags();
    }

    _render() {
        const element = createElement(`
            <div class="wy-notebook wy-tabs-top wy-show-border">
                <div class="wy-notebook-header">
                    <button type="button" class="wy-notebook-arrow wy-notebook-arrow-backward" tabindex="-1" aria-hidden="true"></button>
                    <div class="wy-notebook-tabs" role="tablist"></div>
                    <button type="button" class="wy-notebook-arrow wy-notebook-arrow-forward" tabindex="-1" aria-hidden="true"></button>
                </div>
                <div class="wy-notebook-pages"></div>
            </div>
        `);

        this._headerEl = element.querySelector('.wy-notebook-header');
        this._tabsEl = element.querySelector('.wy-notebook-tabs');
        this._backwardEl = element.querySelector('.wy-notebook-arrow-backward');
        this._forwardEl = element.querySelector('.wy-notebook-arrow-forward');
        this._bodyEl = element.querySelector('.wy-notebook-pages');

        return element;
    }

    /**
     * The tab list, which takes the keyboard focus.
     *
     * @type {HTMLElement}
     */
    get focusElement() {
        return this._tabsEl;
    }

    /**
     * Adds a page at the end.
     *
     * @param {Widget} child The page.
     * @param {string | Widget} [tabLabel] The text or widget of its tab.
     * @returns {number} The index of the page.
     */
    appendPage(child, tabLabel = '') {
        return this.insertPage(child, tabLabel, this._children.length);
    }

    /**
     * Adds a page at the start.
     *
     * @param {Widget} child
     * @param {string | Widget} [tabLabel]
     * @returns {number} The index of the page.
     */
    prependPage(child, tabLabel = '') {
        return this.insertPage(child, tabLabel, 0);
    }

    /**
     * Inserts a page.
     *
     * @param {Widget} child
     * @param {string | Widget} [tabLabel]
     * @param {number} [position] The index, or -1 (the default) for the end.
     * @returns {number} The index of the page.
     */
    insertPage(child, tabLabel = '', position = -1) {
        const index = position < 0 ? this._children.length : position;

        this._pendingLabel = tabLabel ?? '';
        try {
            this.insertChild(child, index);
        } finally {
            this._pendingLabel = '';
        }

        return this._children.indexOf(child);
    }

    /**
     * Removes a page, without destroying it.
     *
     * @param {number} index The index, or -1 for the last page.
     * @returns {Widget} The removed page.
     */
    removePage(index) {
        const page = this.getPage(index < 0 ? this._children.length - 1 : index);
        this.removeChild(page);

        return page;
    }

    /**
     * Returns a page.
     *
     * @param {number} index
     * @returns {Widget}
     * @throws {RangeError} If there is no such page.
     */
    getPage(index) {
        return this.getChild(index);
    }

    /**
     * Returns the index of a page, or -1.
     *
     * @param {Widget} child
     * @returns {number}
     */
    pageNum(child) {
        return this._children.indexOf(child);
    }

    /**
     * Switches to the next visible page, if any.
     */
    nextPage() {
        this._step(1);
    }

    /**
     * Switches to the previous visible page, if any.
     */
    previousPage() {
        this._step(-1);
    }

    /**
     * Sets the tab label of a page: a text or a widget.
     *
     * @param {Widget} child
     * @param {string | Widget | null} label
     */
    setTabLabel(child, label) {
        const tab = this._getTab(child);

        tab.release?.();
        tab.release = null;
        tab.labelWidget = null;
        tab.labelEl.textContent = '';
        tab.text = '';

        if (label instanceof Widget) {
            tab.labelWidget = label;
            tab.release = attachAuxiliaryWidget(this, label, tab.labelEl, () => {
                tab.release = null;
                tab.labelWidget = null;
            });
        } else {
            tab.text = label === null || label === undefined ? '' : String(label);
            tab.labelEl.textContent = tab.text;
        }
    }

    /**
     * Returns the tab label widget of a page, or `null` if it has a text label.
     *
     * @param {Widget} child
     * @returns {Widget | null}
     */
    getTabLabel(child) {
        return this._getTab(child).labelWidget;
    }

    /**
     * Returns the tab label text of a page, or `null` if it has a label widget.
     *
     * @param {Widget} child
     * @returns {string | null}
     */
    getTabLabelText(child) {
        const tab = this._getTab(child);

        return tab.labelWidget ? null : tab.text;
    }

    /**
     * Sets the tab label text of a page.
     *
     * @param {Widget} child
     * @param {string} text
     */
    setTabLabelText(child, text) {
        this.setTabLabel(child, String(text ?? ''));
    }

    /**
     * Sets whether the tab of a page has a close button, overriding `closable`.
     *
     * @param {Widget} child
     * @param {boolean | null} closable `null` to follow the notebook's `closable`.
     */
    setTabClosable(child, closable) {
        const tab = this._getTab(child);
        tab.closable = closable === null || closable === undefined ? null : Boolean(closable);

        this._syncTab(child);
    }

    /**
     * Returns whether the tab of a page has a close button.
     *
     * @param {Widget} child
     * @returns {boolean}
     */
    getTabClosable(child) {
        const tab = this._getTab(child);

        return tab.closable ?? this._closable;
    }

    /**
     * Closes a page as if its close button was clicked: emits `page-close`, and destroys the page
     * unless a handler returned `true`.
     *
     * @param {Widget} child
     * @returns {boolean} Whether the page was closed.
     */
    closePage(child) {
        const index = this._children.indexOf(child);
        if (index < 0) {
            throw new Error('The widget is not a page of this notebook.');
        }

        if (this.emit('page-close', this, child, index)) {
            return false;
        }

        child.destroy();

        return true;
    }

    insertChild(widget, index) {
        const label = this._pendingLabel;

        super.insertChild(widget, index);

        this.setTabLabel(widget, label);
        this._syncTab(widget);

        this.emit('page-add', this, widget, this._children.indexOf(widget));

        if (!this._current && widget.visible) {
            this._setCurrent(widget);
        } else {
            this._syncCurrent();
        }

        return widget;
    }

    removeChild(widget) {
        const wasCurrent = widget === this._current;
        const index = super.removeChild(widget);

        const tab = this._tabs.get(widget);
        this._tabs.delete(widget);

        tab.release?.();
        tab.labelWidget?.destroy();
        tab.tabEl.remove();
        tab.pageEl.remove();

        this.emit('page-remove', this, widget, index);

        if (wasCurrent) {
            this._current = null;
            this._setCurrent(this._findVisible(index, 1) || this._findVisible(index - 1, -1));
        } else {
            this._syncCurrent();
        }

        return index;
    }

    reorderChild(widget, index) {
        super.reorderChild(widget, index);

        this._syncCurrent();
        this.emit('page-reorder', this, widget, this._children.indexOf(widget));
    }

    destroy() {
        this._endDrag();
        this._tabsObserver?.disconnect();

        for (const tab of this._tabs.values()) {
            tab.labelWidget?.destroy();
        }

        super.destroy();
    }

    _getFocusChain() {
        const page = this._current;
        if (!page || !page.isVisible || !page.isSensitive) {
            return [];
        }

        const chain = page.canFocus ? [page] : [];
        if (page instanceof Container) {
            chain.push(...page._getFocusChain());
        }

        // The label widget of the current tab, e.g. with a button, comes first.
        const tab = this._tabs.get(page);

        return [...getAuxiliaryFocusChain(tab?.labelWidget ?? null), ...chain];
    }

    _onIsVisibleChange(isVisible) {
        super._onIsVisibleChange(isVisible);

        refreshAuxiliaryWidgets([...this._tabs.values()].map((x) => x.labelWidget));
    }

    _onIsSensitiveChange(isSensitive) {
        super._onIsSensitiveChange(isSensitive);

        refreshAuxiliaryWidgets([...this._tabs.values()].map((x) => x.labelWidget));
    }

    _onChildVisibleChange(widget) {
        super._onChildVisibleChange(widget);

        if (!this._tabs.has(widget)) {
            return;
        }

        this._syncTab(widget);

        if (!widget.visible && widget === this._current) {
            const index = this._children.indexOf(widget);
            this._setCurrent(this._findVisible(index + 1, 1) || this._findVisible(index - 1, -1));
        } else if (widget.visible && !this._current) {
            this._setCurrent(widget);
        }
    }

    _attachChildElement(widget, index) {
        let tab = this._tabs.get(widget);
        if (!tab) {
            tab = this._createTab(widget);
            this._tabs.set(widget, tab);
        }

        tab.pageEl.append(widget.el);

        const next = this._children[index + 1];
        const nextTab = next ? this._tabs.get(next) : null;

        this._bodyEl.insertBefore(tab.pageEl, nextTab ? nextTab.pageEl : null);
        this._tabsEl.insertBefore(tab.tabEl, nextTab ? nextTab.tabEl : null);
    }

    _detachChildElement(widget) {
        const tab = this._tabs.get(widget);

        tab?.tabEl.remove();
        tab?.pageEl.remove();
    }

    _createTab(widget) {
        const tabId = uniqueId('wy-notebook-tab');
        const pageId = uniqueId('wy-notebook-page');

        const tabEl = createElement(`
            <div class="wy-notebook-tab" role="tab" id="${tabId}" aria-controls="${pageId}" aria-selected="false">
                <span class="wy-notebook-tab-label"></span>
                <button type="button" class="wy-notebook-tab-close" tabindex="-1" aria-label="Close"></button>
            </div>
        `);

        const pageEl = createElement(
            `<div class="wy-notebook-page" role="tabpanel" id="${pageId}" aria-labelledby="${tabId}"></div>`
        );

        const closeEl = tabEl.querySelector('.wy-notebook-tab-close');
        closeEl.addEventListener('pointerdown', (event) => event.stopPropagation());
        closeEl.addEventListener('click', (event) => {
            event.stopPropagation();

            if (this.isSensitive) {
                this.closePage(widget);
            }
        });

        return {
            tabEl,
            labelEl: tabEl.querySelector('.wy-notebook-tab-label'),
            closeEl,
            pageEl,
            text: '',
            labelWidget: null,
            release: null,
            closable: null,
        };
    }

    _getTab(child) {
        const tab = this._tabs.get(child);
        if (!tab) {
            throw new Error('The widget is not a page of this notebook.');
        }

        return tab;
    }

    _syncTab(child) {
        const tab = this._tabs.get(child);
        if (!tab) {
            return;
        }

        const current = child === this._current;

        tab.tabEl.hidden = !child.visible;
        tab.tabEl.classList.toggle('wy-active', current);
        tab.tabEl.setAttribute('aria-selected', String(current));
        tab.closeEl.hidden = !(tab.closable ?? this._closable);

        tab.pageEl.classList.toggle('wy-current', current);
        tab.pageEl.inert = !current;
        tab.pageEl.setAttribute('aria-hidden', String(!current));
    }

    _syncCurrent() {
        for (const child of this._children) {
            this._syncTab(child);
        }

        const tab = this._current ? this._tabs.get(this._current) : null;
        if (tab) {
            this._tabsEl.setAttribute('aria-activedescendant', tab.tabEl.id);
        } else {
            this._tabsEl.removeAttribute('aria-activedescendant');
        }

        this._syncArrows();
    }

    _setCurrent(child) {
        if (child === this._current) {
            this._syncCurrent();

            return;
        }

        // Keep the focus in the notebook when it was in the page that is hidden now.
        const focusWidget = this.window?.focusWidget;
        const hadFocusInPage = Boolean(
            focusWidget && this._current && this._current.isAncestorOf(focusWidget)
        );

        this._current = child || null;
        this._currentPage = child ? this._children.indexOf(child) : -1;

        this._syncCurrent();
        this._scrollToCurrentTab();

        if (hadFocusInPage) {
            this.focus();
        }

        this.emit('current-page-change', this);
        this.emit('switch-page', this, this._current, this._currentPage);
    }

    _findVisible(start, step) {
        for (let i = start; i >= 0 && i < this._children.length; i += step) {
            if (this._children[i].visible) {
                return this._children[i];
            }
        }

        return null;
    }

    _step(step) {
        const index = this._children.indexOf(this._current);
        const next = this._findVisible(index + step, step);

        if (next) {
            this._setCurrent(next);
        }
    }

    _scrollToCurrentTab() {
        const tab = this._current ? this._tabs.get(this._current) : null;
        if (!tab || !this._tabsEl.isConnected) {
            return;
        }

        const strip = this._tabsEl;
        const vertical = this._isVerticalTabs();

        const start = vertical ? tab.tabEl.offsetTop : tab.tabEl.offsetLeft;
        const size = vertical ? tab.tabEl.offsetHeight : tab.tabEl.offsetWidth;
        const scroll = vertical ? strip.scrollTop : strip.scrollLeft;
        const page = vertical ? strip.clientHeight : strip.clientWidth;

        let value = scroll;
        if (start < scroll) {
            value = start;
        } else if (start + size > scroll + page) {
            value = start + size - page;
        }

        if (vertical) {
            strip.scrollTop = value;
        } else {
            strip.scrollLeft = value;
        }

        this._syncArrows();
    }

    _isVerticalTabs() {
        return this._tabPosition === Position.LEFT || this._tabPosition === Position.RIGHT;
    }

    _syncArrows() {
        const strip = this._tabsEl;
        const vertical = this._isVerticalTabs();

        const overflows =
            this._scrollable &&
            (vertical
                ? strip.scrollHeight > strip.clientHeight + 1
                : strip.scrollWidth > strip.clientWidth + 1);

        this.el.classList.toggle('wy-overflowing', overflows);

        const index = this._children.indexOf(this._current);
        this._backwardEl.disabled = !this._findVisible(index - 1, -1);
        this._forwardEl.disabled = !this._findVisible(index + 1, 1);
    }

    _syncTabPosition() {
        for (const position of TAB_POSITIONS) {
            this.el.classList.toggle(`wy-tabs-${position}`, position === this._tabPosition);
        }

        this._tabsEl.setAttribute(
            'aria-orientation',
            this._isVerticalTabs() ? 'vertical' : 'horizontal'
        );

        this._syncArrows();
    }

    _syncFlags() {
        this.el.classList.toggle('wy-show-border', this._showBorder);
        this.el.classList.toggle('wy-scrollable', this._scrollable);
        this.el.classList.toggle('wy-reorderable', this._reorderable);
        this._headerEl.hidden = !this._showTabs;

        this._syncCurrent();
    }

    _getChildOfTab(element) {
        for (const [child, tab] of this._tabs) {
            if (tab.tabEl === element) {
                return child;
            }
        }

        return null;
    }

    _onTabsPointerDown(event) {
        if (event.button !== 0 || !this.isSensitive) {
            return;
        }

        const tabEl = event.target.closest('.wy-notebook-tab');
        const child = tabEl ? this._getChildOfTab(tabEl) : null;
        if (!child) {
            return;
        }

        // Keep presses on an interactive label widget to that widget.
        const labelWidget = this._tabs.get(child).labelWidget;
        if (labelWidget && labelWidget.el.contains(event.target) && labelWidget.canFocus) {
            return;
        }

        event.preventDefault();

        this._setCurrent(child);
        this.focus();

        if (this._reorderable) {
            this._startDrag(event, child);
        }
    }

    _startDrag(event, child) {
        this._endDrag();

        const strip = this._tabsEl;
        strip.setPointerCapture(event.pointerId);

        const vertical = this._isVerticalTabs();
        const startCoordinate = vertical ? event.clientY : event.clientX;

        const move = (moveEvent) => {
            const coordinate = vertical ? moveEvent.clientY : moveEvent.clientX;
            const drag = this._drag;

            if (!drag.started) {
                if (Math.abs(coordinate - startCoordinate) < settings.dragThreshold) {
                    return;
                }

                drag.started = true;
                this._tabs.get(child).tabEl.classList.add('wy-dragging');
            }

            this._dragTo(child, coordinate, vertical);
        };

        const end = () => this._endDrag();

        strip.addEventListener('pointermove', move);
        strip.addEventListener('pointerup', end);
        strip.addEventListener('pointercancel', end);

        this._drag = { child, move, end, started: false };
    }

    _dragTo(child, coordinate, vertical) {
        const index = this._children.indexOf(child);
        const tabs = this._children.map((x) => this._tabs.get(x).tabEl);

        // Move past a neighbor once the pointer passes its middle.
        let target = index;
        for (let i = 0; i < tabs.length; ++i) {
            if (i === index || tabs[i].hidden) {
                continue;
            }

            const rect = tabs[i].getBoundingClientRect();
            const middle = vertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;

            if (i < index && coordinate < middle) {
                target = Math.min(target, i);
            } else if (i > index && coordinate > middle) {
                target = Math.max(target, i);
            }
        }

        if (target !== index) {
            this.reorderChild(child, target);
        }
    }

    _endDrag() {
        const drag = this._drag;
        if (!drag) {
            return;
        }

        this._drag = null;

        const strip = this._tabsEl;
        strip.removeEventListener('pointermove', drag.move);
        strip.removeEventListener('pointerup', drag.end);
        strip.removeEventListener('pointercancel', drag.end);

        this._tabs.get(drag.child)?.tabEl.classList.remove('wy-dragging');
    }

    _onTabsKeyDown(event) {
        if (event.target !== this._tabsEl || event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }

        const vertical = this._isVerticalTabs();

        switch (event.key) {
            case vertical ? Key.UP : Key.LEFT:
                this.previousPage();
                break;

            case vertical ? Key.DOWN : Key.RIGHT:
                this.nextPage();
                break;

            case Key.HOME:
                this._setCurrent(this._findVisible(0, 1));
                break;

            case Key.END:
                this._setCurrent(this._findVisible(this._children.length - 1, -1));
                break;

            case Key.DELETE:
                if (this._current && this.getTabClosable(this._current)) {
                    this.closePage(this._current);
                    break;
                }

                return;

            default:
                return;
        }

        event.preventDefault();
        event.stopPropagation();
    }

    _onKeyDown(event) {
        if (!event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) {
            return;
        }

        if (event.key === Key.PAGE_UP) {
            this.previousPage();
        } else if (event.key === Key.PAGE_DOWN) {
            this.nextPage();
        } else {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
    }

    _onTabsWheel(event) {
        if (!this.isSensitive || !event.deltaY || event.ctrlKey) {
            return;
        }

        event.preventDefault();

        if (event.deltaY > 0) {
            this.nextPage();
        } else {
            this.previousPage();
        }
    }
}

defineProperties(Notebook, {
    /**
     * Notebooks take the keyboard focus on their tabs.
     */
    canFocus: { value: true },

    /**
     * The index of the shown page, or -1 when there is none. Setting an invisible page has no
     * effect.
     */
    currentPage: {
        value: -1,
        signal: false,
        get() {
            return this._current ? this._children.indexOf(this._current) : -1;
        },
        set(index) {
            if (!Number.isInteger(index) || index < -1 || index >= this._children.length) {
                throw new RangeError(`Invalid page index: ${index}.`);
            }

            const child = index < 0 ? null : this._children[index];
            if (child && !child.visible) {
                return false;
            }

            this._setCurrent(child);

            return false;
        },
    },

    /**
     * The number of pages.
     */
    pageCount: {
        readOnly: true,
        get() {
            return this._children.length;
        },
    },

    /**
     * The side the tabs are at: one of `Position`.
     */
    tabPosition: {
        value: Position.TOP,
        coerce(position) {
            if (!TAB_POSITIONS.has(position)) {
                throw new TypeError(`Invalid tab position: ${position}.`);
            }

            return position;
        },
        changed() {
            this._syncTabPosition();
        },
    },

    /**
     * Whether the tabs are shown.
     */
    showTabs: {
        value: true,
        changed() {
            this._syncFlags();
        },
    },

    /**
     * Whether a border is drawn around the pages.
     */
    showBorder: {
        value: true,
        changed() {
            this._syncFlags();
        },
    },

    /**
     * Whether the tabs scroll, with arrow buttons, when they do not fit. Otherwise the notebook
     * is at least as large as all its tabs.
     */
    scrollable: {
        value: false,
        changed() {
            this._syncFlags();
        },
    },

    /**
     * Whether tabs have a close button, unless set per page with `setTabClosable()`.
     */
    closable: {
        value: false,
        changed() {
            this._syncFlags();
        },
    },

    /**
     * Whether the user can reorder the tabs by dragging them.
     */
    reorderable: {
        value: false,
        changed() {
            this._syncFlags();
        },
    },
});

Notebook.builderProperties = {
    /**
     * Builds the pages. A page object may have a `tabLabel` (or `tab-label`): a text, or a widget
     * object to build.
     *
     * @param {object} builder
     * @param {Notebook} notebook
     * @param {object[]} children
     */
    children(builder, notebook, children) {
        if (!Array.isArray(children)) {
            throw new Error('Notebook children must be an array.');
        }

        for (const child of children) {
            const { tabLabel, 'tab-label': kebabTabLabel, ...spec } = child;

            let label = tabLabel ?? kebabTabLabel ?? '';
            if (label && typeof label === 'object' && !(label instanceof Widget)) {
                label = builder.build(label)[0];
            }

            notebook.appendPage(builder.build(spec)[0], label);
        }
    },
};

registerType('notebook', Notebook);
