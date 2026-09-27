/**
 * Toolkit event objects, which wrap DOM events and are passed to `<type>-event` signals.
 *
 * @module events/events
 */
/**
 * Determines the modifier mask of a DOM event.
 *
 * @param {Event} event
 * @returns {number}
 */
export declare function getModifiers(event: Event): number;
/**
 * Base class of all toolkit events.
 */
export declare class ToolkitEvent {
    /** @type {string} */
    type: string;
    /** @type {any} */
    source: any;
    /** @type {number} */
    modifiers: number;
    /** @type {Event | null} */
    nativeEvent: Event | null;
    /** @type {number} */
    timestamp: number;
    /**
     * @param {string} type One of {@link EventType}.
     * @param {object | null} source The widget the event is about.
     * @param {number} modifiers
     * @param {Event | null} [nativeEvent]
     */
    constructor(type: string, source: object | null, modifiers: number, nativeEvent?: Event | null);
    /**
     * Whether all given modifiers are active.
     *
     * @param {number} modifier One or more {@link Modifiers}.
     * @returns {boolean}
     */
    hasModifier(modifier: number): boolean;
    /**
     * Prevents the browser's default action of the underlying DOM event.
     */
    preventDefault(): void;
}
/**
 * An event with a pointer position. Coordinates are page coordinates, like the original toolkit;
 * `localX` and `localY` are relative to the source widget's element.
 */
export declare class PointerEvent extends ToolkitEvent {
    /** @type {number} */
    x: number;
    /** @type {number} */
    y: number;
    /** @type {string} */
    pointerType: string;
    /**
     * @param {string} type
     * @param {object | null} source
     * @param {number} modifiers
     * @param {number} x
     * @param {number} y
     * @param {Event | null} [nativeEvent]
     */
    constructor(type: string, source: object | null, modifiers: number, x: number, y: number, nativeEvent?: Event | null);
    /**
     * The position as `{x, y}`.
     *
     * @type {{x: number, y: number}}
     */
    get position(): {
        x: number;
        y: number;
    };
    /**
     * The x position relative to the source widget's element.
     *
     * @type {number}
     */
    get localX(): number;
    /**
     * The y position relative to the source widget's element.
     *
     * @type {number}
     */
    get localY(): number;
}
/**
 * Pointer motion.
 */
export declare class MotionEvent extends PointerEvent {
    constructor(source: any, modifiers: any, x: any, y: any, nativeEvent?: any);
}
/**
 * A scroll wheel event. `delta` is in lines and positive when scrolling up (or left), like the
 * original toolkit; `deltaX` and `deltaY` are the raw pixel deltas of the wheel event.
 */
export declare class ScrollEvent extends PointerEvent {
    /** @type {number} */
    delta: number;
    /** @type {number} */
    deltaX: number;
    /** @type {number} */
    deltaY: number;
    constructor(source: any, modifiers: any, x: any, y: any, delta: any, nativeEvent?: any);
}
/**
 * The pointer entered or left a widget. `related` is the widget on the other side, if any.
 */
export declare class CrossingEvent extends PointerEvent {
    /** @type {any} */
    related: any;
    constructor(source: any, modifiers: any, x: any, y: any, enter: any, related: any, nativeEvent?: any);
}
/**
 * A pointer button was pressed or released. `count` is 2 for a double press, 3 for a triple
 * press and so on (see `Application#multiplePressInterval`).
 */
export declare class ButtonEvent extends PointerEvent {
    /** @type {number} One of `MouseButton`. */
    button: number;
    /** @type {number} */
    count: number;
    constructor(source: any, modifiers: any, x: any, y: any, press: any, button: any, count?: number, nativeEvent?: any);
}
/**
 * A key was pressed or released.
 */
export declare class KeyEvent extends ToolkitEvent {
    /** @type {string} A `KeyboardEvent.key` value. */
    key: string;
    /** @type {string} */
    code: string;
    /** @type {boolean} */
    repeat: boolean;
    constructor(source: any, modifiers: any, press: any, key: any, nativeEvent?: any);
    /**
     * Whether this is the given key. Single characters compare case-insensitively.
     *
     * @param {string} key One of `Key`.
     * @returns {boolean}
     */
    is(key: string): boolean;
    /**
     * Whether the key produces a character.
     *
     * @type {boolean}
     */
    get isPrintable(): boolean;
}
/**
 * A widget gained or lost the keyboard focus. `related` is the widget on the other side.
 */
export declare class FocusChangeEvent extends ToolkitEvent {
    /** @type {any} */
    related: any;
    constructor(source: any, modifiers: any, focus: any, related: any, nativeEvent?: any);
}
/**
 * Base class of drag and drop events. `context` is the `DragContext` of the drag session.
 */
export declare class DragEvent extends PointerEvent {
    /** @type {any} */
    context: any;
    constructor(type: any, source: any, modifiers: any, x: any, y: any, context: any, nativeEvent?: any);
}
/**
 * A drag may start. Handle it (return `true`) and add data types to the context to start it.
 */
export declare class DragStartEvent extends DragEvent {
    constructor(source: any, modifiers: any, x: any, y: any, context: any, nativeEvent?: any);
}
/**
 * A drag session ended. Sent to the drag source only.
 */
export declare class DragEndEvent extends DragEvent {
    constructor(source: any, modifiers: any, x: any, y: any, context: any, nativeEvent?: any);
}
/**
 * The dragged item entered or left a droppable widget.
 */
export declare class DragCrossingEvent extends DragEvent {
    /** @type {any} */
    related: any;
    constructor(source: any, modifiers: any, x: any, y: any, enter: any, context: any, related?: any, nativeEvent?: any);
}
/**
 * The dragged item moved over a droppable widget.
 */
export declare class DragMotionEvent extends DragEvent {
    constructor(source: any, modifiers: any, x: any, y: any, context: any, nativeEvent?: any);
}
/**
 * The drop target asked for data of a type that the source announced but did not set yet.
 * Sent to the drag source, which should call `context.setData()`. `dataType` is the type.
 */
export declare class DragDataRequestEvent extends DragEvent {
    /** @type {string} */
    dataType: string;
    constructor(source: any, modifiers: any, x: any, y: any, context: any, dataType: any, nativeEvent?: any);
}
/**
 * The dragged item was dropped on a droppable widget. Handle it to accept the drop.
 */
export declare class DragDropEvent extends DragEvent {
    constructor(source: any, modifiers: any, x: any, y: any, context: any, nativeEvent?: any);
}
