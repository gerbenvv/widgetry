/**
 * Keyboard accelerators ('Ctrl+S', 'Ctrl+Shift+Z', 'F5') and mnemonics ('_File'), and the
 * accelerator group of a window, which activates menu items and other handlers when their
 * accelerator is pressed anywhere in the window.
 *
 * @module widgets/accelerators
 */
import { Instance } from '../core/instance.js';
export type Accelerator = {
    /**
     * The `KeyboardEvent.key` value; letters are lowercase.
     */
    key: string;
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
};
export type AcceleratorShell = {
    destroyed: boolean;
    /**
     * Handles menu bar keys (F10
     * and Alt with a mnemonic); returns whether it handled the key.
     */
    _handleWindowKey?: (event: KeyboardEvent) => boolean;
    /**
     * Returns the item whose accelerator matches the key event, or `null`.
     */
    _findAccelerator: (event: KeyboardEvent) => ({
        _activateByAccelerator: () => boolean;
    } | null);
};
/**
 * @typedef {object} Accelerator
 * @property {string} key The `KeyboardEvent.key` value; letters are lowercase.
 * @property {boolean} ctrl
 * @property {boolean} shift
 * @property {boolean} alt
 * @property {boolean} meta
 */
/**
 * @typedef {object} AcceleratorShell
 * @property {boolean} destroyed
 * @property {(event: KeyboardEvent) => boolean} [_handleWindowKey] Handles menu bar keys (F10
 *     and Alt with a mnemonic); returns whether it handled the key.
 * @property {(event: KeyboardEvent) => ({_activateByAccelerator: () => boolean} | null)}
 *     _findAccelerator Returns the item whose accelerator matches the key event, or `null`.
 */
/**
 * Whether the platform is macOS (or iOS), where the primary modifier is Command.
 *
 * @type {boolean}
 */
export declare const IS_MAC: boolean;
/**
 * Parses an accelerator string such as `'Ctrl+S'`, `'Ctrl+Shift+Z'`, `'F5'` or `'Primary+O'`.
 * Modifiers are `Ctrl` (or `Control`), `Shift`, `Alt`, `Meta` (or `Cmd`, `Super`) and `Primary`,
 * which is Control, or Command on macOS. Names are case-insensitive.
 *
 * @param {string} text
 * @returns {Accelerator}
 * @throws {Error} If the string is not a valid accelerator.
 */
export declare function parseAccelerator(text: string): Accelerator;
/**
 * Formats an accelerator for display, e.g. `'Ctrl+Shift+Z'`, or `'⇧⌘Z'` on macOS.
 *
 * @param {Accelerator | string} accelerator
 * @param {object} [options]
 * @param {boolean} [options.mac] Whether to use the macOS symbols. Defaults to the platform.
 * @returns {string}
 */
export declare function formatAccelerator(accelerator: Accelerator | string, options?: {
    mac?: boolean;
}): string;
/**
 * Formats an accelerator as an `aria-keyshortcuts` value, e.g. `'Control+Shift+Z'`.
 *
 * @param {Accelerator | string} accelerator
 * @returns {string}
 */
export declare function toAriaKeyShortcuts(accelerator: Accelerator | string): string;
/**
 * Checks whether a key event matches an accelerator. Letters and digits also match by their
 * physical key, so accelerators work with other keyboard layouts and with Option on macOS.
 *
 * @param {Accelerator} accelerator
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export declare function matchesAccelerator(accelerator: Accelerator, event: KeyboardEvent): boolean;
/**
 * Splits a label with mnemonic underscores: `'_File'` has the text `'File'` and the mnemonic
 * `'f'`. A double underscore is a literal underscore.
 *
 * @param {string} label
 * @param {boolean} [useUnderline] Whether underscores mark mnemonics. Defaults to true.
 * @returns {{text: string, mnemonic: string, index: number}} The mnemonic (lowercase, or `''`)
 *     and its index in the text (or -1).
 */
export declare function parseMnemonic(label: string, useUnderline?: boolean): {
    text: string;
    mnemonic: string;
    index: number;
};
/**
 * Renders a label with mnemonic underscores into an element, underlining the mnemonic.
 *
 * @param {HTMLElement} element
 * @param {string} label
 * @param {boolean} [useUnderline]
 * @returns {{text: string, mnemonic: string}}
 */
export declare function renderMnemonicLabel(element: HTMLElement, label: string, useUnderline?: boolean): {
    text: string;
    mnemonic: string;
};
/**
 * The accelerators of a window. It listens for key presses on the window element and activates
 * the matching menu item (of the window's menu bars and of menus attached to its widgets) or
 * handler, unless a menu is open or the focused widget already handled the key. It also handles
 * the menu bar keys: F10 and Alt with a mnemonic.
 *
 * Get the group of a window with {@link getAcceleratorGroup}.
 */
export declare class AcceleratorGroup extends Instance {
    /** @type {Set<AcceleratorShell>} */
    _shells: Set<AcceleratorShell>;
    /** @type {{accelerator: Accelerator, handler: (event: KeyboardEvent) => unknown}[]} */
    _entries: {
        accelerator: Accelerator;
        handler: (event: KeyboardEvent) => unknown;
    }[];
    _initialize(): void;
    /**
     * Adds a handler for an accelerator. A handler that returns `false` does not handle the key.
     *
     * @param {string | Accelerator} accelerator
     * @param {(event: KeyboardEvent) => unknown} handler
     * @returns {() => void} A function that removes the handler again.
     */
    add(accelerator: string | Accelerator, handler: (event: KeyboardEvent) => unknown): () => void;
    /**
     * Adds a menu shell (a menu bar or a menu) whose items' accelerators work in the window.
     *
     * @param {AcceleratorShell} shell
     */
    addShell(shell: AcceleratorShell): void;
    /**
     * Removes a menu shell.
     *
     * @param {AcceleratorShell} shell
     */
    removeShell(shell: AcceleratorShell): void;
    /**
     * Handles a key press as the window would: runs the matching handler or activates the
     * matching menu item.
     *
     * @param {KeyboardEvent} event
     * @returns {boolean} Whether the key was handled.
     */
    handleKey(event: KeyboardEvent): boolean;
    _onKeyDown(event: any): void;
}
/**
 * Returns the accelerator group of a window, creating it on first use.
 *
 * @param {import('./abstract-window.js').AbstractWindow} window
 * @returns {AcceleratorGroup}
 */
export declare function getAcceleratorGroup(window: import('./abstract-window.js').AbstractWindow): AcceleratorGroup;
/**
 * Makes a menu shell's accelerators work in the window of a widget, for as long as the widget is
 * visible in that window. Follows the widget when it moves to another window.
 *
 * @param {import('./widget.js').Widget} widget
 * @param {AcceleratorShell} shell
 * @returns {() => void} A function that stops tracking.
 */
export declare function trackAccelerators(widget: import('./widget.js').Widget, shell: AcceleratorShell): () => void;

/** The declared properties of {@link AcceleratorGroup}. */
export interface AcceleratorGroup {
    /**
     * The window of the group.
     */
    readonly window: any;
}
