/**
 * @module widgets/popover
 */
import { Bin } from './bin.js';
import { Widget } from './widget.js';
/**
 * Why a popover closed, as passed to its `close` signal.
 *
 * @enum {string}
 */
export declare const PopoverCloseReason: Readonly<{
    API: "api";
    ESCAPE: "escape";
    OUTSIDE: "outside";
    SCROLL: "scroll";
    RESIZE: "resize";
    BLUR: "blur";
    OWNER: "owner";
}>;
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
export declare class Popover extends Bin {
    _anchor: Element | Widget | {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    _ownerDisconnects: any[];
    _screenDisconnect: () => void;
    _bodyEl: Element;
    _isOpen: boolean;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The element that holds the content. Plain elements may be appended to it instead of setting a
     * child widget.
     *
     * @type {HTMLElement}
     */
    get contentElement(): HTMLElement;
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
    popup(anchor?: Element | Widget | {
        x: number;
        y: number;
        width: number;
        height: number;
    }, options?: {
        side?: 'bottom' | 'top' | 'right' | 'left';
        align?: 'start' | 'end' | 'center';
        offset?: number;
        matchAnchorWidth?: boolean;
    }): void;
    /**
     * Closes the popover.
     *
     * @param {string} [reason] One of `PopoverCloseReason`; passed to the `close` signal.
     */
    popdown(reason?: string): void;
    /**
     * Opens the popover if it is closed, and closes it otherwise.
     *
     * @param {Element | Widget | {x: number, y: number, width: number, height: number}} [anchor]
     */
    toggle(anchor?: Element | Widget | {
        x: number;
        y: number;
        width: number;
        height: number;
    }): void;
    /**
     * Places the open popover next to its anchor again, e.g. after its content changed size.
     */
    reposition(): void;
    /**
     * Whether an element is part of the popover or its owner, so that pressing on it does not
     * close the popover.
     *
     * @param {Node | null} node
     * @returns {boolean}
     */
    containsElement(node: Node | null): boolean;
    destroy(): void;
    _isShown(): boolean;
    _getAnchorTarget(): any;
    _listen(listen: any): void;
    _connectOwner(owner: any): void;
    _onDocumentPointerDown(event: any): void;
    _onDocumentKeyDown(event: any): void;
    _onDocumentScroll(event: any): void;
    _onWindowBlur(): void;
    _onScreenSizeChange(): void;
}

/** The declared properties of {@link Popover}. */
export interface Popover {
    readonly isTopLevel: any;
    /**
     * Whether the popover is open.
     */
    readonly isOpen: any;
    /**
     * The widget the popover belongs to, or `null`. Presses on the owner do not close the popover
     * (the owner usually toggles it itself), and the popover closes when the owner is hidden, made
     * insensitive or destroyed. It is also the default anchor.
     */
    owner: any;
    /**
     * The side of the anchor the popover prefers: `'bottom'`, `'top'`, `'right'` or `'left'`. It
     * flips to the other side when there is not enough room.
     */
    side: string;
    /**
     * The alignment along the side of the anchor: `'start'`, `'center'` or `'end'`.
     */
    align: string;
    /**
     * The distance from the anchor in pixels.
     */
    offset: number;
    /**
     * Whether the popover is at least as wide as its anchor, like the list of a combo box.
     */
    matchAnchorWidth: boolean;
    /**
     * Whether pressing on the popover may move the keyboard focus into it. Off by default, so the
     * owner keeps the focus.
     */
    takeFocus: any;
    /**
     * Whether pressing outside the popover and its owner closes it.
     */
    closeOnOutsidePress: any;
    /**
     * Whether scrolling something outside the popover closes it.
     */
    closeOnScroll: any;
}
