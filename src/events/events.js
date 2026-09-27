/**
 * Toolkit event objects, which wrap DOM events and are passed to `<type>-event` signals.
 *
 * @module events/events
 */

import { EventType, Modifiers } from './constants.js';

/**
 * Determines the modifier mask of a DOM event.
 *
 * @param {Event} event
 * @returns {number}
 */
export function getModifiers(event) {
    let modifiers = Modifiers.NONE;

    if (event.shiftKey) {
        modifiers |= Modifiers.SHIFT;
    }

    if (event.ctrlKey) {
        modifiers |= Modifiers.CONTROL;
    }

    if (event.altKey) {
        modifiers |= Modifiers.ALT;
    }

    if (event.metaKey) {
        modifiers |= Modifiers.SUPER;
    }

    // Pressed buttons (DOM: 1 primary, 2 secondary, 4 middle).
    const buttons = event.buttons || 0;
    if (buttons & 1) {
        modifiers |= Modifiers.PRIMARY_BUTTON;
    }

    if (buttons & 2) {
        modifiers |= Modifiers.SECONDARY_BUTTON;
    }

    if (buttons & 4) {
        modifiers |= Modifiers.MIDDLE_BUTTON;
    }

    return modifiers;
}

/**
 * Base class of all toolkit events.
 */
export class ToolkitEvent {
    /**
     * @param {string} type One of {@link EventType}.
     * @param {object | null} source The widget the event is about.
     * @param {number} modifiers
     * @param {Event | null} [nativeEvent]
     */
    constructor(type, source, modifiers, nativeEvent = null) {
        /** @type {string} */
        this.type = type;

        /** @type {any} */
        this.source = source;

        /** @type {number} */
        this.modifiers = modifiers;

        /** @type {Event | null} */
        this.nativeEvent = nativeEvent;

        /** @type {number} */
        this.timestamp = Date.now();
    }

    /**
     * Whether all given modifiers are active.
     *
     * @param {number} modifier One or more {@link Modifiers}.
     * @returns {boolean}
     */
    hasModifier(modifier) {
        return (this.modifiers & modifier) === modifier;
    }

    /**
     * Prevents the browser's default action of the underlying DOM event.
     */
    preventDefault() {
        this.nativeEvent?.preventDefault();
    }
}

/**
 * An event with a pointer position. Coordinates are page coordinates, like the original toolkit;
 * `localX` and `localY` are relative to the source widget's element.
 */
export class PointerEvent extends ToolkitEvent {
    /**
     * @param {string} type
     * @param {object | null} source
     * @param {number} modifiers
     * @param {number} x
     * @param {number} y
     * @param {Event | null} [nativeEvent]
     */
    constructor(type, source, modifiers, x, y, nativeEvent = null) {
        super(type, source, modifiers, nativeEvent);

        /** @type {number} */
        this.x = x;

        /** @type {number} */
        this.y = y;

        /** @type {string} */
        this.pointerType = nativeEvent?.pointerType || 'mouse';
    }

    /**
     * The position as `{x, y}`.
     *
     * @type {{x: number, y: number}}
     */
    get position() {
        return { x: this.x, y: this.y };
    }

    /**
     * The x position relative to the source widget's element.
     *
     * @type {number}
     */
    get localX() {
        const rect = this.source?.el?.getBoundingClientRect();

        return rect ? this.x - window.scrollX - rect.left : this.x;
    }

    /**
     * The y position relative to the source widget's element.
     *
     * @type {number}
     */
    get localY() {
        const rect = this.source?.el?.getBoundingClientRect();

        return rect ? this.y - window.scrollY - rect.top : this.y;
    }
}

/**
 * Pointer motion.
 */
export class MotionEvent extends PointerEvent {
    constructor(source, modifiers, x, y, nativeEvent = null) {
        super(EventType.MOTION, source, modifiers, x, y, nativeEvent);
    }
}

/**
 * A scroll wheel event. `delta` is in lines and positive when scrolling up (or left), like the
 * original toolkit; `deltaX` and `deltaY` are the raw pixel deltas of the wheel event.
 */
export class ScrollEvent extends PointerEvent {
    constructor(source, modifiers, x, y, delta, nativeEvent = null) {
        super(EventType.SCROLL, source, modifiers, x, y, nativeEvent);

        /** @type {number} */
        this.delta = delta;

        /** @type {number} */
        this.deltaX = nativeEvent?.deltaX || 0;

        /** @type {number} */
        this.deltaY = nativeEvent?.deltaY || 0;
    }
}

/**
 * The pointer entered or left a widget. `related` is the widget on the other side, if any.
 */
export class CrossingEvent extends PointerEvent {
    constructor(source, modifiers, x, y, enter, related, nativeEvent = null) {
        super(enter ? EventType.ENTER : EventType.LEAVE, source, modifiers, x, y, nativeEvent);

        /** @type {any} */
        this.related = related;
    }
}

/**
 * A pointer button was pressed or released. `count` is 2 for a double press, 3 for a triple
 * press and so on (see `Application#multiplePressInterval`).
 */
export class ButtonEvent extends PointerEvent {
    constructor(source, modifiers, x, y, press, button, count = 1, nativeEvent = null) {
        super(
            press ? EventType.BUTTON_PRESS : EventType.BUTTON_RELEASE,
            source,
            modifiers,
            x,
            y,
            nativeEvent
        );

        /** @type {number} One of `MouseButton`. */
        this.button = button;

        /** @type {number} */
        this.count = count;
    }
}

/**
 * A key was pressed or released.
 */
export class KeyEvent extends ToolkitEvent {
    constructor(source, modifiers, press, key, nativeEvent = null) {
        super(press ? EventType.KEY_PRESS : EventType.KEY_RELEASE, source, modifiers, nativeEvent);

        /** @type {string} A `KeyboardEvent.key` value. */
        this.key = key;

        /** @type {string} */
        this.code = nativeEvent?.code || '';

        /** @type {boolean} */
        this.repeat = Boolean(nativeEvent?.repeat);
    }

    /**
     * Whether this is the given key. Single characters compare case-insensitively.
     *
     * @param {string} key One of `Key`.
     * @returns {boolean}
     */
    is(key) {
        if (key.length === 1 && this.key.length === 1) {
            return key.toLowerCase() === this.key.toLowerCase();
        }

        return key === this.key;
    }

    /**
     * Whether the key produces a character.
     *
     * @type {boolean}
     */
    get isPrintable() {
        return this.key.length === 1;
    }
}

/**
 * A widget gained or lost the keyboard focus. `related` is the widget on the other side.
 */
export class FocusChangeEvent extends ToolkitEvent {
    constructor(source, modifiers, focus, related, nativeEvent = null) {
        super(focus ? EventType.FOCUS : EventType.BLUR, source, modifiers, nativeEvent);

        /** @type {any} */
        this.related = related;
    }
}

/**
 * Base class of drag and drop events. `context` is the `DragContext` of the drag session.
 */
export class DragEvent extends PointerEvent {
    constructor(type, source, modifiers, x, y, context, nativeEvent = null) {
        super(type, source, modifiers, x, y, nativeEvent);

        /** @type {any} */
        this.context = context;
    }
}

/**
 * A drag may start. Handle it (return `true`) and add data types to the context to start it.
 */
export class DragStartEvent extends DragEvent {
    constructor(source, modifiers, x, y, context, nativeEvent = null) {
        super(EventType.DRAG_START, source, modifiers, x, y, context, nativeEvent);
    }
}

/**
 * A drag session ended. Sent to the drag source only.
 */
export class DragEndEvent extends DragEvent {
    constructor(source, modifiers, x, y, context, nativeEvent = null) {
        super(EventType.DRAG_END, source, modifiers, x, y, context, nativeEvent);
    }
}

/**
 * The dragged item entered or left a droppable widget.
 */
export class DragCrossingEvent extends DragEvent {
    constructor(source, modifiers, x, y, enter, context, related = null, nativeEvent = null) {
        super(
            enter ? EventType.DRAG_ENTER : EventType.DRAG_LEAVE,
            source,
            modifiers,
            x,
            y,
            context,
            nativeEvent
        );

        /** @type {any} */
        this.related = related;
    }
}

/**
 * The dragged item moved over a droppable widget.
 */
export class DragMotionEvent extends DragEvent {
    constructor(source, modifiers, x, y, context, nativeEvent = null) {
        super(EventType.DRAG_MOTION, source, modifiers, x, y, context, nativeEvent);
    }
}

/**
 * The drop target asked for data of a type that the source announced but did not set yet.
 * Sent to the drag source, which should call `context.setData()`. `dataType` is the type.
 */
export class DragDataRequestEvent extends DragEvent {
    constructor(source, modifiers, x, y, context, dataType, nativeEvent = null) {
        super(EventType.DRAG_DATA_REQUEST, source, modifiers, x, y, context, nativeEvent);

        /** @type {string} */
        this.dataType = dataType;
    }
}

/**
 * The dragged item was dropped on a droppable widget. Handle it to accept the drop.
 */
export class DragDropEvent extends DragEvent {
    constructor(source, modifiers, x, y, context, nativeEvent = null) {
        super(EventType.DRAG_DROP, source, modifiers, x, y, context, nativeEvent);
    }
}
