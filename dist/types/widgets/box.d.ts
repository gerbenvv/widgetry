/**
 * @module widgets/box
 */
import { Container } from './container.js';
/**
 * Lays out its children in a single row or column.
 *
 * Children get their natural size; extra space is shared equally by the children that expand
 * in the box's direction. With `homogeneous`, all children get the same size.
 */
export declare class Box extends Container {
    _initialize(): void;
    _render(): HTMLElement;
    _updateLayout(): void;
    _layoutChild(child: any, horizontal: any): void;
}

/** The declared properties of {@link Box}. */
export interface Box {
    /**
     * The direction children are laid out in: one of `Orientation`.
     */
    orientation: any;
    /**
     * Whether all children get the same size.
     */
    homogeneous: boolean;
    /**
     * The space between children, in pixels.
     */
    spacing: number;
}
