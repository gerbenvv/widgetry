/**
 * @module widgets/main-window
 */
import { AbstractWindow } from './abstract-window.js';
/**
 * The main application window. It fills its host element: by default the whole page (the
 * document body), or any element given as `host`, to embed an application in a page.
 *
 * There can be only one main window at a time. When it fills the page, its `title` is the
 * document title.
 */
export declare class MainWindow extends AbstractWindow {
    _originalTitle: string;
    _bodyEl: Element;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The element the main window fills.
     *
     * @type {HTMLElement}
     */
    get hostElement(): HTMLElement;
    destroy(): void;
    _syncAccessibleName(): void;
    _onVisibleChange(visible: any): void;
}

/** The declared properties of {@link MainWindow}. */
export interface MainWindow {
    /**
     * The element to fill, or `null` for the whole page. Set it before showing the window.
     */
    host: any;
    title: string;
}
