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
export declare const EventType: Readonly<{
    MOTION: "motion";
    SCROLL: "scroll";
    ENTER: "enter";
    LEAVE: "leave";
    KEY_PRESS: "key-press";
    KEY_RELEASE: "key-release";
    BUTTON_PRESS: "button-press";
    BUTTON_RELEASE: "button-release";
    FOCUS: "focus";
    BLUR: "blur";
    DRAG_START: "drag-start";
    DRAG_END: "drag-end";
    DRAG_ENTER: "drag-enter";
    DRAG_LEAVE: "drag-leave";
    DRAG_MOTION: "drag-motion";
    DRAG_DATA_REQUEST: "drag-data-request";
    DRAG_DROP: "drag-drop";
}>;
/**
 * Event masks, which select the event signals a widget emits (see `Widget#events`).
 *
 * Propagating events come in pairs: the even bit selects the bubble phase, the odd bit right
 * above it the capture phase (signal `capture-<type>-event`), which runs from the outermost
 * widget inwards before the bubble phase.
 *
 * @enum {number}
 */
export declare const Events: Readonly<{
    NONE: 0;
    MOTION: number;
    SCROLL: number;
    KEY_PRESS: number;
    KEY_RELEASE: number;
    BUTTON_PRESS: number;
    BUTTON_RELEASE: number;
    DRAG_START: number;
    DRAG_MOTION: number;
    DRAG_DROP: number;
    DRAG_END: number;
    DRAG_DATA_REQUEST: number;
    DRAG_ENTER: number;
    DRAG_LEAVE: number;
    ENTER: number;
    LEAVE: number;
    FOCUS: number;
    BLUR: number;
    CAPTURE_MOTION: number;
    CAPTURE_SCROLL: number;
    CAPTURE_KEY_PRESS: number;
    CAPTURE_KEY_RELEASE: number;
    CAPTURE_BUTTON_PRESS: number;
    CAPTURE_BUTTON_RELEASE: number;
    CAPTURE_DRAG_START: number;
    CAPTURE_DRAG_MOTION: number;
    CAPTURE_DRAG_DROP: number;
    CAPTURE_ALL: 174762;
    ALL: 67108863;
}>;
/**
 * The mask bit of each event type.
 *
 * @type {Readonly<Record<string, number>>}
 */
export declare const EVENT_MASKS: Readonly<Record<string, number>>;
/**
 * Modifier masks: pressed pointer buttons and modifier keys.
 *
 * @enum {number}
 */
export declare const Modifiers: Readonly<{
    NONE: 0;
    PRIMARY_BUTTON: number;
    MIDDLE_BUTTON: number;
    SECONDARY_BUTTON: number;
    SHIFT: number;
    CONTROL: number;
    ALT: number;
    SUPER: number;
    BUTTONS: number;
    ALL: number;
}>;
/**
 * Pointer buttons.
 *
 * @enum {number}
 */
export declare const MouseButton: Readonly<{
    PRIMARY: 1;
    MIDDLE: 2;
    SECONDARY: 3;
}>;
/**
 * Keys, as `KeyboardEvent.key` values. Letter keys are lowercase; compare with
 * `KeyEvent#is()`, which ignores case.
 *
 * @enum {string}
 */
export declare const Key: Readonly<{
    BACKSPACE: "Backspace";
    TAB: "Tab";
    ENTER: "Enter";
    RETURN: "Enter";
    SHIFT: "Shift";
    CONTROL: "Control";
    ALT: "Alt";
    SUPER: "Meta";
    PAUSE: "Pause";
    CAPS_LOCK: "CapsLock";
    ESCAPE: "Escape";
    SPACE: " ";
    PAGE_UP: "PageUp";
    PAGE_DOWN: "PageDown";
    END: "End";
    HOME: "Home";
    LEFT: "ArrowLeft";
    UP: "ArrowUp";
    RIGHT: "ArrowRight";
    DOWN: "ArrowDown";
    INSERT: "Insert";
    DELETE: "Delete";
    CONTEXT_MENU: "ContextMenu";
    F1: "F1";
    F2: "F2";
    F3: "F3";
    F4: "F4";
    F5: "F5";
    F6: "F6";
    F7: "F7";
    F8: "F8";
    F9: "F9";
    F10: "F10";
    F11: "F11";
    F12: "F12";
    NUM_LOCK: "NumLock";
    SCROLL_LOCK: "ScrollLock";
    A: "a";
    B: "b";
    C: "c";
    D: "d";
    E: "e";
    F: "f";
    G: "g";
    H: "h";
    I: "i";
    J: "j";
    K: "k";
    L: "l";
    M: "m";
    N: "n";
    O: "o";
    P: "p";
    Q: "q";
    R: "r";
    S: "s";
    T: "t";
    U: "u";
    V: "v";
    W: "w";
    X: "x";
    Y: "y";
    Z: "z";
}>;
