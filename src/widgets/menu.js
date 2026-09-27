/**
 * @module widgets/menu
 */

import { Orientation } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { placePopup, pointRectangle } from '../core/popup.js';
import { registerType } from '../core/registry.js';
import { getScreen } from '../core/screen.js';
import { settings } from '../core/settings.js';
import { createElement, uniqueId } from '../core/util.js';
import { Key } from '../events/constants.js';
import { AbstractMenuItem } from './abstract-menu-item.js';
import { trackAccelerators } from './accelerators.js';
import { Box } from './box.js';
import { getMenuManager } from './menu-manager.js';
import { Widget } from './widget.js';

/**
 * How far in pixels a submenu overlaps its parent menu.
 *
 * @type {number}
 */
const SUBMENU_OFFSET = -3;

/**
 * How far in pixels the pointer must move after a menu popped up before a release activates an
 * item. This keeps the release of the press that opened a context menu from activating the item
 * under the pointer.
 *
 * @type {number}
 */
const POINTER_SLOP = 3;

/**
 * How many pixels a menu scrolls per animation frame while the pointer rests on a scroll arrow.
 *
 * @type {number}
 */
const SCROLL_STEP = 4;

/**
 * Extra room in pixels around a submenu for the pointer's path towards it.
 *
 * @type {number}
 */
const SUBMENU_PATH_TOLERANCE = 4;

/**
 * @typedef {object} PopupOptions
 * @property {'bottom' | 'top' | 'right' | 'left'} [side] Where to place the menu relative to the
 *     anchor. Defaults to `'right'` for submenus and `'bottom'` otherwise.
 * @property {'start' | 'end' | 'center'} [align] The alignment along that side.
 * @property {number} [offset] The distance from the anchor in pixels.
 * @property {HTMLElement | null} [owner] An element whose presses do not close the menu, because
 *     its widget toggles the menu itself (like a menu button). Defaults to the anchor element.
 * @property {boolean} [focus] Whether the menu takes the keyboard focus. Defaults to true.
 * @property {boolean} [selectFirst] Whether to select the first item, as when opened with the
 *     keyboard.
 */

/**
 * A menu: a popup with a column of menu items, floating in the screen layer.
 *
 * Show it with `popup()`: below a menu bar item or a button, to the right of the item it is a
 * submenu of, or at a point (`popupAtPointer()` for context menus). While it is open it has the
 * keyboard focus (the window it belongs to stays active) and it closes when the user presses
 * outside it, scrolls outside it, activates an item or presses Escape (which closes one level).
 * The widget that had the focus gets it back.
 *
 * Keyboard: Up and Down move the selection (wrapping around, skipping separators and insensitive
 * items), Home and End go to the first and last item, Right opens a submenu, Left closes it (or
 * moves to the neighboring menu of a menu bar), Enter and Space activate, and a letter activates
 * the item with that mnemonic (or selects the next item starting with it). Hovering an item with
 * a submenu opens the submenu after `settings.submenuDelay`; moving the pointer diagonally
 * towards an open submenu keeps it open. A menu taller than the screen gets scroll arrows.
 *
 * Signals: `popup`, `selected-change`, and `visible-change` when shown or hidden.
 */
export class Menu extends Box {
    _initialize() {
        super._initialize();

        /** @type {Widget | null} */
        this._attachWidget = null;

        /** @type {HTMLElement | null} */
        this._ownerElement = null;

        this._placement = null;
        this._submenuTimer = 0;
        this._deferTimer = 0;
        this._deferredItem = null;
        this._pressedItem = null;
        this._popupPointer = null;
        this._pointerMoved = false;
        this._lastPointer = null;
        this._scrollFrame = 0;
        this._stopAccelerators = null;
        this._disconnectAttachDestroy = null;

        this.el.id = uniqueId('wy-menu');

        this.el.addEventListener('pointermove', (event) => this._onPointerMove(event));
        this.el.addEventListener('pointerleave', () => this._onPointerLeave());
        this.el.addEventListener('pointerdown', (event) => this._onPointerDown(event));
        this.el.addEventListener('pointerup', (event) => this._onPointerUp(event));
        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));

        // Presses in a menu neither move the focus nor select text, and there is no browser
        // context menu in a menu.
        this.el.addEventListener('mousedown', (event) => event.preventDefault());
        this.el.addEventListener('contextmenu', (event) => event.preventDefault());

        this._bodyEl.addEventListener('scroll', () => this._updateScrollArrows(), {
            passive: true,
        });

        for (const [element, direction] of [
            [this._scrollUpEl, -1],
            [this._scrollDownEl, 1],
        ]) {
            element.addEventListener('pointerenter', () => this._startScrolling(direction));
            element.addEventListener('pointerleave', () => this._stopScrolling());
        }
    }

    _render() {
        const element = createElement(`
            <div class="wy-menu" role="menu" tabindex="-1" aria-orientation="vertical" data-wy-popup>
                <div class="wy-menu-scroll wy-menu-scroll-up" aria-hidden="true"></div>
                <div class="wy-menu-body"></div>
                <div class="wy-menu-scroll wy-menu-scroll-down" aria-hidden="true"></div>
            </div>
        `);

        this._bodyEl = element.querySelector('.wy-menu-body');
        this._scrollUpEl = element.querySelector('.wy-menu-scroll-up');
        this._scrollDownEl = element.querySelector('.wy-menu-scroll-down');

        return element;
    }

    /**
     * Shows the menu next to an anchor: a widget, an element, a rectangle or a point (all in
     * viewport coordinates), or at the pointer when `null`. The menu is flipped and shifted to
     * stay on screen.
     *
     * @param {Widget | Element | {x: number, y: number, width?: number, height?: number} | null}
     *     [anchor]
     * @param {PopupOptions} [options]
     * @returns {this}
     */
    popup(anchor = null, options = {}) {
        if (this.destroyed) {
            throw new Error('The menu has been destroyed.');
        }

        const anchorElement =
            anchor instanceof Widget ? anchor.el : anchor instanceof Element ? anchor : null;
        const isSubmenu = anchor instanceof Widget && Boolean(anchor.parent?.isMenu);
        const side = options.side || (isSubmenu ? 'right' : 'bottom');
        const beside = isSubmenu && (side === 'right' || side === 'left');

        this._placement = {
            anchor: anchorElement || toRectangle(anchor),
            side,
            align: options.align || 'start',
            offset: options.offset ?? (beside ? SUBMENU_OFFSET : 0),
            alignFirstItem: beside,
        };

        this._ownerElement = options.owner === undefined ? anchorElement : options.owner;
        this._popupPointer = getMenuManager().pointer;
        this._pointerMoved = false;
        this._pressedItem = null;

        if (this._visible) {
            this._place();
        } else {
            this.visible = true;
        }

        if (options.focus !== false) {
            this.el.focus({ preventScroll: true });
        }

        if (options.selectFirst) {
            this.selectFirst();
        }

        this.emit('popup', this);

        return this;
    }

    /**
     * Shows the menu at the pointer, as a context menu. Pass the event that asked for the menu
     * (a DOM or toolkit event); without one, the last known pointer position is used.
     *
     * @param {Event | {nativeEvent?: Event | null} | null} [event]
     * @param {PopupOptions} [options]
     * @returns {this}
     */
    popupAtPointer(event = null, options = {}) {
        const native = event && 'nativeEvent' in event ? event.nativeEvent : event;

        let point = getMenuManager().pointer;
        if (
            native &&
            typeof native.clientX === 'number' &&
            !(typeof KeyboardEvent !== 'undefined' && native instanceof KeyboardEvent)
        ) {
            point = { x: native.clientX, y: native.clientY };
        }

        return this.popup(pointRectangle(point.x, point.y), {
            side: 'bottom',
            align: 'start',
            owner: null,
            ...options,
        });
    }

    /**
     * Shows the menu below a widget, or to its right. The original toolkit's name for `popup()`.
     *
     * @param {Widget} widget
     * @param {boolean} [showOnSide] Whether to show the menu to the right of the widget.
     * @returns {this}
     */
    appearAtWidget(widget, showOnSide = false) {
        return this.popup(widget, { side: showOnSide ? 'right' : 'bottom' });
    }

    /**
     * Shows the menu at a position in viewport coordinates.
     *
     * @param {{x: number, y: number}} position
     * @returns {this}
     */
    appearAtPosition(position) {
        return this.popup(pointRectangle(position.x, position.y), { side: 'bottom', owner: null });
    }

    /**
     * Hides the menu. The same as `hide()`.
     */
    disappear() {
        this.hide();
    }

    /**
     * Attaches the menu to a widget: the menu belongs to the widget's window (the accelerators of
     * its items work there) and is destroyed with the widget.
     *
     * @param {Widget} widget
     */
    attachToWidget(widget) {
        if (!(widget instanceof Widget)) {
            throw new TypeError('A menu can only be attached to a widget.');
        }

        this._setAttachWidget(widget);

        this._disconnectAttachDestroy = widget.connect('destroy', () => {
            if (!this.destroyed) {
                this.destroy();
            }
        });
    }

    /**
     * Detaches the menu from the widget it is attached to.
     */
    detach() {
        this._setAttachWidget(null);
    }

    /**
     * Selects the first selectable item.
     */
    selectFirst() {
        const items = this._getSelectableItems();
        this._selectItem(items[0] || null, true);
    }

    /**
     * Selects the last selectable item.
     */
    selectLast() {
        const items = this._getSelectableItems();
        this._selectItem(items[items.length - 1] || null, true);
    }

    insertChild(widget, index) {
        if (!(widget instanceof AbstractMenuItem)) {
            throw new TypeError('Only menu items can be added to a menu.');
        }

        return super.insertChild(widget, index);
    }

    removeChild(widget) {
        if (widget === this._selected) {
            this._selectItem(null);
        }

        return super.removeChild(widget);
    }

    destroy() {
        this.hide();
        this._setAttachWidget(null);

        super.destroy();
    }

    /**
     * Sets the widget the menu is attached to (for a submenu, its menu item). Menus attached to
     * other widgets than menu items make their accelerators work in that widget's window.
     *
     * @protected
     * @param {Widget | null} widget
     */
    _setAttachWidget(widget) {
        if (widget === this._attachWidget) {
            return;
        }

        this._stopAccelerators?.();
        this._stopAccelerators = null;
        this._disconnectAttachDestroy?.();
        this._disconnectAttachDestroy = null;

        this._attachWidget = widget;

        if (widget && !(widget instanceof AbstractMenuItem)) {
            this._stopAccelerators = trackAccelerators(widget, this);
        }

        if (widget instanceof AbstractMenuItem) {
            this.el.setAttribute('aria-labelledby', widget.el.id);
        } else {
            this.el.removeAttribute('aria-labelledby');
        }

        this.emit('attach-widget-change', this);
    }

    _findAccelerator(event) {
        for (const child of this._children) {
            const item = child._findAccelerator(event);
            if (item) {
                return item;
            }
        }

        return null;
    }

    _deactivateShell() {
        this.hide();
    }

    _containsTarget(target) {
        return this.el.contains(target) || Boolean(this._ownerElement?.contains(target));
    }

    _onVisibleChange(visible) {
        this.el.hidden = !visible;

        const manager = getMenuManager();
        if (visible) {
            const screen = getScreen();

            this._bodyEl.scrollTop = 0;
            screen.layer.append(this.el);
            this.el.style.zIndex = String(screen.nextZIndex());

            manager._addShell(this);
        } else {
            this._cancelTimers();
            this._stopScrolling();
            this._selectItem(null);

            // Give the keyboard focus back to the parent menu.
            const parent = this.parentMenu;
            if (parent?.visible && this.el.contains(document.activeElement)) {
                parent.el.focus({ preventScroll: true });
            }

            this.el.remove();
            manager._removeShell(this);
        }

        this._recalculateVisibility();
        this._recalculateSensitivity();

        if (visible) {
            this._place();
        }
    }

    _place() {
        const placement = this._placement || {
            anchor: toRectangle(null),
            side: 'bottom',
            align: 'start',
            offset: 0,
            alignFirstItem: false,
        };

        // Measure at the origin, where the menu gets its natural width.
        this.el.style.left = '0px';
        this.el.style.top = '0px';
        this.el.style.maxHeight = `${getScreen().height}px`;

        const rect =
            placement.anchor instanceof Element
                ? placement.anchor.getBoundingClientRect()
                : placement.anchor;

        let anchor = {
            x: rect.x ?? rect.left,
            y: rect.y ?? rect.top,
            width: rect.width,
            height: rect.height,
        };

        // Line up the first item of a submenu with the item it hangs from.
        if (placement.alignFirstItem) {
            const shift = this._getFirstItemOffset();
            anchor = {
                x: anchor.x,
                y: anchor.y - shift,
                width: anchor.width,
                height: anchor.height + 2 * shift,
            };
        }

        placePopup(this.el, anchor, {
            side: placement.side,
            align: placement.align,
            offset: placement.offset,
        });

        this._updateScrollArrows();
    }

    _getFirstItemOffset() {
        const first = this._children.find((x) => x.visible);
        if (!first) {
            return 0;
        }

        return first.el.getBoundingClientRect().top - this.el.getBoundingClientRect().top;
    }

    _getSelectableItems() {
        return this._children.filter((x) => x._isSelectable());
    }

    _itemFromTarget(target) {
        let widget = Widget.fromElement(target);
        while (widget && widget.parent !== this) {
            widget = widget.parent;
        }

        return widget && widget !== this ? widget : null;
    }

    _selectItem(item, keyboard = false) {
        this._cancelTimers();

        const old = this._selected;
        if (old === item) {
            return;
        }

        this._selected = item;

        if (old && !old.destroyed) {
            old._setSelected(false);
            old.submenu?.hide();
        }

        if (item) {
            item._setSelected(true);
            this.el.setAttribute('aria-activedescendant', item.el.id);

            if (keyboard) {
                item.el.scrollIntoView({ block: 'nearest' });
            }
        } else {
            this.el.removeAttribute('aria-activedescendant');
        }

        this.emit('selected-change', this);
    }

    _onItemGone(item) {
        if (item === this._selected) {
            this._selectItem(null);
        }
    }

    _openSubmenu(item, keyboard = false) {
        const submenu = item.submenu;
        if (!submenu || !item._isSelectable() || !this._visible) {
            return;
        }

        this._cancelTimers();

        if (!submenu.visible) {
            submenu.popup(item, { focus: keyboard });
        } else if (keyboard) {
            submenu.el.focus({ preventScroll: true });
        }

        if (keyboard) {
            submenu.selectFirst();
        }
    }

    _moveSelection(delta) {
        const items = this._getSelectableItems();
        if (!items.length) {
            return;
        }

        const index = items.indexOf(this._selected);
        let next;
        if (index < 0) {
            next = delta > 0 ? 0 : items.length - 1;
        } else {
            next = (index + delta + items.length) % items.length;
        }

        this._selectItem(items[next], true);
    }

    _activateSelected() {
        const item = this._selected;
        if (!item || !item._isSelectable()) {
            return;
        }

        if (item.submenu) {
            this._openSubmenu(item, true);
        } else {
            item._onUserActivate?.();
        }
    }

    /**
     * Closes this menu level, as Escape does: a submenu returns the focus to its parent menu,
     * and a top-level menu closes all menus.
     *
     * @protected
     */
    _closeLevel() {
        const parent = this.parentMenu;
        if (parent?.visible) {
            parent.el.focus({ preventScroll: true });
            this.hide();
        } else {
            getMenuManager().hideAllOpenMenus();
        }
    }

    _getRootMenu() {
        let menu = this;
        while (menu.parentMenu) {
            menu = menu.parentMenu;
        }

        return menu;
    }

    _getMenuBar() {
        const attached = this._getRootMenu()._attachWidget;

        return attached?.parent?.isMenuBar ? attached.parent : null;
    }

    _onKeyDown(event) {
        if (event.defaultPrevented) {
            return;
        }

        let handled = true;
        switch (event.key) {
            case Key.DOWN:
                this._moveSelection(1);
                break;

            case Key.UP:
                this._moveSelection(-1);
                break;

            case Key.HOME:
            case Key.PAGE_UP:
                this.selectFirst();
                break;

            case Key.END:
            case Key.PAGE_DOWN:
                this.selectLast();
                break;

            case Key.RIGHT:
                if (this._selected?.submenu) {
                    this._openSubmenu(this._selected, true);
                } else {
                    this._getMenuBar()?._moveSelectionBy(1, true);
                }
                break;

            case Key.LEFT:
                if (this.parentMenu?.visible) {
                    this._closeLevel();
                } else {
                    this._getMenuBar()?._moveSelectionBy(-1, true);
                }
                break;

            case Key.ENTER:
            case Key.SPACE:
                this._activateSelected();
                break;

            case Key.ESCAPE:
                this._closeLevel();
                break;

            case Key.TAB:
                // Like on the desktop, Tab does nothing in a menu.
                break;

            case Key.F10:
            case Key.CONTEXT_MENU:
                getMenuManager().hideAllOpenMenus();
                break;

            default:
                handled = this._onCharacterKey(event);
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    _onCharacterKey(event) {
        if (event.ctrlKey || event.metaKey || event.key.length !== 1) {
            return false;
        }

        const character = event.key.toLowerCase();
        const items = this._getSelectableItems();

        // A unique mnemonic activates its item; several items with the same mnemonic are cycled.
        const matches = items.filter((x) => x.mnemonic === character);
        if (matches.length === 1) {
            const item = matches[0];
            this._selectItem(item, true);

            if (item.submenu) {
                this._openSubmenu(item, true);
            } else {
                item._onUserActivate?.();
            }

            return true;
        }

        // Otherwise select the next item whose label starts with the character.
        const candidates = matches.length
            ? matches
            : items.filter((x) =>
                  (x._labelEl?.textContent || '').trim().toLowerCase().startsWith(character)
              );

        if (candidates.length) {
            const index = candidates.indexOf(this._selected);
            this._selectItem(candidates[(index + 1) % candidates.length], true);
        }

        return true;
    }

    _onPointerMove(event) {
        // Ignore the pointer resting where the menu popped up (and synthetic moves caused by the
        // menu appearing under it).
        if (!this._pointerMoved) {
            const start = this._popupPointer;
            if (
                start &&
                Math.hypot(event.clientX - start.x, event.clientY - start.y) <= POINTER_SLOP
            ) {
                return;
            }

            this._pointerMoved = true;
        }

        // The keyboard focus follows the pointer between a menu and its submenus.
        if (document.activeElement !== this.el) {
            this.el.focus({ preventScroll: true });
        }

        const target = this._itemFromTarget(event.target);
        const item = target && target._isSelectable() ? target : null;

        const point = { x: event.clientX, y: event.clientY };
        const previous = this._lastPointer;
        this._lastPointer = point;

        if (item === this._selected) {
            this._cancelDeferredSelection();

            return;
        }

        // Moving diagonally towards the open submenu crosses other items; wait a little before
        // switching, so the submenu stays open.
        if (this._isMovingTowardsSubmenu(previous, point)) {
            this._deferSelection(item);

            return;
        }

        this._hoverItem(item);
    }

    _hoverItem(item) {
        this._cancelDeferredSelection();

        if (!item) {
            // Over a separator, an insensitive item or the border: keep an item whose submenu is
            // open, like the original toolkit.
            if (!this._selected?.submenu?.visible) {
                this._selectItem(null);
            }

            return;
        }

        this._selectItem(item);

        if (item.submenu) {
            this._submenuTimer = setTimeout(() => {
                this._submenuTimer = 0;

                if (!this.destroyed && this._selected === item) {
                    this._openSubmenu(item);
                }
            }, settings.submenuDelay);
        }
    }

    _isMovingTowardsSubmenu(previous, point) {
        const submenu = this._selected?.submenu;
        if (!previous || !submenu?.visible) {
            return false;
        }

        const rect = submenu.el.getBoundingClientRect();
        const edge = submenu.el.dataset.side === 'left' ? rect.right : rect.left;

        return isInTriangle(
            point,
            previous,
            { x: edge, y: rect.top - SUBMENU_PATH_TOLERANCE },
            { x: edge, y: rect.bottom + SUBMENU_PATH_TOLERANCE }
        );
    }

    _deferSelection(item) {
        this._deferredItem = item;

        clearTimeout(this._deferTimer);
        this._deferTimer = setTimeout(() => {
            this._deferTimer = 0;

            if (!this.destroyed && this._visible) {
                this._hoverItem(this._deferredItem);
            }
        }, settings.submenuDelay);
    }

    _cancelDeferredSelection() {
        clearTimeout(this._deferTimer);
        this._deferTimer = 0;
        this._deferredItem = null;
    }

    _cancelTimers() {
        clearTimeout(this._submenuTimer);
        this._submenuTimer = 0;

        this._cancelDeferredSelection();
    }

    _onPointerLeave() {
        this._lastPointer = null;

        if (!this._selected?.submenu?.visible) {
            this._cancelTimers();
            this._selectItem(null);
        } else {
            this._cancelDeferredSelection();
        }
    }

    _onPointerDown(event) {
        this._pointerMoved = true;

        const target = this._itemFromTarget(event.target);
        const item = target && target._isSelectable() ? target : null;
        this._pressedItem = item;

        if (item) {
            this._selectItem(item);

            if (item.submenu) {
                this._openSubmenu(item);
            }
        }
    }

    _onPointerUp(event) {
        const pressed = this._pressedItem;
        this._pressedItem = null;

        const target = this._itemFromTarget(event.target);
        const item = target && target._isSelectable() ? target : null;
        if (!item || (!this._pointerMoved && pressed !== item)) {
            return;
        }

        if (item.submenu) {
            this._selectItem(item);
            this._openSubmenu(item);
        } else {
            item._onUserActivate?.();
        }
    }

    _updateScrollArrows() {
        const body = this._bodyEl;
        const scrollable = body.scrollHeight > body.clientHeight + 1;

        if (scrollable !== this._scrollable) {
            this._scrollable = scrollable;
            this.el.classList.toggle('wy-scrollable', scrollable);
        }

        const atStart = body.scrollTop <= 0;
        const atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 1;

        this._scrollUpEl.classList.toggle('wy-disabled', atStart);
        this._scrollDownEl.classList.toggle('wy-disabled', atEnd);

        if ((atStart && this._scrollDirection < 0) || (atEnd && this._scrollDirection > 0)) {
            this._stopScrolling();
        }
    }

    _startScrolling(direction) {
        this._stopScrolling();
        this._scrollDirection = direction;

        const step = () => {
            this._bodyEl.scrollTop += direction * SCROLL_STEP;
            this._scrollFrame = requestAnimationFrame(step);
        };

        this._scrollFrame = requestAnimationFrame(step);
    }

    _stopScrolling() {
        cancelAnimationFrame(this._scrollFrame);
        this._scrollFrame = 0;
        this._scrollDirection = 0;
    }
}

/**
 * Converts a popup anchor that is not an element to a rectangle.
 *
 * @param {{x: number, y: number, width?: number, height?: number} | null} anchor
 * @returns {{x: number, y: number, width: number, height: number}}
 */
function toRectangle(anchor) {
    if (!anchor) {
        const pointer = getMenuManager().pointer;

        return pointRectangle(pointer.x, pointer.y);
    }

    if (typeof anchor.x !== 'number' || typeof anchor.y !== 'number') {
        throw new TypeError('A menu anchor must be a widget, an element, a rectangle or a point.');
    }

    return { x: anchor.x, y: anchor.y, width: anchor.width || 0, height: anchor.height || 0 };
}

/**
 * Checks whether a point lies in a triangle.
 *
 * @param {{x: number, y: number}} point
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @param {{x: number, y: number}} c
 * @returns {boolean}
 */
function isInTriangle(point, a, b, c) {
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

    const first = cross(a, b, point);
    const second = cross(b, c, point);
    const third = cross(c, a, point);

    return (first >= 0 && second >= 0 && third >= 0) || (first <= 0 && second <= 0 && third <= 0);
}

/**
 * Returns where a menu opened with the keyboard for a widget goes: below the focused element in
 * the widget, or the widget itself.
 *
 * @param {Widget} widget
 * @returns {{x: number, y: number, width: number, height: number}}
 */
function getKeyboardAnchor(widget) {
    const active = document.activeElement;
    const element = active instanceof Element && widget.el.contains(active) ? active : widget.el;
    const rect = element.getBoundingClientRect();

    return {
        x: rect.left,
        y: rect.top,
        width: Math.min(rect.width, 32),
        height: Math.min(rect.height, 24),
    };
}

/**
 * Gives a widget a context menu, which pops up at the pointer on a right click, and below the
 * focused element with the Menu key or Shift+F10 (with its first item selected).
 *
 * Pass a menu, which is attached to the widget (and destroyed with it), or a factory
 * `(widget, event) => Menu | null` that creates a menu each time (return `null` for no menu);
 * such menus are destroyed after closing.
 *
 * @param {Widget} widget
 * @param {Menu | ((widget: Widget, event: Event) => Menu | null)} menuOrFactory
 * @returns {() => void} A function that removes the context menu again.
 */
export function attachContextMenu(widget, menuOrFactory) {
    if (!(widget instanceof Widget)) {
        throw new TypeError('A context menu can only be attached to a widget.');
    }

    const factory = typeof menuOrFactory === 'function' ? menuOrFactory : null;
    const fixedMenu = factory ? null : menuOrFactory;

    if (!factory && !(fixedMenu instanceof Menu)) {
        throw new TypeError('A context menu must be a Menu or a function that creates one.');
    }

    fixedMenu?.attachToWidget(widget);

    let keyboardTime = -Infinity;

    const open = (event, keyboard) => {
        const menu = factory ? factory(widget, event) : fixedMenu;
        if (!menu) {
            return false;
        }

        if (factory) {
            if (!(menu instanceof Menu)) {
                throw new TypeError('A context menu factory must return a Menu or null.');
            }

            // Destroy the menu once it closed, after an activated item's handlers ran.
            const disconnect = menu.connect('visible-change', () => {
                if (!menu.visible) {
                    disconnect();
                    setTimeout(() => menu.destroyed || menu.destroy());
                }
            });
        }

        if (keyboard) {
            menu.popup(getKeyboardAnchor(widget), {
                side: 'bottom',
                owner: null,
                selectFirst: true,
            });
        } else {
            menu.popupAtPointer(event);
        }

        return true;
    };

    const onContextMenu = (event) => {
        if (!widget.isSensitive) {
            return;
        }

        // The browser fires this after the Menu key, which the key handler already handled.
        if (event.timeStamp - keyboardTime < 500) {
            event.preventDefault();

            return;
        }

        if (open(event, false)) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    const onKeyDown = (event) => {
        const menuKey =
            event.key === Key.CONTEXT_MENU ||
            (event.key === Key.F10 &&
                event.shiftKey &&
                !event.ctrlKey &&
                !event.altKey &&
                !event.metaKey);

        if (!menuKey || event.defaultPrevented || !widget.isSensitive) {
            return;
        }

        keyboardTime = event.timeStamp;

        if (open(event, true)) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    widget.el.addEventListener('contextmenu', onContextMenu);
    widget.el.addEventListener('keydown', onKeyDown);

    return () => {
        widget.el.removeEventListener('contextmenu', onContextMenu);
        widget.el.removeEventListener('keydown', onKeyDown);

        if (fixedMenu && !fixedMenu.destroyed && fixedMenu.attachWidget === widget) {
            fixedMenu.detach();
        }
    };
}

defineProperties(Menu, {
    isTopLevel: { value: true, readOnly: true },

    orientation: { value: Orientation.VERTICAL },

    visible: {
        value: false,
        changed(visible) {
            this._onVisibleChange(visible);
        },
    },

    /**
     * Whether this is a menu shell (a container of menu items).
     */
    isMenuShell: { value: true, readOnly: true },

    /**
     * Whether this is a menu.
     */
    isMenu: { value: true, readOnly: true },

    /**
     * The selected (highlighted) item, or `null`.
     */
    selected: {
        value: null,
        set(item) {
            if (item && (item.parent !== this || !item._isSelectable())) {
                throw new Error('Only a selectable item of the menu can be selected.');
            }

            this._selectItem(item || null, true);

            return false;
        },
    },

    /**
     * The widget the menu is attached to (for a submenu, its menu item), or `null`.
     */
    attachWidget: {
        readOnly: true,
        get() {
            return this._attachWidget;
        },
    },

    /**
     * The menu this menu is a submenu of, or `null`.
     */
    parentMenu: {
        readOnly: true,
        get() {
            const parent = this._attachWidget?.parent;

            return parent?.isMenu ? parent : null;
        },
    },

    /**
     * The position of the menu's top-left corner in viewport coordinates, as `{x, y}`. Setting it
     * moves the menu there, keeping it on screen.
     */
    position: {
        signal: false,
        get() {
            return { x: this.el.offsetLeft, y: this.el.offsetTop };
        },
        set(position) {
            if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
                throw new TypeError('A position must have numeric x and y.');
            }

            this._placement = {
                anchor: pointRectangle(position.x, position.y),
                side: 'bottom',
                align: 'start',
                offset: 0,
                alignFirstItem: false,
            };

            if (this._visible) {
                this._place();
            }

            return false;
        },
    },

    /**
     * The x position of the menu. Does not signal.
     */
    x: {
        signal: false,
        get() {
            return this.position.x;
        },
        set(x) {
            this.position = { x, y: this.position.y };

            return false;
        },
    },

    /**
     * The y position of the menu. Does not signal.
     */
    y: {
        signal: false,
        get() {
            return this.position.y;
        },
        set(y) {
            this.position = { x: this.position.x, y };

            return false;
        },
    },
});

registerType('menu', Menu);
