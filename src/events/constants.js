/**
 * Event types, masks, modifiers, buttons and keys.
 *
 * @module events/constants
 */

/**
 * Event types. The widget signal of an event type is `<type>-event`, e.g. `button-press-event`.
 *
 * @enum {string}
 */
export const EventType = Object.freeze({
    MOTION: 'motion',
    SCROLL: 'scroll',
    ENTER: 'enter',
    LEAVE: 'leave',
    KEY_PRESS: 'key-press',
    KEY_RELEASE: 'key-release',
    BUTTON_PRESS: 'button-press',
    BUTTON_RELEASE: 'button-release',
    FOCUS: 'focus',
    BLUR: 'blur',
    DRAG_START: 'drag-start',
    DRAG_END: 'drag-end',
    DRAG_ENTER: 'drag-enter',
    DRAG_LEAVE: 'drag-leave',
    DRAG_MOTION: 'drag-motion',
    DRAG_DATA_REQUEST: 'drag-data-request',
    DRAG_DROP: 'drag-drop',
});

/**
 * Event masks, which select the event signals a widget emits (see `Widget#events`).
 *
 * Propagating events come in pairs: the even bit selects the bubble phase, the odd bit right
 * above it the capture phase (signal `capture-<type>-event`), which runs from the outermost
 * widget inwards before the bubble phase.
 *
 * @enum {number}
 */
export const Events = Object.freeze({
    NONE: 0,

    MOTION: 1 << 0,
    SCROLL: 1 << 2,
    KEY_PRESS: 1 << 4,
    KEY_RELEASE: 1 << 6,
    BUTTON_PRESS: 1 << 8,
    BUTTON_RELEASE: 1 << 10,
    DRAG_START: 1 << 12,
    DRAG_MOTION: 1 << 14,
    DRAG_DROP: 1 << 16,

    DRAG_END: 1 << 18, // Only on the drag source; does not propagate.
    DRAG_DATA_REQUEST: 1 << 19, // Only on the drag source; does not propagate.
    DRAG_ENTER: 1 << 20, // Does not propagate.
    DRAG_LEAVE: 1 << 21, // Does not propagate.
    ENTER: 1 << 22, // Does not propagate.
    LEAVE: 1 << 23, // Does not propagate.
    FOCUS: 1 << 24, // Does not propagate.
    BLUR: 1 << 25, // Does not propagate.

    CAPTURE_MOTION: 1 << 1,
    CAPTURE_SCROLL: 1 << 3,
    CAPTURE_KEY_PRESS: 1 << 5,
    CAPTURE_KEY_RELEASE: 1 << 7,
    CAPTURE_BUTTON_PRESS: 1 << 9,
    CAPTURE_BUTTON_RELEASE: 1 << 11,
    CAPTURE_DRAG_START: 1 << 13,
    CAPTURE_DRAG_MOTION: 1 << 15,
    CAPTURE_DRAG_DROP: 1 << 17,

    CAPTURE_ALL: 0x2aaaa,
    ALL: 0x3ffffff,
});

/**
 * The mask bit of each event type.
 *
 * @type {Readonly<Record<string, number>>}
 */
export const EVENT_MASKS = Object.freeze({
    [EventType.MOTION]: Events.MOTION,
    [EventType.SCROLL]: Events.SCROLL,
    [EventType.ENTER]: Events.ENTER,
    [EventType.LEAVE]: Events.LEAVE,
    [EventType.KEY_PRESS]: Events.KEY_PRESS,
    [EventType.KEY_RELEASE]: Events.KEY_RELEASE,
    [EventType.BUTTON_PRESS]: Events.BUTTON_PRESS,
    [EventType.BUTTON_RELEASE]: Events.BUTTON_RELEASE,
    [EventType.FOCUS]: Events.FOCUS,
    [EventType.BLUR]: Events.BLUR,
    [EventType.DRAG_START]: Events.DRAG_START,
    [EventType.DRAG_END]: Events.DRAG_END,
    [EventType.DRAG_ENTER]: Events.DRAG_ENTER,
    [EventType.DRAG_LEAVE]: Events.DRAG_LEAVE,
    [EventType.DRAG_MOTION]: Events.DRAG_MOTION,
    [EventType.DRAG_DATA_REQUEST]: Events.DRAG_DATA_REQUEST,
    [EventType.DRAG_DROP]: Events.DRAG_DROP,
});

/**
 * Modifier masks: pressed pointer buttons and modifier keys.
 *
 * @enum {number}
 */
export const Modifiers = Object.freeze({
    NONE: 0,
    PRIMARY_BUTTON: 1 << 1,
    MIDDLE_BUTTON: 1 << 2,
    SECONDARY_BUTTON: 1 << 3,
    SHIFT: 1 << 6,
    CONTROL: 1 << 7,
    ALT: 1 << 8,
    SUPER: 1 << 9,
    BUTTONS: (1 << 1) | (1 << 2) | (1 << 3),
    ALL: ~0,
});

/**
 * Pointer buttons.
 *
 * @enum {number}
 */
export const MouseButton = Object.freeze({
    PRIMARY: 1, // Typically the left button.
    MIDDLE: 2,
    SECONDARY: 3, // Typically the right button.
});

/**
 * Keys, as `KeyboardEvent.key` values. Letter keys are lowercase; compare with
 * `KeyEvent#is()`, which ignores case.
 *
 * @enum {string}
 */
export const Key = Object.freeze({
    BACKSPACE: 'Backspace',
    TAB: 'Tab',
    ENTER: 'Enter',
    RETURN: 'Enter',
    SHIFT: 'Shift',
    CONTROL: 'Control',
    ALT: 'Alt',
    SUPER: 'Meta',
    PAUSE: 'Pause',
    CAPS_LOCK: 'CapsLock',
    ESCAPE: 'Escape',
    SPACE: ' ',
    PAGE_UP: 'PageUp',
    PAGE_DOWN: 'PageDown',
    END: 'End',
    HOME: 'Home',
    LEFT: 'ArrowLeft',
    UP: 'ArrowUp',
    RIGHT: 'ArrowRight',
    DOWN: 'ArrowDown',
    INSERT: 'Insert',
    DELETE: 'Delete',
    CONTEXT_MENU: 'ContextMenu',
    F1: 'F1',
    F2: 'F2',
    F3: 'F3',
    F4: 'F4',
    F5: 'F5',
    F6: 'F6',
    F7: 'F7',
    F8: 'F8',
    F9: 'F9',
    F10: 'F10',
    F11: 'F11',
    F12: 'F12',
    NUM_LOCK: 'NumLock',
    SCROLL_LOCK: 'ScrollLock',
    A: 'a',
    B: 'b',
    C: 'c',
    D: 'd',
    E: 'e',
    F: 'f',
    G: 'g',
    H: 'h',
    I: 'i',
    J: 'j',
    K: 'k',
    L: 'l',
    M: 'm',
    N: 'n',
    O: 'o',
    P: 'p',
    Q: 'q',
    R: 'r',
    S: 's',
    T: 't',
    U: 'u',
    V: 'v',
    W: 'w',
    X: 'x',
    Y: 'y',
    Z: 'z',
});
