/**
 * @module widgets/abstract-window
 */
import { Bin } from './bin.js';
import { Widget } from './widget.js';
/**
 * Base class of top-level widgets.
 *
 * A window remembers its own focus widget. Only the active window has the keyboard focus; when
 * a window becomes active again, its focus widget gets the focus back. Tab and Shift+Tab move the
 * focus through the window's focusable widgets in tree order, wrapping around at the ends.
 *
 * Windows are hidden until shown. Signals: `focus-widget-change`.
 */
export declare class AbstractWindow extends Bin {
    active: boolean;
    _active: any;
    _focusWidget: any;
    _initialize(): void;
    /**
     * Shows the window and makes it active.
     */
    present(): void;
    /**
     * Moves the focus within the window.
     *
     * @param {number} direction One of `FocusDirection`.
     * @returns {boolean} Whether a widget got the focus.
     */
    moveFocus(direction: number): boolean;
    destroy(): void;
    /**
     * The stacking order of the window; higher is on top.
     *
     * @type {number}
     */
    get zIndex(): number;
    /**
     * Whether this window is stacked above another window.
     *
     * @protected
     * @param {AbstractWindow} window
     * @returns {boolean}
     */
    protected _isAbove(window: AbstractWindow): boolean;
    /**
     * Draws attention to the window, e.g. when a click on another window was blocked because this
     * window is modal.
     *
     * @protected
     */
    protected _blink(): void;
    /**
     * Handles showing and hiding. Subclasses extend this to attach and detach their element.
     *
     * @protected
     * @param {boolean} visible
     */
    protected _onVisibleChange(visible: boolean): void;
    _isShown(): any;
    /**
     * Sets the active flag. Called by the application, which ensures a single active window.
     *
     * @protected
     * @param {boolean} active
     */
    protected _setActive(active: boolean): void;
    /**
     * Brings the window to the front. Overridden by floating windows.
     *
     * @protected
     */
    protected _raise(): void;
    /**
     * Activates the window because the keyboard focus moved into it.
     *
     * @protected
     */
    protected _activateFromFocus(): void;
    /**
     * Sets the focus widget of the window without moving the DOM focus.
     *
     * @protected
     * @param {Widget | null} widget
     */
    protected _setFocusWidget(widget: Widget | null): void;
    _syncFocusStates(): void;
    /**
     * Moves the focus away from a widget that is being hidden, made insensitive, unparented or
     * destroyed.
     *
     * @protected
     * @param {Widget} widget
     */
    protected _onFocusWidgetGone(widget: Widget): void;
    _onFocusIn(event: any): void;
    _onFocusOut(_event: any): void;
    _onWindowKeyDown(event: any): void;
}

/** The declared properties of {@link AbstractWindow}. */
export interface AbstractWindow {
    readonly isTopLevel: any;
    readonly isWindow: any;
    visible: boolean;
    /**
     * The title of the window.
     */
    title: any;
    /**
     * Whether the window becomes active when shown.
     */
    activateOnShow: any;
    /**
     * Whether the window blocks interaction with the windows below it while shown.
     */
    modal: any;
    /**
     * The widget with the focus within this window, or `null`. Setting it focuses the widget.
     */
    focusWidget: any;
}
