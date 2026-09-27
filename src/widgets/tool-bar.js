/**
 * @module widgets/tool-bar
 */

import { Orientation, ToolBarStyle } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Key } from '../events/constants.js';
import { AbstractToolItem } from './abstract-tool-item.js';
import { Box } from './box.js';
import { Container } from './container.js';
import { Menu } from './menu.js';
import { SeparatorMenuItem } from './separator-menu-item.js';
import { SeparatorToolItem } from './separator-tool-item.js';

/**
 * The class of items that did not fit and are shown in the overflow menu instead.
 *
 * @type {string}
 */
const OVERFLOWED_CLASS = 'wy-tool-bar-overflowed';

/**
 * A bar of tool items (and other widgets, such as a search entry).
 *
 * The `style` sets what the items show: icons, text, both (the icon above the text) or both
 * horizontally (the text next to the icon, only for important items). Items that do not fit are
 * hidden, and shown in a menu behind a » button at the end (`showArrow`). A horizontal tool bar
 * then only needs room for that button and takes the width its container gives it, so let it fill
 * or expand. A vertical one overflows when its container limits its height. The tool bar is one
 * stop for Tab; the arrow keys (and Home and End) move between its items.
 */
export class ToolBar extends Box {
    _initialize() {
        super._initialize();

        /** @type {import('./widget.js').Widget[]} */
        this._overflowItems = [];

        /** @type {Menu | null} */
        this._overflowMenu = null;

        /** @type {AbstractToolItem | null} */
        this._focusItem = null;

        this._resizeObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this._updateOverflow());
            this._resizeObserver.observe(this.el);
        }

        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));
        this.el.addEventListener('focusin', (event) => this._onFocusIn(event));

        this._overflowEl.addEventListener('pointerdown', (event) => {
            if (event.button === 0 && this.isSensitive) {
                this._toggleOverflowMenu(false);
            }
        });

        this._overflowEl.addEventListener('keydown', (event) => {
            if (event.key === Key.ENTER || event.key === Key.SPACE || event.key === Key.DOWN) {
                event.preventDefault();
                event.stopPropagation();

                this._toggleOverflowMenu(true);
            }
        });

        this.el.classList.toggle('wy-show-arrow', this._showArrow);
        this._applyStyle();
    }

    _render() {
        const element = createElement(`
            <div class="wy-tool-bar" role="toolbar">
                <div class="wy-tool-bar-body"></div>
                <div class="wy-tool-bar-overflow" role="button" tabindex="-1" aria-haspopup="menu"
                    aria-expanded="false" aria-label="More" hidden></div>
            </div>
        `);

        this._bodyEl = element.querySelector('.wy-tool-bar-body');
        this._overflowEl = element.querySelector('.wy-tool-bar-overflow');

        return element;
    }

    /**
     * The items that did not fit and are in the overflow menu.
     *
     * @type {import('./widget.js').Widget[]}
     */
    get overflowItems() {
        return [...this._overflowItems];
    }

    destroy() {
        this._resizeObserver?.disconnect();
        this._overflowMenu?.destroy();

        super.destroy();
    }

    _updateLayout() {
        super._updateLayout();

        this.el.setAttribute('aria-orientation', this._orientation);
        this._updateOverflow();
    }

    _layoutChild(child, horizontal) {
        super._layoutChild(child, horizontal);

        // Items keep their natural size; those that do not fit go to the overflow menu.
        const expands = horizontal ? child.isHExpand : child.isVExpand;
        if (!expands) {
            child._setLayoutStyle('flex', '0 0 auto');
        }
    }

    _applyStyle() {
        this.el.dataset.style = this._style;
        this.el.style.setProperty('--wy-tool-bar-icon-size', `${this._iconSize}px`);

        for (const child of this._children) {
            if (child instanceof AbstractToolItem) {
                child._onToolBarChange();
            }
        }

        this._queueLayout();
    }

    /**
     * Hides the items that do not fit and shows the overflow button for them.
     *
     * @protected
     */
    _updateOverflow() {
        if (this.destroyed) {
            return;
        }

        const horizontal = this._orientation !== Orientation.VERTICAL;
        const body = this._bodyEl;

        for (const child of this._children) {
            child.el.classList.remove(OVERFLOWED_CLASS);
        }

        this._overflowItems = [];

        const size = () => (horizontal ? body.clientWidth : body.clientHeight);
        const contentSize = () => (horizontal ? body.scrollWidth : body.scrollHeight);

        if (!this._showArrow || !this.el.isConnected || contentSize() <= size() + 1) {
            this._setOverflowVisible(false);

            return;
        }

        // The button takes room too, so measure after showing it.
        this._setOverflowVisible(true);

        const available = size();
        const bodyRect = body.getBoundingClientRect();
        const origin = horizontal ? bodyRect.left : bodyRect.top;

        let overflowing = false;
        let lastShown = null;
        for (const child of this._children) {
            if (!child.visible) {
                continue;
            }

            if (!overflowing) {
                const rect = child.el.getBoundingClientRect();
                const end = (horizontal ? rect.right : rect.bottom) - origin;
                overflowing = end > available + 0.5;
            }

            if (overflowing) {
                this._overflowItems.push(child);
            } else {
                lastShown = child;
            }
        }

        // A separator does not end the shown items.
        let index = lastShown ? this._children.indexOf(lastShown) : -1;
        while (index >= 0 && this._children[index] instanceof SeparatorToolItem) {
            this._overflowItems.unshift(this._children[index]);
            index -= 1;

            while (index >= 0 && !this._children[index].visible) {
                index -= 1;
            }
        }

        for (const child of this._overflowItems) {
            child.el.classList.add(OVERFLOWED_CLASS);
        }

        if (this._focusItem && this._overflowItems.includes(this._focusItem)) {
            this._focusItem = null;
        }
    }

    _setOverflowVisible(visible) {
        this._overflowEl.hidden = !visible;
        this.el.classList.toggle('wy-overflowing', visible);

        if (!visible) {
            this._overflowMenu?.hide();
        }
    }

    _toggleOverflowMenu(keyboard) {
        if (this._overflowMenu?.visible) {
            this._overflowMenu.hide();

            return;
        }

        const menu = new Menu();
        for (const child of this._overflowItems) {
            const proxy = child instanceof AbstractToolItem ? child._createMenuProxy() : null;
            if (proxy) {
                menu.addChild(proxy);
            }
        }

        // Drop separators at the ends.
        const isSeparator = (index) => menu.getChild(index) instanceof SeparatorMenuItem;
        while (menu.childrenCount && isSeparator(0)) {
            menu.getChild(0).destroy();
        }

        while (menu.childrenCount && isSeparator(menu.childrenCount - 1)) {
            menu.getChild(menu.childrenCount - 1).destroy();
        }

        this._overflowMenu = menu;
        this._overflowEl.classList.add('wy-active');
        this._overflowEl.setAttribute('aria-expanded', 'true');

        menu.connect('visible-change', () => {
            if (menu.visible) {
                return;
            }

            this._overflowEl.classList.remove('wy-active');
            this._overflowEl.setAttribute('aria-expanded', 'false');

            if (this._overflowMenu === menu) {
                this._overflowMenu = null;
            }

            // Destroy it once the handlers of an activated item ran.
            setTimeout(() => menu.destroyed || menu.destroy());
        });

        const horizontal = this._orientation !== Orientation.VERTICAL;
        menu.popup(this._overflowEl, {
            side: horizontal ? 'bottom' : 'right',
            align: 'end',
            owner: this._overflowEl,
            selectFirst: keyboard,
        });
    }

    /**
     * The focusable tool items that are shown, and the overflow button when shown, in order.
     *
     * @returns {HTMLElement[]}
     */
    _getNavigationElements() {
        const elements = this._children
            .filter(
                (x) =>
                    x instanceof AbstractToolItem &&
                    x.canFocus &&
                    x.isVisible &&
                    x.isSensitive &&
                    !this._overflowItems.includes(x)
            )
            .map((x) => x.focusElement);

        if (!this._overflowEl.hidden) {
            elements.push(this._overflowEl);
        }

        return elements;
    }

    _onKeyDown(event) {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }

        const horizontal = this._orientation !== Orientation.VERTICAL;
        const next = horizontal ? Key.RIGHT : Key.DOWN;
        const previous = horizontal ? Key.LEFT : Key.UP;

        if (![next, previous, Key.HOME, Key.END].includes(event.key)) {
            return;
        }

        // Only move between tool items; other widgets (like an entry) keep their keys.
        const elements = this._getNavigationElements();
        const index = elements.indexOf(/** @type {HTMLElement} */ (event.target));
        if (index < 0 || !elements.length) {
            return;
        }

        let target;
        if (event.key === Key.HOME) {
            target = 0;
        } else if (event.key === Key.END) {
            target = elements.length - 1;
        } else {
            const delta = event.key === next ? 1 : -1;
            target = (index + delta + elements.length) % elements.length;
        }

        event.preventDefault();
        event.stopPropagation();

        elements[target].focus({ preventScroll: true });
    }

    _onFocusIn(event) {
        for (const child of this._children) {
            if (child instanceof AbstractToolItem && child.focusElement === event.target) {
                this._focusItem = child;

                return;
            }
        }
    }

    _getFocusChain() {
        // All tool items together are one stop for Tab: the last focused one, or the first.
        const items = this._children.filter(
            (x) =>
                x instanceof AbstractToolItem &&
                x.canFocus &&
                x.isVisible &&
                x.isSensitive &&
                !this._overflowItems.includes(x)
        );
        const current = items.includes(this._focusItem) ? this._focusItem : items[0];

        const chain = [];
        for (const child of this._children) {
            if (!child.isVisible || !child.isSensitive || this._overflowItems.includes(child)) {
                continue;
            }

            if (child instanceof AbstractToolItem) {
                if (child === current) {
                    chain.push(child);
                }

                continue;
            }

            if (child.canFocus) {
                chain.push(child);
            }

            if (child instanceof Container) {
                chain.push(...child._getFocusChain());
            }
        }

        return chain;
    }
}

defineProperties(ToolBar, {
    vExpand: { value: false },

    orientation: {
        value: Orientation.HORIZONTAL,
        changed() {
            this._applyStyle();
        },
    },

    /**
     * Whether this is a tool bar.
     */
    isToolBar: { value: true, readOnly: true },

    /**
     * What the items show: one of `ToolBarStyle`.
     */
    style: {
        value: ToolBarStyle.BOTH,
        coerce(style) {
            if (!Object.values(ToolBarStyle).includes(style)) {
                throw new RangeError(`Invalid tool bar style '${style}'.`);
            }

            return style;
        },
        changed() {
            this._applyStyle();
        },
    },

    /**
     * The size of the items' icons in pixels.
     */
    iconSize: {
        value: 24,
        coerce(size) {
            const value = Number(size);
            if (!Number.isFinite(value) || value <= 0) {
                throw new RangeError(`Invalid icon size '${size}'.`);
            }

            return value;
        },
        changed() {
            this._applyStyle();
        },
    },

    /**
     * Whether items that do not fit go to an overflow menu behind a » button. Without it they
     * are cut off.
     */
    showArrow: {
        value: true,
        changed(showArrow) {
            this.el.classList.toggle('wy-show-arrow', showArrow);
            this._queueLayout();
        },
    },
});

registerType('tool-bar', ToolBar);
