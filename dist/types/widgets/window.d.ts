/**
 * @module widgets/window
 */
import { AbstractWindow } from './abstract-window.js';
/**
 * A floating window with a title bar, which the user can move, resize, maximize and close.
 *
 * Windows are hidden until shown with `show()` or `present()`. By default a window is centered
 * when first shown; set `x` and `y` (or call `move()`) to place it. Closing destroys the window,
 * unless `destroyOnClose` is `false`, in which case it is hidden.
 *
 * Signals: `close-request` (return `true` from a handler to keep the window open), `close`,
 * `position-change`, `size-change`, `maximized-change`.
 */
export declare class Window extends AbstractWindow {
    _placed: boolean;
    _userSize: {
        width: number;
        height: number;
    } | {
        width: number;
        height: number;
    } | {
        width: number;
        height: number;
    };
    _restoreRect: any;
    _overlayEl: HTMLElement;
    _gesture: {
        target: any;
        move: (moveEvent: any) => any;
        end: () => void;
    };
    _headerEl: Element;
    _titleEl: Element;
    _bodyEl: Element;
    position: {
        x: number;
        y: number;
    };
    _x: any;
    _y: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Moves the window. The same as setting `position`.
     *
     * @param {number} x
     * @param {number} y
     */
    move(x: number, y: number): void;
    /**
     * Resizes the window.
     *
     * @param {number} width
     * @param {number} height
     */
    resize(width: number, height: number): void;
    /**
     * Centers the window on the screen, or over `transientFor` if set.
     */
    center(): void;
    /**
     * Requests to close the window, as if the close button was clicked. Handlers of
     * `close-request` can cancel it by returning `true`.
     *
     * @returns {boolean} Whether the window closed.
     */
    close(): boolean;
    destroy(): void;
    _onVisibleChange(visible: any): void;
    _raise(): void;
    _syncOverlay(): void;
    _applyLayoutStyle(): void;
    _applySize(): void;
    _getSize(): {
        width: number;
        height: number;
    };
    _setPosition(x: any, y: any): void;
    _constrain(): void;
    _syncDecorations(): void;
    _onScreenSizeChange(): void;
    _onHeaderButtonClick(action: any): void;
    _onHeaderDoubleClick(event: any): void;
    _onHeaderPointerDown(event: any): void;
    _onResizerPointerDown(event: any, direction: any): void;
    _startGesture(event: any, shape: any, onMove: any, onEnd: any): void;
    _endGesture(): void;
}

/** The declared properties of {@link Window}. */
export interface Window {
    title: string;
    /**
     * The x coordinate of the window, or -1 to center it.
     */
    x: number;
    /**
     * The y coordinate of the window, or -1 to center it.
     */
    y: number;
    /**
     * The window whose top this window floats on, e.g. the parent of a dialog. It is centered over
     * it when first shown.
     */
    transientFor: any;
    /**
     * Whether the window fills the screen. Only has an effect when `maximizable`.
     */
    maximized: boolean;
    /**
     * Whether the window can be maximized. Shows or hides the maximize button.
     */
    maximizable: boolean;
    /**
     * Whether the user can resize the window.
     */
    resizable: boolean;
    /**
     * Whether the window has a close button.
     */
    closable: boolean;
    /**
     * Whether the user can move the window by dragging its title bar.
     */
    movable: any;
    /**
     * Whether closing destroys the window. If `false`, closing hides it, so it can be shown again.
     */
    destroyOnClose: any;
    modal: boolean;
    /**
     * The opacity of the window, from 0 to 1.
     */
    opacity: number;
    /**
     * Whether the window has a title bar and border. Undecorated windows cannot be resized by the
     * user.
     */
    decorated: boolean;
    /**
     * Whether a resizable window shows a resize grip in its bottom-right corner.
     */
    hasResizeGrip: boolean;
}
