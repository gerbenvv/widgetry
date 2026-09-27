/**
 * @module widgets/widget
 */
import { Instance } from '../core/instance.js';
/**
 * DOM listeners per event type: [bubble mask, capture mask, DOM event name, toolkit event type].
 *
 * @type {ReadonlyArray<[number, number, string, string]>}
 */
export declare const EVENT_BINDINGS: ReadonlyArray<[number, number, string, string]>;
/**
 * CSS self-alignment values of `Align` values.
 *
 * @type {Readonly<Record<string, string>>}
 */
export declare const SELF_ALIGNMENT: Readonly<Record<string, string>>;
/**
 * Updates all pending layouts right away, instead of at the end of the current task. Useful in
 * tests and before measuring elements.
 */
export declare function flushLayout(): void;
/**
 * Counts presses for double and triple presses. Call it once per press.
 *
 * @param {PointerEvent} event
 * @returns {number} 1 for a single press, 2 for a double press and so on.
 */
export declare function countPress(event: PointerEvent): number;
/**
 * Returns the count of the most recent press, for the matching release.
 *
 * @returns {number}
 */
export declare function getPressCount(): number;
/**
 * Converts a wheel event to lines, positive when scrolling up (or left).
 *
 * @param {WheelEvent} event
 * @returns {number}
 */
export declare function getScrollDelta(event: WheelEvent): number;
/**
 * Creates the toolkit event for a DOM event. The event is shared by all widgets the DOM event
 * passes. Crossing events are about `owner`; the other events have the innermost widget as their
 * source.
 *
 * @param {Event} nativeEvent
 * @param {string} type One of `EventType`.
 * @param {Widget | object | null} owner The widget (or application) handling the event.
 * @returns {import('../events/events.js').ToolkitEvent | null}
 */
export declare function createToolkitEvent(nativeEvent: Event, type: string, owner: Widget | object | null): import('../events/events.js').ToolkitEvent | null;
/**
 * The base class of all widgets.
 *
 * A widget owns one root element (`el`). Containers place their children's elements inside
 * their body element and lay them out with CSS grid or flexbox, following GTK's model: every
 * widget has a natural size, may be told to expand (`hExpand`, `vExpand`) and is aligned inside
 * the space it gets (`hAlign`, `vAlign`).
 *
 * Signals: `destroy`, `<property>-change`, `parent-change`, `size-allocate` (when the rendered
 * size changes; connecting starts observing), and the event signals selected by `events`:
 * `<type>-event` and `capture-<type>-event` (`widget, event`), plus the generic `event`.
 * A handler returning `true` handles the event and stops it from propagating further.
 */
export declare class Widget extends Instance {
    /**
     * The root element.
     *
     * @type {HTMLElement}
     */
    el: HTMLElement;
    _domListeners: Map<any, any>;
    _isHExpandCache: any;
    _isVExpandCache: any;
    _isSensitiveCache: any;
    _isVisibleCache: any;
    _sizeAllocateObserver: ResizeObserver;
    _tooltipHandlers: {
        enter: (event: any) => any;
        move: (event: any) => any;
        leave: () => any;
        down: () => any;
    };
    visible: boolean;
    events: number;
    _tooltip: any;
    _parent: Widget;
    _layoutStyles: Set<any>;
    _isFocus: any;
    _hasFocus: any;
    _showTooltip: boolean;
    _initialize(): void;
    /**
     * Creates the root element. Subclasses must implement this. It runs first during
     * initialization, so it should also store references to sub-elements that getters like
     * `focusElement` need.
     *
     * @protected
     * @returns {HTMLElement}
     */
    protected _render(): HTMLElement;
    /**
     * The element that receives the keyboard focus. Defaults to the root element.
     *
     * @type {HTMLElement}
     */
    get focusElement(): HTMLElement;
    /**
     * The rendered position and size relative to the viewport, or zero if not rendered.
     *
     * @type {{x: number, y: number, width: number, height: number}}
     */
    get allocation(): {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    /**
     * Finds the widget an element belongs to: the nearest ancestor that is a widget's root.
     *
     * @param {Node | null} node
     * @returns {Widget | null}
     */
    static fromElement(node: Node | null): Widget | null;
    /**
     * Whether `widget` is this widget or one of its descendants.
     *
     * @param {Widget | null} widget
     * @returns {boolean}
     */
    isAncestorOf(widget: Widget | null): boolean;
    /**
     * Shows the widget. The same as setting `visible` to `true`.
     */
    show(): void;
    /**
     * Hides the widget. The same as setting `visible` to `false`.
     */
    hide(): void;
    /**
     * Adds a CSS class to the root element.
     *
     * @param {string} className
     */
    addStyleClass(className: string): void;
    /**
     * Removes a CSS class from the root element.
     *
     * @param {string} className
     */
    removeStyleClass(className: string): void;
    /**
     * Whether the root element has a CSS class.
     *
     * @param {string} className
     * @returns {boolean}
     */
    hasStyleClass(className: string): boolean;
    /**
     * Enables event signals. The same as `widget.events |= events`.
     *
     * @param {number} events One or more `Events`.
     */
    enableEvents(events: number): void;
    /**
     * Disables event signals. The same as `widget.events &= ~events`.
     *
     * @param {number} events One or more `Events`.
     */
    disableEvents(events: number): void;
    /**
     * Gives this widget the keyboard focus. If its window is not active, the widget gets the focus
     * when the window becomes active.
     *
     * @returns {boolean} Whether the widget is now the focus widget of its window.
     */
    focus(): boolean;
    /**
     * Removes the keyboard focus from this widget. Its window keeps no focus widget.
     */
    blur(): void;
    /**
     * Connects to a signal. Connecting to `size-allocate` starts observing the rendered size.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     * @returns {() => void}
     */
    connect(name: string, method: Function, context?: object): () => void;
    /**
     * Destroys the widget: removes it from its parent, destroys its tooltip and removes its
     * element.
     */
    destroy(): void;
    /**
     * Sets the parent. Called by containers.
     *
     * @protected
     * @param {Widget | null} parent
     */
    protected _setParent(parent: Widget | null): void;
    _containsFocusWidget(): boolean;
    /**
     * Queues a layout update, which runs `_updateLayout()` at the end of the current task.
     *
     * @protected
     */
    protected _queueLayout(): void;
    /**
     * Updates the layout of this widget's children. Containers override this.
     *
     * @protected
     */
    protected _updateLayout(): void;
    /**
     * Applies the layout properties (alignment, margins and size request) to the root element.
     *
     * @protected
     */
    protected _applyLayoutStyle(): void;
    /**
     * Sets an inline style for layout. Only styles set this way are ever cleared again, so styles
     * that a widget or its stylesheet sets itself are kept when a layout property has its default.
     *
     * @protected
     * @param {string} name A camelCase CSS property name.
     * @param {string} value The value, or `''` for the default.
     */
    protected _setLayoutStyle(name: string, value: string): void;
    /**
     * Computes whether the widget expands in one direction. Containers also consider their
     * children.
     *
     * @protected
     * @param {'h' | 'v'} _direction
     * @returns {boolean}
     */
    protected _computeExpand(_direction: 'h' | 'v'): boolean;
    /**
     * Recomputes the effective expand flags and propagates changes to the parent.
     *
     * @protected
     */
    protected _refreshExpand(): void;
    _recalculateVisibility(): void;
    /**
     * Whether a top-level widget is actually on screen. Overridden by windows.
     *
     * @protected
     * @returns {boolean}
     */
    protected _isShown(): boolean;
    /**
     * Called when the effective visibility changed. Containers propagate it to their children.
     *
     * @protected
     * @param {boolean} isVisible
     */
    protected _onIsVisibleChange(isVisible: boolean): void;
    _recalculateSensitivity(): void;
    /**
     * Called when the effective sensitivity changed. Containers propagate it to their children.
     *
     * @protected
     * @param {boolean} isSensitive
     */
    protected _onIsSensitiveChange(isSensitive: boolean): void;
    /**
     * Updates the tab index of the focus element from `canFocus` and the sensitivity.
     *
     * @protected
     */
    protected _updateTabIndex(): void;
    /**
     * Updates the focus state flags. Called by the window.
     *
     * @protected
     * @param {boolean} isFocus
     * @param {boolean} hasFocus
     */
    protected _setFocusState(isFocus: boolean, hasFocus: boolean): void;
    _onFocusElementFocus(nativeEvent: any, focus: any): void;
    /**
     * Emits the signals for a toolkit event.
     *
     * @protected
     * @param {import('../events/events.js').ToolkitEvent} event
     * @param {boolean} capture Whether this is the capture phase.
     * @returns {boolean} Whether a handler handled the event.
     */
    protected _dispatchEvent(event: import('../events/events.js').ToolkitEvent, capture: boolean): boolean;
    _syncEventListeners(): void;
    _onDomEvent(nativeEvent: any, type: any, capture: any): void;
    _createEvent(nativeEvent: any, type: any): import("../index.js").ToolkitEvent;
    _observeSize(): void;
    _createTooltip(properties: any): any;
    _onTooltipDestroy(): void;
    _syncTooltipHandlers(): void;
    /**
     * Called by the container when the widget was placed in it. Applies the layout style.
     *
     * @protected
     */
    protected _onParented(): void;
}
/**
 * Converts a margin object to a CSS `margin` value.
 *
 * @param {{top: number, right: number, bottom: number, left: number}} margin
 * @returns {string}
 */
export declare function marginToCss(margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
}): string;

/** The declared properties of {@link Widget}. */
export interface Widget {
    /**
     * Whether the widget is effectively visible: it is `visible` and so are its ancestors.
     */
    readonly isVisible: any;
    /**
     * Whether this is a top-level widget (a window), which cannot be put in a container.
     */
    readonly isTopLevel: any;
    /**
     * The window the widget is in (the widget itself for windows), or `null`.
     */
    readonly window: any;
    /**
     * Whether this widget is a window.
     */
    readonly isWindow: any;
    /**
     * The parent container, or `null`.
     */
    readonly parent: any;
    /**
     * A name for finding the widget, also set as the `data-name` attribute.
     */
    name: string;
    /**
     * The requested width in pixels, or -1 for the natural width. When the widget fills its space
     * horizontally, this is its minimum width.
     */
    width: number;
    /**
     * The requested height in pixels, or -1 for the natural height. When the widget fills its space
     * vertically, this is its minimum height.
     */
    height: number;
    /**
     * The margin around the widget. Set a number for all sides, or an object with `top`, `right`,
     * `bottom` and `left`. Reading returns the object.
     */
    margin: any;
    marginTop: any;
    marginRight: any;
    marginBottom: any;
    marginLeft: any;
    /**
     * How the widget uses horizontal space: one of `Align`.
     */
    hAlign: any;
    /**
     * How the widget uses vertical space: one of `Align`.
     */
    vAlign: any;
    /**
     * Whether the widget takes extra horizontal space. `null` (the default) inherits it from the
     * children: a container expands when one of its children does.
     */
    hExpand: any;
    /**
     * Whether the widget takes extra vertical space. `null` inherits it from the children.
     */
    vExpand: any;
    /**
     * Whether the widget effectively expands horizontally.
     */
    readonly isHExpand: any;
    /**
     * Whether the widget effectively expands vertically.
     */
    readonly isVExpand: any;
    /**
     * Whether the user can interact with the widget. Insensitive widgets are grayed out.
     */
    sensitive: boolean;
    /**
     * Whether the widget is effectively sensitive: it is `sensitive` and so are its ancestors.
     */
    readonly isSensitive: any;
    /**
     * Whether the widget can take the keyboard focus.
     */
    canFocus: boolean;
    /**
     * Whether the widget is the focus widget of its window. Setting it focuses or blurs it.
     */
    isFocus: boolean;
    /**
     * Whether the widget has the keyboard focus: it `isFocus` and its window is active.
     */
    hasFocus: boolean;
    /**
     * Whether the tooltip is shown when hovering. Setting `tooltipLabel` turns this on.
     */
    showTooltip: boolean;
    /**
     * The text of the tooltip, or `null` for none.
     */
    tooltipLabel: any;
    /**
     * The `Tooltip` of the widget, or `null`.
     */
    tooltip: any;
    /**
     * Whether drags can start on this widget (see the drag events).
     */
    draggable: boolean;
    /**
     * Whether things can be dropped on this widget (see the drag events).
     */
    droppable: boolean;
}
