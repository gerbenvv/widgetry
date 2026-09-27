/**
 * Keyboard accelerators ('Ctrl+S', 'Ctrl+Shift+Z', 'F5') and mnemonics ('_File'), and the
 * accelerator group of a window, which activates menu items and other handlers when their
 * accelerator is pressed anywhere in the window.
 *
 * @module widgets/accelerators
 */

import { defineProperties, Instance } from '../core/instance.js';
import { escapeHtml } from '../core/util.js';
import { Key } from '../events/constants.js';
import { getMenuManager } from './menu-manager.js';

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
export const IS_MAC =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.userAgentData?.platform || navigator.platform || '');

/**
 * Modifier names in accelerator strings, and the modifier they stand for. `Primary` is Control,
 * or Command on macOS.
 *
 * @type {Readonly<Record<string, string>>}
 */
const MODIFIER_NAMES = Object.freeze({
    ctrl: 'ctrl',
    control: 'ctrl',
    shift: 'shift',
    alt: 'alt',
    option: 'alt',
    meta: 'meta',
    cmd: 'meta',
    command: 'meta',
    super: 'meta',
    primary: 'primary',
    mod: 'primary',
    cmdorctrl: 'primary',
});

/**
 * Key names in accelerator strings that are not `KeyboardEvent.key` values, by lowercase name.
 *
 * @type {Readonly<Record<string, string>>}
 */
const KEY_ALIASES = Object.freeze({
    esc: Key.ESCAPE,
    escape: Key.ESCAPE,
    return: Key.ENTER,
    enter: Key.ENTER,
    space: Key.SPACE,
    spacebar: Key.SPACE,
    del: Key.DELETE,
    delete: Key.DELETE,
    ins: Key.INSERT,
    insert: Key.INSERT,
    backspace: Key.BACKSPACE,
    tab: Key.TAB,
    up: Key.UP,
    down: Key.DOWN,
    left: Key.LEFT,
    right: Key.RIGHT,
    arrowup: Key.UP,
    arrowdown: Key.DOWN,
    arrowleft: Key.LEFT,
    arrowright: Key.RIGHT,
    pageup: Key.PAGE_UP,
    pagedown: Key.PAGE_DOWN,
    home: Key.HOME,
    end: Key.END,
    plus: '+',
    minus: '-',
    comma: ',',
    period: '.',
    contextmenu: Key.CONTEXT_MENU,
});

/**
 * How keys are shown in menus, by `KeyboardEvent.key` value.
 *
 * @type {Readonly<Record<string, string>>}
 */
const KEY_LABELS = Object.freeze({
    [Key.ESCAPE]: 'Esc',
    [Key.ENTER]: 'Enter',
    [Key.SPACE]: 'Space',
    [Key.DELETE]: 'Delete',
    [Key.INSERT]: 'Insert',
    [Key.BACKSPACE]: 'Backspace',
    [Key.TAB]: 'Tab',
    [Key.UP]: 'Up',
    [Key.DOWN]: 'Down',
    [Key.LEFT]: 'Left',
    [Key.RIGHT]: 'Right',
    [Key.PAGE_UP]: 'Page Up',
    [Key.PAGE_DOWN]: 'Page Down',
    [Key.HOME]: 'Home',
    [Key.END]: 'End',
});

/**
 * How keys are shown in menus on macOS, by `KeyboardEvent.key` value.
 *
 * @type {Readonly<Record<string, string>>}
 */
const MAC_KEY_LABELS = Object.freeze({
    [Key.ESCAPE]: '⎋',
    [Key.ENTER]: '↩',
    [Key.SPACE]: 'Space',
    [Key.DELETE]: '⌦',
    [Key.BACKSPACE]: '⌫',
    [Key.TAB]: '⇥',
    [Key.UP]: '↑',
    [Key.DOWN]: '↓',
    [Key.LEFT]: '←',
    [Key.RIGHT]: '→',
    [Key.PAGE_UP]: '⇞',
    [Key.PAGE_DOWN]: '⇟',
    [Key.HOME]: '↖',
    [Key.END]: '↘',
});

/**
 * Text editing shortcuts that an editable element handles itself, as lowercase keys pressed with
 * the primary modifier.
 *
 * @type {ReadonlySet<string>}
 */
const EDITING_KEYS = new Set([
    'a',
    'c',
    'v',
    'x',
    'z',
    'y',
    Key.LEFT,
    Key.RIGHT,
    Key.HOME,
    Key.END,
]);

/**
 * The accelerator groups of windows.
 *
 * @type {WeakMap<object, AcceleratorGroup>}
 */
const GROUPS = new WeakMap();

/**
 * Parses an accelerator string such as `'Ctrl+S'`, `'Ctrl+Shift+Z'`, `'F5'` or `'Primary+O'`.
 * Modifiers are `Ctrl` (or `Control`), `Shift`, `Alt`, `Meta` (or `Cmd`, `Super`) and `Primary`,
 * which is Control, or Command on macOS. Names are case-insensitive.
 *
 * @param {string} text
 * @returns {Accelerator}
 * @throws {Error} If the string is not a valid accelerator.
 */
export function parseAccelerator(text) {
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error(`Invalid accelerator '${text}'.`);
    }

    // A trailing '+' is the plus key itself, as in 'Ctrl++'.
    let source = text.trim();
    let plus = false;
    if (source.endsWith('++') || source === '+') {
        plus = true;
        source = source.slice(0, source === '+' ? 0 : -2);
    }

    const parts = source ? source.split('+').map((x) => x.trim()) : [];
    const accelerator = { key: '', ctrl: false, shift: false, alt: false, meta: false };

    const keyName = plus ? '+' : parts.pop();
    for (const part of parts) {
        const modifier = MODIFIER_NAMES[part.toLowerCase()];
        if (!modifier) {
            throw new Error(`Invalid modifier '${part}' in accelerator '${text}'.`);
        }

        if (modifier === 'primary') {
            accelerator[IS_MAC ? 'meta' : 'ctrl'] = true;
        } else {
            accelerator[modifier] = true;
        }
    }

    if (!keyName) {
        throw new Error(`Accelerator '${text}' has no key.`);
    }

    accelerator.key = normalizeKey(keyName);

    return accelerator;
}

/**
 * Converts a key name to a `KeyboardEvent.key` value: letters become lowercase and aliases like
 * `'Esc'` or `'Up'` are resolved.
 *
 * @param {string} name
 * @returns {string}
 */
function normalizeKey(name) {
    const alias = KEY_ALIASES[name.toLowerCase()];
    if (alias) {
        return alias;
    }

    if (name.length === 1) {
        return name.toLowerCase();
    }

    // Function keys and other named keys, like 'F5' or 'PrintScreen'.
    if (/^f\d{1,2}$/i.test(name)) {
        return name.toUpperCase();
    }

    return name;
}

/**
 * Formats an accelerator for display, e.g. `'Ctrl+Shift+Z'`, or `'⇧⌘Z'` on macOS.
 *
 * @param {Accelerator | string} accelerator
 * @param {object} [options]
 * @param {boolean} [options.mac] Whether to use the macOS symbols. Defaults to the platform.
 * @returns {string}
 */
export function formatAccelerator(accelerator, options = {}) {
    const value = typeof accelerator === 'string' ? parseAccelerator(accelerator) : accelerator;
    const mac = options.mac ?? IS_MAC;
    const key = formatKey(value.key, mac);

    if (mac) {
        return [
            value.ctrl ? '⌃' : '',
            value.alt ? '⌥' : '',
            value.shift ? '⇧' : '',
            value.meta ? '⌘' : '',
            key,
        ].join('');
    }

    const parts = [];
    if (value.ctrl) {
        parts.push('Ctrl');
    }

    if (value.alt) {
        parts.push('Alt');
    }

    if (value.shift) {
        parts.push('Shift');
    }

    if (value.meta) {
        parts.push('Super');
    }

    parts.push(key);

    return parts.join('+');
}

function formatKey(key, mac) {
    const labels = mac ? { ...KEY_LABELS, ...MAC_KEY_LABELS } : KEY_LABELS;
    if (labels[key]) {
        return labels[key];
    }

    return key.length === 1 ? key.toUpperCase() : key;
}

/**
 * Formats an accelerator as an `aria-keyshortcuts` value, e.g. `'Control+Shift+Z'`.
 *
 * @param {Accelerator | string} accelerator
 * @returns {string}
 */
export function toAriaKeyShortcuts(accelerator) {
    const value = typeof accelerator === 'string' ? parseAccelerator(accelerator) : accelerator;
    const parts = [];

    if (value.ctrl) {
        parts.push('Control');
    }

    if (value.alt) {
        parts.push('Alt');
    }

    if (value.shift) {
        parts.push('Shift');
    }

    if (value.meta) {
        parts.push('Meta');
    }

    const key = value.key === Key.SPACE ? 'Space' : value.key === '+' ? 'Plus' : value.key;
    parts.push(key.length === 1 ? key.toUpperCase() : key);

    return parts.join('+');
}

/**
 * Checks whether a key event matches an accelerator. Letters and digits also match by their
 * physical key, so accelerators work with other keyboard layouts and with Option on macOS.
 *
 * @param {Accelerator} accelerator
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function matchesAccelerator(accelerator, event) {
    const key = accelerator.key;
    const printable = key.length === 1;
    const letterOrDigit = /^[a-z0-9]$/.test(key);

    // Shifted symbols like '+' need Shift on most layouts, so Shift only counts for them when
    // the accelerator asks for it.
    const shiftMatters = !printable || letterOrDigit || accelerator.shift;

    if (
        event.ctrlKey !== accelerator.ctrl ||
        event.altKey !== accelerator.alt ||
        event.metaKey !== accelerator.meta ||
        (shiftMatters && event.shiftKey !== accelerator.shift)
    ) {
        return false;
    }

    const eventKey = event.key && event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (eventKey === key) {
        return true;
    }

    if (letterOrDigit && event.code) {
        const code = /^[a-z]$/.test(key) ? `Key${key.toUpperCase()}` : `Digit${key}`;

        return event.code === code;
    }

    return false;
}

/**
 * Splits a label with mnemonic underscores: `'_File'` has the text `'File'` and the mnemonic
 * `'f'`. A double underscore is a literal underscore.
 *
 * @param {string} label
 * @param {boolean} [useUnderline] Whether underscores mark mnemonics. Defaults to true.
 * @returns {{text: string, mnemonic: string, index: number}} The mnemonic (lowercase, or `''`)
 *     and its index in the text (or -1).
 */
export function parseMnemonic(label, useUnderline = true) {
    const source = label === null || label === undefined ? '' : String(label);
    if (!useUnderline) {
        return { text: source, mnemonic: '', index: -1 };
    }

    let text = '';
    let mnemonic = '';
    let index = -1;

    for (let i = 0; i < source.length; i++) {
        const character = source[i];
        if (character === '_' && i + 1 < source.length) {
            const next = source[i + 1];
            i += 1;

            if (next !== '_' && index < 0) {
                index = text.length;
                mnemonic = next.toLowerCase();
            }

            text += next;
        } else {
            text += character;
        }
    }

    return { text, mnemonic, index };
}

/**
 * Renders a label with mnemonic underscores into an element, underlining the mnemonic.
 *
 * @param {HTMLElement} element
 * @param {string} label
 * @param {boolean} [useUnderline]
 * @returns {{text: string, mnemonic: string}}
 */
export function renderMnemonicLabel(element, label, useUnderline = true) {
    const { text, mnemonic, index } = parseMnemonic(label, useUnderline);

    if (index < 0) {
        element.textContent = text;
    } else {
        element.innerHTML =
            escapeHtml(text.slice(0, index)) +
            `<u class="wy-mnemonic">${escapeHtml(text[index])}</u>` +
            escapeHtml(text.slice(index + 1));
    }

    return { text, mnemonic };
}

/**
 * Checks whether a key event is a text editing shortcut in an editable element (such as Ctrl+C
 * in a line edit), which the element handles itself rather than a window accelerator.
 *
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
function isEditingKey(event) {
    const target = /** @type {HTMLElement} */ (event.target);
    const editable =
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches('input, textarea, select'));

    if (!editable) {
        return false;
    }

    // Plain keys (possibly with Shift) type or move the caret.
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        return true;
    }

    const primary = IS_MAC ? event.metaKey : event.ctrlKey;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    return primary && !event.altKey && EDITING_KEYS.has(key);
}

/**
 * The accelerators of a window. It listens for key presses on the window element and activates
 * the matching menu item (of the window's menu bars and of menus attached to its widgets) or
 * handler, unless a menu is open or the focused widget already handled the key. It also handles
 * the menu bar keys: F10 and Alt with a mnemonic.
 *
 * Get the group of a window with {@link getAcceleratorGroup}.
 */
export class AcceleratorGroup extends Instance {
    _initialize() {
        super._initialize();

        /** @type {Set<AcceleratorShell>} */
        this._shells = new Set();

        /** @type {{accelerator: Accelerator, handler: (event: KeyboardEvent) => unknown}[]} */
        this._entries = [];

        this._onKeyDown = this._onKeyDown.bind(this);
    }

    /**
     * Adds a handler for an accelerator. A handler that returns `false` does not handle the key.
     *
     * @param {string | Accelerator} accelerator
     * @param {(event: KeyboardEvent) => unknown} handler
     * @returns {() => void} A function that removes the handler again.
     */
    add(accelerator, handler) {
        if (typeof handler !== 'function') {
            throw new TypeError('An accelerator handler must be a function.');
        }

        const entry = {
            accelerator:
                typeof accelerator === 'string' ? parseAccelerator(accelerator) : accelerator,
            handler,
        };
        this._entries.push(entry);

        return () => {
            const index = this._entries.indexOf(entry);
            if (index >= 0) {
                this._entries.splice(index, 1);
            }
        };
    }

    /**
     * Adds a menu shell (a menu bar or a menu) whose items' accelerators work in the window.
     *
     * @param {AcceleratorShell} shell
     */
    addShell(shell) {
        this._shells.add(shell);
    }

    /**
     * Removes a menu shell.
     *
     * @param {AcceleratorShell} shell
     */
    removeShell(shell) {
        this._shells.delete(shell);
    }

    /**
     * Handles a key press as the window would: runs the matching handler or activates the
     * matching menu item.
     *
     * @param {KeyboardEvent} event
     * @returns {boolean} Whether the key was handled.
     */
    handleKey(event) {
        if (event.defaultPrevented || event.isComposing) {
            return false;
        }

        // While a menu is open the menus have the keyboard.
        if (getMenuManager().isOpen) {
            return false;
        }

        const shells = [...this._shells].filter((x) => !x.destroyed);

        // Menu bar keys: F10 and Alt with a mnemonic.
        for (const shell of shells) {
            if (shell._handleWindowKey?.(event)) {
                return true;
            }
        }

        if (isEditingKey(event)) {
            return false;
        }

        for (const entry of this._entries) {
            if (matchesAccelerator(entry.accelerator, event) && entry.handler(event) !== false) {
                return true;
            }
        }

        for (const shell of shells) {
            const item = shell._findAccelerator(event);
            if (item) {
                // An insensitive item does not activate, but still keeps the key from the
                // browser (so Ctrl+S never opens the browser's save dialog).
                item._activateByAccelerator();

                return true;
            }
        }

        return false;
    }

    _onKeyDown(event) {
        if (this.handleKey(event)) {
            event.preventDefault();
            event.stopPropagation();
        }
    }
}

defineProperties(AcceleratorGroup, {
    /**
     * The window of the group.
     */
    window: { value: null, readOnly: true },
});

/**
 * Returns the accelerator group of a window, creating it on first use.
 *
 * @param {import('./abstract-window.js').AbstractWindow} window
 * @returns {AcceleratorGroup}
 */
export function getAcceleratorGroup(window) {
    if (!window || !window.isWindow) {
        throw new TypeError('Accelerator groups belong to windows.');
    }

    let group = GROUPS.get(window);
    if (!group) {
        group = new AcceleratorGroup();
        group._window = window;
        GROUPS.set(window, group);

        window.el.addEventListener('keydown', group._onKeyDown);
        window.connect('destroy', () => {
            window.el.removeEventListener('keydown', group._onKeyDown);
            GROUPS.delete(window);
            group.destroy();
        });
    }

    return group;
}

/**
 * Makes a menu shell's accelerators work in the window of a widget, for as long as the widget is
 * visible in that window. Follows the widget when it moves to another window.
 *
 * @param {import('./widget.js').Widget} widget
 * @param {AcceleratorShell} shell
 * @returns {() => void} A function that stops tracking.
 */
export function trackAccelerators(widget, shell) {
    let group = null;

    const update = () => {
        const window = !widget.destroyed && widget.isVisible ? widget.window : null;
        const next = window ? getAcceleratorGroup(window) : null;
        if (next === group) {
            return;
        }

        group?.removeShell(shell);
        group = next;

        group?.addShell(shell);
    };

    const disconnects = [
        widget.connect('is-visible-change', update),
        widget.connect('parent-change', update),
        widget.connect('destroy', () => stop()),
    ];

    function stop() {
        disconnects.forEach((disconnect) => disconnect());
        disconnects.length = 0;

        group?.removeShell(shell);
        group = null;
    }

    update();

    return stop;
}
