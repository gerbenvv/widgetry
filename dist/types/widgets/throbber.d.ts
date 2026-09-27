/**
 * @module widgets/throbber
 */
import { Widget } from './widget.js';
/**
 * A busy indicator: a ring of spokes that spins while `active`, and is shown dimmed and still
 * otherwise. GTK calls it a spinner, so it is also exported as `Spinner`.
 */
export declare class Throbber extends Widget {
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Starts spinning. The same as setting `active` to `true`.
     */
    start(): void;
    /**
     * Stops spinning. The same as setting `active` to `false`.
     */
    stop(): void;
    _applyActive(): void;
}
/**
 * The GTK name of `Throbber`.
 */
export declare const Spinner: typeof Throbber;

/** The declared properties of {@link Throbber}. */
export interface Throbber {
    /**
     * Whether the throbber spins.
     */
    active: boolean;
    /**
     * The size in pixels, or 0 for the default of 32 pixels.
     */
    pixelSize: number;
}
