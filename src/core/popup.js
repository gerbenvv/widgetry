/**
 * Positioning of popups (menus, tooltips, combo box lists, calendars) on the screen.
 *
 * @module core/popup
 */

import { getScreen } from './screen.js';

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
export function computePopupPosition(anchor, size, options = {}) {
    const side = options.side || 'bottom';
    const align = options.align || 'start';
    const offset = options.offset || 0;
    const bounds = options.bounds || getScreen().size;

    const vertical = side === 'bottom' || side === 'top';

    // Along the main axis: which side, flipping when needed.
    const before = vertical ? anchor.y - offset : anchor.x - offset;
    const after = vertical
        ? bounds.height - (anchor.y + anchor.height + offset)
        : bounds.width - (anchor.x + anchor.width + offset);
    const extent = vertical ? size.height : size.width;

    let placeAfter = side === 'bottom' || side === 'right';
    if (placeAfter && extent > after && (extent <= before || before > after)) {
        placeAfter = false;
    } else if (!placeAfter && extent > before && (extent <= after || after > before)) {
        placeAfter = true;
    }

    let main;
    if (vertical) {
        main = placeAfter ? anchor.y + anchor.height + offset : anchor.y - offset - size.height;
    } else {
        main = placeAfter ? anchor.x + anchor.width + offset : anchor.x - offset - size.width;
    }

    // Along the cross axis: aligned with the anchor, then shifted to stay on screen.
    const crossStart = vertical ? anchor.x : anchor.y;
    const crossLength = vertical ? anchor.width : anchor.height;
    const crossSize = vertical ? size.width : size.height;
    const crossBound = vertical ? bounds.width : bounds.height;

    let cross;
    if (align === 'end') {
        cross = crossStart + crossLength - crossSize;
    } else if (align === 'center') {
        cross = crossStart + (crossLength - crossSize) / 2;
    } else {
        cross = crossStart;
    }

    cross = Math.max(0, Math.min(cross, crossBound - crossSize));

    // Keep the main axis on screen as well, for popups larger than both sides.
    const mainBound = vertical ? bounds.height : bounds.width;
    main = Math.max(0, Math.min(main, mainBound - extent));

    const resultSide = placeAfter ? (vertical ? 'bottom' : 'right') : vertical ? 'top' : 'left';

    return vertical
        ? { x: Math.round(cross), y: Math.round(main), side: resultSide }
        : { x: Math.round(main), y: Math.round(cross), side: resultSide };
}

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
export function placePopup(element, anchor, options = {}) {
    const rect = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;

    const anchorRect = {
        x: rect.x ?? rect.left,
        y: rect.y ?? rect.top,
        width: rect.width,
        height: rect.height,
    };
    const size = { width: element.offsetWidth, height: element.offsetHeight };

    const position = computePopupPosition(anchorRect, size, options);

    element.style.left = `${position.x}px`;
    element.style.top = `${position.y}px`;
    element.dataset.side = position.side;

    return position;
}

/**
 * A rectangle of zero size at a point, to place popups at the pointer (context menus, tooltips).
 *
 * @param {number} x
 * @param {number} y
 * @returns {Rectangle}
 */
export function pointRectangle(x, y) {
    return { x, y, width: 0, height: 0 };
}
