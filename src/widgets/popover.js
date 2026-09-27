/**
 * @module widgets/popover
 */

import { defineProperties } from '../core/instance.js';
import { placePopup } from '../core/popup.js';
import { registerType } from '../core/registry.js';
import { getScreen } from '../core/screen.js';
import { createElement } from '../core/util.js';
import { Key } from '../events/constants.js';
import { Bin } from './bin.js';
import { Widget } from './widget.js';

/**
 * Why a popover closed, as passed to its `close` signal.
 *
 * @enum {string}
 */
export const PopoverCloseReason = Object.freeze({
    API: 'api', // The popover was closed with `popdown()`.
    ESCAPE: 'escape', // Escape was pressed.
    OUTSIDE: 'outside', // A pointer button was pressed outside the popover and its owner.
    SCROLL: 'scroll', // Something outside the popover scrolled.
    RESIZE: 'resize', // The screen was resized.
    BLUR: 'blur', // The page lost the focus.
    OWNER: 'owner', // The owner was hidden, made insensitive or destroyed.
});

/**
 * Elements a press may start on without moving the keyboard focus away from the owner.
 *
 * @type {string}
 */
const TEXT_INPUT_SELECTOR = 'input, textarea, [contenteditable]:not([contenteditable="false"])';

/**
 * A lightweight popup container that floats in the screen layer next to an anchor, like the list
 * of a combo box or the calendar of a date edit. It is not a window: it does not become active and,
 * unless `takeFocus` is set, pressing on it does not take the keyboard focus away from its owner
 * widget, which keeps handling the keyboard.
 *
 * An open popover closes when Escape is pressed, when a pointer button is pressed outside it (and
 * outside its owner), when something outside it scrolls, when the screen is resized or the page
 * loses the focus, and when its owner is hidden, made insensitive or destroyed.
 *
 * The popover holds one child widget, or plain elements appended to `contentElement`.
 *
 * Signals: `open` (`popover`), `close` (`popover, reason`), with a `PopoverCloseReason`.
 *
 * @example
 * const popover = new Popover({ owner: button });
 * popover.child = new Calendar();
 * popover.popup(button.el, { side: 'bottom', align: 'start' });
 */
export class Popover extends Bin {
    _initialize() {
        super._initialize();

        this._anchor = null;
        this._ownerDisconnects = [];

        this._onDocumentPointerDown = this._onDocumentPointerDown.bind(this);
        this._onDocumentKeyDown = this._onDocumentKeyDown.bind(this);
        this._onDocumentScroll = this._onDocumentScroll.bind(this);
        this._onWindowBlur = this._onWindowBlur.bind(this);
        this._onScreenSizeChange = this._onScreenSizeChange.bind(this);
        this._screenDisconnect = null;

        // Pressing on the popover must not move the focus away from the owner, like a menu.
        this.el.addEventListener('mousedown', (event) => {
            if (!this._takeFocus && !event.target.closest?.(TEXT_INPUT_SELECTOR)) {
                event.preventDefault();
            }
        });

        // A popover only counts as shown while it is open.
        this._recalculateVisibility();
    }

    _render() {
        const element = createElement(`
            <div class="wy-popover">
                <div class="wy-popover-body"></div>
            </div>
        `);

        this._bodyEl = element.querySelector('.wy-popover-body');

        return element;
    }

    /**
     * The element that holds the content. Plain elements may be appended to it instead of setting a
     * child widget.
     *
     * @type {HTMLElement}
     */
    get contentElement() {
        return this._bodyEl;
    }

    /**
     * Opens the popover next to an anchor, or moves it there if it is already open.
     *
     * @param {Element | Widget | {x: number, y: number, width: number, height: number}} [anchor]
     *     What to place the popover next to: an element, a widget or a rectangle in viewport
     *     coordinates. Defaults to the anchor of the previous call, or the owner.
     * @param {object} [options] Overrides `side`, `align`, `offset` and `matchAnchorWidth`.
     * @param {'bottom' | 'top' | 'right' | 'left'} [options.side]
     * @param {'start' | 'end' | 'center'} [options.align]
     * @param {number} [options.offset]
     * @param {boolean} [options.matchAnchorWidth]
     * @throws {Error} If there is nothing to place the popover next to.
     */
    popup(anchor, options = {}) {
        if (this.destroyed) {
            throw new Error('A destroyed popover cannot be opened.');
        }

        for (const name of ['side', 'align', 'offset', 'matchAnchorWidth']) {
            if (options[name] !== undefined) {
                this[name] = options[name];
            }
        }

        if (anchor) {
            this._anchor = anchor;
        }

        if (!this._anchor && !this._owner) {
            throw new Error('A popover needs an anchor or an owner to be placed next to.');
        }

        const wasOpen = this._isOpen;

        if (!wasOpen) {
            this._isOpen = true;

            getScreen().layer.append(this.el);
            this._listen(true);

            this._recalculateVisibility();
        }

        this.el.style.zIndex = String(getScreen().nextZIndex());

        this.reposition();

        if (!wasOpen) {
            this.emit('is-open-change', this);
            this.emit('open', this);
        }
    }

    /**
     * Closes the popover.
     *
     * @param {string} [reason] One of `PopoverCloseReason`; passed to the `close` signal.
     */
    popdown(reason = PopoverCloseReason.API) {
        if (!this._isOpen) {
            return;
        }

        this._isOpen = false;

        this._listen(false);
        this.el.remove();

        this._recalculateVisibility();

        this.emit('is-open-change', this);
        this.emit('close', this, reason);
    }

    /**
     * Opens the popover if it is closed, and closes it otherwise.
     *
     * @param {Element | Widget | {x: number, y: number, width: number, height: number}} [anchor]
     */
    toggle(anchor) {
        if (this._isOpen) {
            this.popdown();
        } else {
            this.popup(anchor);
        }
    }

    /**
     * Places the open popover next to its anchor again, e.g. after its content changed size.
     */
    reposition() {
        if (!this._isOpen) {
            return;
        }

        const anchor = this._getAnchorTarget();
        const rect = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;

        this.el.style.minWidth = this._matchAnchorWidth ? `${rect.width}px` : '';

        placePopup(this.el, rect, { side: this._side, align: this._align, offset: this._offset });
    }

    /**
     * Whether an element is part of the popover or its owner, so that pressing on it does not
     * close the popover.
     *
     * @param {Node | null} node
     * @returns {boolean}
     */
    containsElement(node) {
        if (!node) {
            return false;
        }

        if (this.el.contains(node) || this._owner?.el.contains(node)) {
            return true;
        }

        // Popovers whose owner is inside this one (such as a nested list) count as inside.
        let popover = Widget.fromElement(node);
        while (popover && !(popover instanceof Popover)) {
            popover = popover.parent;
        }

        const owner = popover && popover !== this ? popover.owner : null;

        return Boolean(owner && this.el.contains(owner.el));
    }

    destroy() {
        this.popdown(PopoverCloseReason.OWNER);
        this._connectOwner(null);

        super.destroy();
    }

    _isShown() {
        return this._visible && this._isOpen;
    }

    _getAnchorTarget() {
        const anchor = this._anchor || this._owner;

        return anchor instanceof Widget ? anchor.el : anchor;
    }

    _listen(listen) {
        const method = listen ? 'addEventListener' : 'removeEventListener';

        document[method]('pointerdown', this._onDocumentPointerDown, true);
        document[method]('keydown', this._onDocumentKeyDown, true);
        document[method]('scroll', this._onDocumentScroll, true);
        window[method]('blur', this._onWindowBlur);

        if (listen) {
            this._screenDisconnect = getScreen().connect('size-change', this._onScreenSizeChange);
        } else {
            this._screenDisconnect?.();
            this._screenDisconnect = null;
        }
    }

    _connectOwner(owner) {
        for (const disconnect of this._ownerDisconnects) {
            disconnect();
        }

        this._ownerDisconnects = [];

        if (!owner) {
            return;
        }

        const onOwnerGone = () => {
            if (owner.destroyed || !owner.isVisible || !owner.isSensitive) {
                this.popdown(PopoverCloseReason.OWNER);
            }
        };

        this._ownerDisconnects = [
            owner.connect('destroy', onOwnerGone),
            owner.connect('is-visible-change', onOwnerGone),
            owner.connect('is-sensitive-change', onOwnerGone),
        ];
    }

    _onDocumentPointerDown(event) {
        if (this._closeOnOutsidePress && !this.containsElement(event.target)) {
            this.popdown(PopoverCloseReason.OUTSIDE);
        }
    }

    _onDocumentKeyDown(event) {
        if (event.key !== Key.ESCAPE || event.defaultPrevented) {
            return;
        }

        // Nested popovers close one at a time: the topmost one handles Escape.
        const others = [...getScreen().layer.querySelectorAll(':scope > .wy-popover')];
        const topmost = others.reduce(
            (result, x) => (Number(x.style.zIndex) > Number(result.style.zIndex) ? x : result),
            this.el
        );

        if (topmost !== this.el) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.popdown(PopoverCloseReason.ESCAPE);
    }

    _onDocumentScroll(event) {
        if (this._closeOnScroll && !this.el.contains(event.target)) {
            this.popdown(PopoverCloseReason.SCROLL);
        }
    }

    _onWindowBlur() {
        this.popdown(PopoverCloseReason.BLUR);
    }

    _onScreenSizeChange() {
        this.popdown(PopoverCloseReason.RESIZE);
    }
}

defineProperties(Popover, {
    isTopLevel: { value: true, readOnly: true },

    /**
     * Whether the popover is open.
     */
    isOpen: { value: false, readOnly: true },

    /**
     * The widget the popover belongs to, or `null`. Presses on the owner do not close the popover
     * (the owner usually toggles it itself), and the popover closes when the owner is hidden, made
     * insensitive or destroyed. It is also the default anchor.
     */
    owner: {
        value: null,
        coerce(owner) {
            if (owner !== null && !(owner instanceof Widget)) {
                throw new TypeError('The owner of a popover must be a widget or null.');
            }

            return owner;
        },
        changed(owner) {
            this._connectOwner(owner);
        },
    },

    /**
     * The side of the anchor the popover prefers: `'bottom'`, `'top'`, `'right'` or `'left'`. It
     * flips to the other side when there is not enough room.
     */
    side: {
        value: 'bottom',
        coerce(side) {
            if (!['bottom', 'top', 'right', 'left'].includes(side)) {
                throw new RangeError(`Invalid popover side '${side}'.`);
            }

            return side;
        },
        changed() {
            this.reposition();
        },
    },

    /**
     * The alignment along the side of the anchor: `'start'`, `'center'` or `'end'`.
     */
    align: {
        value: 'start',
        coerce(align) {
            if (!['start', 'center', 'end'].includes(align)) {
                throw new RangeError(`Invalid popover alignment '${align}'.`);
            }

            return align;
        },
        changed() {
            this.reposition();
        },
    },

    /**
     * The distance from the anchor in pixels.
     */
    offset: {
        value: 1,
        coerce: Number,
        changed() {
            this.reposition();
        },
    },

    /**
     * Whether the popover is at least as wide as its anchor, like the list of a combo box.
     */
    matchAnchorWidth: {
        value: false,
        changed() {
            this.reposition();
        },
    },

    /**
     * Whether pressing on the popover may move the keyboard focus into it. Off by default, so the
     * owner keeps the focus.
     */
    takeFocus: { value: false },

    /**
     * Whether pressing outside the popover and its owner closes it.
     */
    closeOnOutsidePress: { value: true },

    /**
     * Whether scrolling something outside the popover closes it.
     */
    closeOnScroll: { value: true },
});

registerType('popover', Popover);
