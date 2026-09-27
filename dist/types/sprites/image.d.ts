/**
 * @module sprites/image
 */
import { Sprite } from './sprite.js';
/**
 * The picture shown when an image cannot be loaded: a frame with a cross, like a broken image.
 *
 * @type {string}
 */
export declare const MISSING_IMAGE: string;
/**
 * An image loaded from a URL. The position is its top left corner. A size component of -1 (the
 * default) uses the natural size of the image. When the image cannot be loaded, a placeholder is
 * shown.
 *
 * Signals: `load`, `error` (`sprite`).
 */
export declare class ImageSprite extends Sprite {
    /** @type {HTMLImageElement | null} */
    _image: HTMLImageElement | null;
    _failed: boolean;
    _initialize(): void;
    /**
     * The natural size of the loaded image, or zero.
     *
     * @type {{width: number, height: number}}
     */
    get naturalSize(): {
        width: number;
        height: number;
    };
    /**
     * Whether the image could not be loaded.
     *
     * @type {boolean}
     */
    get failed(): boolean;
    _render(): SVGGraphicsElement;
    _applyShape(): void;
    _load(source: any): void;
}

/** The declared properties of {@link ImageSprite}. */
export interface ImageSprite {
    /**
     * The URL of the image.
     */
    source: string;
    /**
     * The size, as `{width, height}`. A component of -1 uses the natural size.
     */
    size: any;
    /**
     * The width, or -1 for the natural width.
     */
    width: any;
    /**
     * The height, or -1 for the natural height.
     */
    height: any;
}
