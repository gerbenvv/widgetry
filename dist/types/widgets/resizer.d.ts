/**
 * @module widgets/resizer
 */
import { Bin } from './bin.js';
export type Dimension = {
    /**
     * In pixels, or -1 for none.
     */
    width: number;
    /**
     * In pixels, or -1 for none.
     */
    height: number;
};
/**
 * A bin that lets the user resize its child by dragging its right edge, its bottom edge or the
 * grip in its bottom-right corner.
 *
 * The size of the child area is `size` (with `width` and `height`, -1 for the natural size),
 * limited by `minSize` and `maxSize` and by the child's own minimum size. With `keepRatio`,
 * resizing keeps the ratio of width to height: `ratio`, or the ratio of the child's natural size
 * when `useChildRatio` is set.
 *
 * When `canFocus` is set, the arrow keys resize as well.
 */
export declare class Resizer extends Bin {
    _drag: {
        target: any;
        move: (moveEvent: any) => void;
        end: () => void;
    };
    _bodyEl: Element;
    _handleEls: {
        e: Element;
        s: Element;
        se: Element;
    };
    _gripEl: Element;
    size: {
        width: number;
        height: number;
    };
    _size: Readonly<{
        width: number;
        height: number;
    }>;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The handle that takes the keyboard focus: the corner handle when resizing in both
     * directions, otherwise the edge handle.
     *
     * @type {HTMLElement}
     */
    get focusElement(): HTMLElement;
    destroy(): void;
    _applyLayoutStyle(): void;
    _applySize(): void;
    _clampSize(size: any, childMinimum?: any): {
        width: any;
        height: any;
    };
    _syncDirections(): void;
    /**
     * Measures the size of the child area in some state of its CSS size, restoring it after.
     *
     * @param {string} width A CSS width, e.g. `'min-content'`.
     * @param {string} height A CSS height.
     * @returns {{width: number, height: number}}
     */
    _measureBody(width: string, height: string): {
        width: number;
        height: number;
    };
    _getRatio(): any;
    /**
     * Resizes as the user does: to the given size of the child area, limited by the minimum and
     * maximum sizes and the child's minimum size, keeping the ratio when asked.
     *
     * @param {{width: number, height: number}} size
     * @param {string} direction `'e'`, `'s'` or `'se'`.
     * @param {{width: number, height: number}} childMinimum
     * @param {number | null} ratio
     * @param {{width: number, height: number}} origin The size when resizing started.
     */
    _resizeTo(size: {
        width: number;
        height: number;
    }, direction: string, childMinimum: {
        width: number;
        height: number;
    }, ratio: number | null, origin: {
        width: number;
        height: number;
    }): void;
    _onPointerDown(event: any, direction: any): void;
    _endDrag(): void;
    _onKeyDown(event: any): void;
}

/** The declared properties of {@link Resizer}. */
export interface Resizer {
    /**
     * The width of the child area, or -1 for the natural width. The same as `size.width`.
     */
    width: number;
    /**
     * The height of the child area, or -1 for the natural height. The same as `size.height`.
     */
    height: number;
    /**
     * The minimum size of the child area; a component of -1 means no minimum.
     */
    minSize: any;
    /**
     * The minimum width of the child area, or -1 for none.
     */
    minWidth: any;
    /**
     * The minimum height of the child area, or -1 for none.
     */
    minHeight: any;
    /**
     * The maximum size of the child area; a component of -1 means no maximum.
     */
    maxSize: any;
    /**
     * The maximum width of the child area, or -1 for none.
     */
    maxWidth: any;
    /**
     * The maximum height of the child area, or -1 for none.
     */
    maxHeight: any;
    /**
     * The directions the user can resize in: a mask of `ResizeDirections`.
     */
    resizeDirections: number;
    /**
     * The original toolkit's name of `resizeDirections`.
     */
    directions: number;
    /**
     * Whether the corner shows a resize grip, when resizing in both directions.
     */
    hasGrip: boolean;
    /**
     * Whether resizing keeps the ratio of width to height.
     */
    keepRatio: any;
    /**
     * The ratio of width to height that `keepRatio` keeps, unless `useChildRatio` is set.
     */
    ratio: number;
    /**
     * Whether `keepRatio` keeps the ratio of the child's natural size instead of `ratio`.
     */
    useChildRatio: any;
}
