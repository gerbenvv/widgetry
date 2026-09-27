/**
 * @module widgets/scroll-area
 */
import { Adjustment } from '../data/adjustment.js';
import { Bin } from './bin.js';
/**
 * A scrolled view onto its child, with Clearlooks-styled scroll bars.
 *
 * The child gets at least its natural size, and fills the view when that is larger; with the
 * `never` policy in a direction, the child fits the view in that direction instead, and the
 * scroll area is as large as the child in that direction. Scrolling is native (wheel, touch,
 * keyboard), and is reflected in the adjustments `hAdjustment` and `vAdjustment`: their value is
 * the scroll offset, `upper` the size of the content and `pageSize` the size of the view.
 * Changing an adjustment's value scrolls the view.
 *
 * Like in GTK, the size of a scroll area does not depend on its content: its minimum and natural
 * size is `minContentWidth` by `minContentHeight` (by default nothing but the border), so it can
 * shrink in any container while its content keeps its size. Scroll areas expand in both
 * directions by default. Set `propagateNaturalWidth` or `propagateNaturalHeight` to make the
 * natural size that of the content.
 */
export declare class ScrollArea extends Bin {
    _syncing: boolean;
    _observedChild: any;
    _adjustmentHandlers: Map<any, any>;
    _hAdjustment: any;
    _vAdjustment: any;
    _contentObserver: ResizeObserver;
    _mutationObserver: MutationObserver;
    _measureQueued: boolean;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Scrolls as little as possible to show a descendant, as far as it fits.
     *
     * @param {import('./widget.js').Widget} widget A descendant.
     * @throws {Error} If the widget is not a descendant.
     */
    scrollToWidget(widget: import('./widget.js').Widget): void;
    /**
     * Scrolls to a position of the content.
     *
     * @param {number} x
     * @param {number} y
     */
    scrollTo(x: number, y: number): void;
    destroy(): void;
    _onChildrenChange(): void;
    _onChildLayoutChange(widget: any): void;
    _setAdjustment(name: any, adjustment: any): boolean;
    _onAdjustmentValueChange(horizontal: any): void;
    _syncAdjustments(): void;
    _syncPolicies(): void;
    /**
     * Whether the natural size of the content must be measured: in directions that do not
     * scroll or that propagate it. (A direction that does not scroll while the other does is
     * measured; when only the vertical direction does not scroll, the height follows the content
     * by itself.)
     *
     * @returns {{width: boolean, height: boolean}}
     */
    _getMeasuredDirections(): {
        width: boolean;
        height: boolean;
    };
    _queueNaturalSize(): void;
    /**
     * Updates the natural size of the scroll area. Scroll areas are size-contained, so their
     * content does not affect their size: their natural size is `minContentWidth` by
     * `minContentHeight`, unless it is measured from the content (see
     * `_getMeasuredDirections()`).
     */
    _syncNaturalSize(): void;
    /**
     * Measures the natural size of the child, including its margins and room for the scroll
     * bar across it.
     *
     * @param {import('./widget.js').Widget} child
     * @returns {{width: number, height: number}}
     */
    _measureChild(child: import('./widget.js').Widget): {
        width: number;
        height: number;
    };
    _syncMutationObserver(wanted: any): void;
    _syncMinimumSize(): void;
}

/** The declared properties of {@link ScrollArea}. */
export interface ScrollArea {
    /**
     * The horizontal `Adjustment`: its value is the horizontal scroll offset. Only change its
     * value; the scroll area sets its bounds and page size.
     */
    hAdjustment: Adjustment;
    /**
     * The vertical `Adjustment`: its value is the vertical scroll offset. Only change its
     * value; the scroll area sets its bounds and page size.
     */
    vAdjustment: Adjustment;
    /**
     * When the horizontal scroll bar is shown: one of `Policy`. With `never`, the content fits
     * the width of the view.
     */
    hPolicy: string;
    /**
     * When the vertical scroll bar is shown: one of `Policy`. With `never`, the content fits the
     * height of the view.
     */
    vPolicy: string;
    /**
     * The border around the view: one of `ShadowType`.
     */
    shadowType: string;
    /**
     * Whether the natural width of the scroll area is that of its content, instead of
     * `minContentWidth`. In some containers the natural size is also the minimum size.
     */
    propagateNaturalWidth: boolean;
    /**
     * Whether the natural height of the scroll area is that of its content, instead of
     * `minContentHeight`. In some containers the natural size is also the minimum size.
     */
    propagateNaturalHeight: boolean;
    /**
     * The minimum width of the view in pixels, or -1 for none.
     */
    minContentWidth: number;
    /**
     * The minimum height of the view in pixels, or -1 for none.
     */
    minContentHeight: number;
}
