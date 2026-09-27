/**
 * @module widgets/scroll-bar
 */
import { Adjustment } from '../data/adjustment.js';
import { AbstractSlider } from './abstract-slider.js';
/**
 * A scroll bar, which shows and changes the visible part (the page) of something larger.
 *
 * The thumb is as large, relative to the trough, as the page size is relative to the range of the
 * adjustment, but at least `--wy-scroll-bar-min-thumb` long. The thumb is hidden when everything
 * fits in the page. The steppers at both ends step while held, and pressing the trough pages
 * towards the pointer (or moves the thumb there with Shift or the middle button).
 *
 * Scroll bars do not take the keyboard focus by default; set `canFocus` to use the keyboard.
 *
 * Signals: `value-change`.
 */
export declare class ScrollBar extends AbstractSlider {
    _stepperDetaches: (() => void)[];
    _backwardEl: Element;
    _forwardEl: Element;
    _troughEl: Element;
    _thumbEl: Element;
    _initialize(): void;
    _render(): HTMLElement;
    _createAdjustment(): Adjustment;
    destroy(): void;
    _step(forward: any): boolean;
    _getWheelStep(): any;
    _update(): void;
}

/** The declared properties of {@link ScrollBar}. */
export interface ScrollBar {
    /**
     * Whether pressing the trough with the primary button moves the thumb there. Off for scroll
     * bars, which page instead.
     */
    primaryButtonWarps: any;
    /**
     * The size of the page, forwarded to the adjustment.
     */
    pageSize: any;
}
