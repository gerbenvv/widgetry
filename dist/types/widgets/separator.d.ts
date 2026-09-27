/**
 * @module widgets/separator
 */
import { Widget } from './widget.js';
/**
 * A horizontal or vertical line that separates widgets, drawn etched into the background: a
 * dark line with a light line below it (or to its right).
 *
 * A horizontal separator is as wide as its space and `thickness` plus 2 pixels high; a vertical
 * one the other way around.
 */
export declare class Separator extends Widget {
    _initialize(): void;
    _render(): HTMLElement;
    _applyOrientation(): void;
    _applyThickness(): void;
}

/** The declared properties of {@link Separator}. */
export interface Separator {
    /**
     * The direction of the line: one of `Orientation`.
     */
    orientation: string;
    /**
     * The thickness of the line in pixels (at least 1). The default of 2 draws a dark and a light
     * line.
     */
    thickness: number;
}
