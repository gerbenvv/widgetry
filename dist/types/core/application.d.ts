/**
 * @module core/application
 */
import { Instance } from './instance.js';
/**
 * The application singleton manages the windows, the global focus and toolkit-wide settings.
 * Import it as `Application`.
 *
 * Signals: `load` (once the document is ready), `active-window-change`, `main-window-change`,
 * `focus-widget-change`, and the event signals selected by `events` for events that no widget
 * handled.
 */
export declare class ApplicationClass extends Instance {
    /** @type {Set<import('../widgets/abstract-window.js').AbstractWindow>} */
    _windows: Set<import('../widgets/abstract-window.js').AbstractWindow>;
    _loaded: boolean;
    _domListeners: Map<any, any>;
    events: number;
    activeWindow: any;
    _mainWindow: any;
    _focusWidget: any;
    _initialize(): void;
    /**
     * Runs a function once the document is ready (immediately if it already is).
     *
     * @param {() => void} method
     */
    ready(method: () => void): void;
    /**
     * The screen singleton.
     *
     * @type {import('./screen.js').Screen}
     */
    get screen(): import('./screen.js').Screen;
    /**
     * All windows that exist (shown or not).
     *
     * @type {import('../widgets/abstract-window.js').AbstractWindow[]}
     */
    get windows(): import('../widgets/abstract-window.js').AbstractWindow[];
    /**
     * Enables application event signals.
     *
     * @param {number} events One or more `Events`.
     */
    enableEvents(events: number): void;
    /**
     * Disables application event signals.
     *
     * @param {number} events One or more `Events`.
     */
    disableEvents(events: number): void;
    /**
     * Registers a window. Called by windows.
     *
     * @protected
     * @param {import('../widgets/abstract-window.js').AbstractWindow} window
     */
    protected _addWindow(window: import('../widgets/abstract-window.js').AbstractWindow): void;
    /**
     * Unregisters a window. Called by windows.
     *
     * @protected
     * @param {import('../widgets/abstract-window.js').AbstractWindow} window
     */
    protected _removeWindow(window: import('../widgets/abstract-window.js').AbstractWindow): void;
    /**
     * @protected
     * @param {import('../widgets/main-window.js').MainWindow | null} mainWindow
     */
    protected _setMainWindow(mainWindow: import('../widgets/main-window.js').MainWindow | null): void;
    /**
     * Updates the global focus widget. Called by windows.
     *
     * @protected
     * @param {import('../widgets/widget.js').Widget | null} widget
     */
    protected _setFocusWidget(widget: import('../widgets/widget.js').Widget | null): void;
    /**
     * The topmost visible modal window, or `null`.
     *
     * @type {import('../widgets/abstract-window.js').AbstractWindow | null}
     */
    get modalWindow(): import('../widgets/abstract-window.js').AbstractWindow | null;
    _onLoad(): void;
    _findWindow(node: any): import("../index.js").AbstractWindow;
    _onDocumentFocusIn(event: any): void;
    /**
     * Whether a node is in a popup in the screen layer (a menu, popover or tooltip), rather than
     * in a window.
     *
     * @param {Node} node
     * @returns {boolean}
     */
    _isInPopup(node: Node): boolean;
    _onDocumentPointerDown(event: any): void;
    _syncEventListeners(): void;
    _onDocumentMouseDown(event: any): void;
    _applyTheme(): void;
}
/**
 * The application singleton.
 *
 * @type {ApplicationClass}
 */
export declare const Application: ApplicationClass;

/** The declared properties of {@link ApplicationClass}. */
export interface ApplicationClass {
    /**
     * The main window, or `null`.
     */
    readonly mainWindow: any;
    /**
     * The widget with the keyboard focus, or `null`. Setting it focuses the widget and activates
     * its window.
     */
    focusWidget: any;
    /**
     * The color theme: `'light'` (the classic look), `'dark'` or `'auto'` (follows the system).
     */
    theme: string;
    /**
     * The accent (selection and highlight) color as a CSS color, or `null` for the theme's blue.
     */
    accentColor: any;
    /**
     * Delay in milliseconds before a tooltip appears.
     */
    tooltipAppearDelay: any;
    /**
     * Maximum time in milliseconds between presses of a double (or triple) press.
     */
    multiplePressInterval: any;
    /**
     * Delay in milliseconds before a submenu opens on hover.
     */
    submenuDelay: any;
    /**
     * Distance in pixels the pointer must move before a drag starts.
     */
    dragThreshold: any;
}
