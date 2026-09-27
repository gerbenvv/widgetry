/**
 * @module widgets/progress-bar
 */
import { Widget } from './widget.js';
/**
 * Shows the progress of a long operation: a bar that fills up as `fraction` goes from 0 to 1.
 *
 * When the amount of work is unknown, call `pulse()` now and then instead: the bar switches to
 * activity mode, in which a block bounces back and forth by `pulseStep` per call. Setting
 * `fraction` switches back.
 *
 * With `showText`, the bar shows `text` or, if it is empty, the percentage done. The text is
 * dark over the empty part and light over the filled part. A horizontal bar fills from left to
 * right and a vertical bar from bottom to top; `inverted` reverses that.
 */
export declare class ProgressBar extends Widget {
    _pulsing: boolean;
    _pulsePosition: number;
    _pulseDirection: number;
    _fillEl: Element;
    _textEl: Element;
    _filledTextEl: Element;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Whether the bar is in activity mode, after `pulse()`.
     *
     * @type {boolean}
     */
    get isPulsing(): boolean;
    /**
     * Moves the block of activity mode by `pulseStep`, switching to activity mode first. Call it
     * regularly while the operation makes progress of an unknown amount.
     */
    pulse(): void;
    _applyOrientation(): void;
    _getText(): any;
    _update(): void;
}

/** The declared properties of {@link ProgressBar}. */
export interface ProgressBar {
    /**
     * The fraction of the work that is done, between 0 and 1. Setting it leaves activity mode.
     */
    fraction: number;
    /**
     * The fraction of the bar the block of activity mode moves per `pulse()`.
     */
    pulseStep: number;
    /**
     * The text shown with `showText`. Newlines are shown as spaces. When empty, the percentage is
     * shown instead (except in activity mode).
     */
    text: string;
    /**
     * Whether the text (or the percentage) is shown on the bar.
     */
    showText: boolean;
    /**
     * How the text is shortened when it does not fit: one of `EllipsizeMode`. Without
     * ellipsizing, the bar is at least as wide as its text. Middle ellipsizing is done at the
     * end.
     */
    ellipsize: any;
    /**
     * The direction of the bar: one of `Orientation`.
     */
    orientation: any;
    /**
     * Whether the bar fills in the opposite direction: from right to left, or from top to
     * bottom.
     */
    inverted: boolean;
}
