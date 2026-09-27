/**
 * Positioning of popups (menus, tooltips, combo box lists, calendars) on the screen.
 *
 * @module core/popup
 */
export type Rectangle = {
    x: number;
    y: number;
    width: number;
    height: number;
};
/**
 * @typedef {{x: number, y: number, width: number, height: number}} Rectangle
 */
/**
 * Computes where to place a popup of a given size next to an anchor rectangle, keeping it on the
 * screen. The popup goes on the preferred side if it fits there, otherwise on the opposite side
 * if it fits there, otherwise where there is most room, and it is then shifted along the side to
 * stay on screen.
 *
 * @param {Rectangle} anchor The rectangle to place the popup next to, in viewport coordinates.
 * @param {{width: number, height: number}} size The popup size.
 * @param {object} [options]
 * @param {'bottom' | 'top' | 'right' | 'left'} [options.side] Where to place the popup; `'bottom'`
 *     puts it below the anchor, `'right'` to the right of it (like a submenu).
 * @param {'start' | 'end' | 'center'} [options.align] Alignment along the side: `'start'` lines
 *     up the left (or top) edges.
 * @param {number} [options.offset] Distance from the anchor in pixels.
 * @param {{width: number, height: number}} [options.bounds] The screen size.
 * @returns {{x: number, y: number, side: string}}
 */
export declare function computePopupPosition(anchor: Rectangle, size: {
    width: number;
    height: number;
}, options?: {
    side?: 'bottom' | 'top' | 'right' | 'left';
    align?: 'start' | 'end' | 'center';
    offset?: number;
    bounds?: {
        width: number;
        height: number;
    };
}): {
    x: number;
    y: number;
    side: string;
};
/**
 * Places a popup element (absolutely positioned in the screen layer) next to an anchor element or
 * rectangle, with {@link computePopupPosition}. The element must be in the document so it can be
 * measured.
 *
 * @param {HTMLElement} element
 * @param {Element | Rectangle} anchor
 * @param {Parameters<typeof computePopupPosition>[2]} [options]
 * @returns {{x: number, y: number, side: string}}
 */
export declare function placePopup(element: HTMLElement, anchor: Element | Rectangle, options?: Parameters<typeof computePopupPosition>[2]): {
    x: number;
    y: number;
    side: string;
};
/**
 * A rectangle of zero size at a point, to place popups at the pointer (context menus, tooltips).
 *
 * @param {number} x
 * @param {number} y
 * @returns {Rectangle}
 */
export declare function pointRectangle(x: number, y: number): Rectangle;
