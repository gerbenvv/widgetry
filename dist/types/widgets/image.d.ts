/**
 * @module widgets/image
 */
import { Widget } from './widget.js';
/**
 * An image: a named icon (see `icons/icons.js`) or a picture loaded from a URL.
 *
 * Images keep their natural size by default (they are centered rather than stretched). A picture
 * that fails to load shows the `image-missing` placeholder.
 *
 * Signals: `load`, `error`.
 */
export declare class Image extends Widget {
    _pictureEl: HTMLImageElement;
    _render(): HTMLElement;
    _showIcon(name: any): void;
    _showPicture(source: any): void;
    _syncAccessibleName(): void;
    _applyPixelSize(): void;
}

/** The declared properties of {@link Image}. */
export interface Image {
    /**
     * The name of an icon, e.g. `'document-open'`. Setting it clears `source`.
     */
    icon: string;
    /**
     * The URL of a picture. Setting it clears `icon`.
     */
    source: string;
    /**
     * The size of an icon in pixels, or 0 for the default (16 pixels, or the font's size in
     * buttons). Pictures are scaled to fit it too.
     */
    pixelSize: number;
    /**
     * A text alternative for assistive technology, used when `accessibleName` is not set. An image
     * without either is decorative and hidden from assistive technology.
     */
    alternativeText: string;
}
