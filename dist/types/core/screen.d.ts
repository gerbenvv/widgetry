/**
 * @module core/screen
 */
import { Instance } from './instance.js';
/**
 * The screen: the browser viewport, and the layer that windows, menus and tooltips float in.
 *
 * Signals: `size-change`.
 */
export declare class Screen extends Instance {
    _layer: HTMLDivElement;
    _zIndex: number;
    _size: {
        width: number;
        height: number;
    } | {
        width: number;
        height: number;
    };
    _initialize(): void;
    /**
     * The element that top-level widgets float in. It covers the viewport and is created on first
     * use.
     *
     * @type {HTMLElement}
     */
    get layer(): HTMLElement;
    /**
     * Returns a z-index above everything returned before.
     *
     * @returns {number}
     */
    nextZIndex(): number;
    _measure(): {
        width: number;
        height: number;
    };
}
/**
 * Returns the screen singleton.
 *
 * @type {() => Screen}
 */
export declare const getScreen: () => Screen;

/** The declared properties of {@link Screen}. */
export interface Screen {
    /**
     * The size of the viewport, as `{width, height}`.
     */
    readonly size: any;
    /**
     * The width of the viewport.
     */
    readonly width: any;
    /**
     * The height of the viewport.
     */
    readonly height: any;
}
