/**
 * @module widgets/widget
 */

import { Align } from '../core/enums.js';
import { defineProperties, Instance } from '../core/instance.js';
import { getType } from '../core/registry.js';
import { settings } from '../core/settings.js';
import { EventType, Events, MouseButton } from '../events/constants.js';
import {
    ButtonEvent,
    CrossingEvent,
    FocusChangeEvent,
    getModifiers,
    KeyEvent,
    MotionEvent,
    ScrollEvent,
} from '../events/events.js';
import { bindToolkitText, translateLabels } from '../i18n/toolkit-text.js';
import { MULTIPLE_PRESS_DISTANCE } from './double-press.js';

/**
 * Maps elements to the widget they are the root element of.
 *
 * @type {WeakMap<Element, Widget>}
 */
const WIDGET_BY_ELEMENT = new WeakMap();

/**
 * Widgets whose layout must be updated at the end of the current task.
 *
 * @type {Set<Widget>}
 */
const LAYOUT_QUEUE = new Set();

/**
 * DOM listeners per event type: [bubble mask, capture mask, DOM event name, toolkit event type].
 *
 * @type {ReadonlyArray<[number, number, string, string]>}
 */
export const EVENT_BINDINGS = [
    [Events.MOTION, Events.CAPTURE_MOTION, 'pointermove', EventType.MOTION],
    [Events.SCROLL, Events.CAPTURE_SCROLL, 'wheel', EventType.SCROLL],
    [Events.KEY_PRESS, Events.CAPTURE_KEY_PRESS, 'keydown', EventType.KEY_PRESS],
    [Events.KEY_RELEASE, Events.CAPTURE_KEY_RELEASE, 'keyup', EventType.KEY_RELEASE],
    [Events.BUTTON_PRESS, Events.CAPTURE_BUTTON_PRESS, 'pointerdown', EventType.BUTTON_PRESS],
    [Events.BUTTON_RELEASE, Events.CAPTURE_BUTTON_RELEASE, 'pointerup', EventType.BUTTON_RELEASE],
    [Events.ENTER, 0, 'pointerenter', EventType.ENTER],
    [Events.LEAVE, 0, 'pointerleave', EventType.LEAVE],
];

/**
 * Pointer masks that make a widget grab the pointer while a button is pressed on it.
 *
 * @type {number}
 */
const GRAB_MASK =
    Events.MOTION | Events.CAPTURE_MOTION | Events.BUTTON_RELEASE | Events.CAPTURE_BUTTON_RELEASE;

/**
 * CSS self-alignment values of `Align` values.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const SELF_ALIGNMENT = {
    [Align.FILL]: 'stretch',
    [Align.START]: 'start',
    [Align.CENTER]: 'center',
    [Align.END]: 'end',
};

/** @type {Readonly<Record<string, number>>} */
const DOM_TO_TOOLKIT_BUTTON = {
    0: MouseButton.PRIMARY,
    1: MouseButton.MIDDLE,
    2: MouseButton.SECONDARY,
};

// State for counting multiple presses (double click and so on).
const pressState = { time: 0, button: 0, x: 0, y: 0, count: 0 };

/**
 * The counts of the presses counted so far, so that every press is counted once.
 *
 * @type {WeakMap<Event, number>}
 */
const PRESS_COUNTS = new WeakMap();

/**
 * Longhand properties of the shorthands used for layout.
 *
 * @type {Readonly<Record<string, string[]>>}
 */
const LONGHANDS = Object.freeze({
    margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
    flex: ['flexGrow', 'flexShrink', 'flexBasis'],
});

/**
 * The maximum number of layout passes in one flush.
 *
 * @type {number}
 */
const MAX_LAYOUT_PASSES = 100;

let layoutScheduled = false;

function flushLayoutQueue() {
    layoutScheduled = false;

    // Updating one layout may queue others; keep going until the queue is empty, but stop
    // layouts that keep queueing each other.
    for (let pass = 0; LAYOUT_QUEUE.size; ++pass) {
        if (pass >= MAX_LAYOUT_PASSES) {
            console.warn('Widgetry: layouts keep queueing each other; giving up.', [
                ...LAYOUT_QUEUE,
            ]);
            LAYOUT_QUEUE.clear();
            break;
        }

        const widgets = [...LAYOUT_QUEUE];
        LAYOUT_QUEUE.clear();

        for (const widget of widgets) {
            if (widget.destroyed) {
                continue;
            }

            // A failing layout must not stop the others; report its error like an uncaught one.
            try {
                widget._updateLayout();
            } catch (error) {
                reportError(error);
            }
        }
    }
}

/**
 * Updates all pending layouts right away, instead of at the end of the current task. Useful in
 * tests and before measuring elements.
 */
export function flushLayout() {
    flushLayoutQueue();
}

/**
 * Counts presses for double and triple presses. Calling it again for the same event (e.g. from
 * both a widget and a sprite) returns the same count.
 *
 * @param {PointerEvent} event
 * @returns {number} 1 for a single press, 2 for a double press and so on.
 */
export function countPress(event) {
    if (PRESS_COUNTS.has(event)) {
        return PRESS_COUNTS.get(event);
    }

    const now = event.timeStamp || performance.now();
    const distance = Math.hypot(event.pageX - pressState.x, event.pageY - pressState.y);

    if (
        event.button === pressState.button &&
        now - pressState.time <= settings.multiplePressInterval &&
        distance <= MULTIPLE_PRESS_DISTANCE
    ) {
        pressState.count += 1;
    } else {
        pressState.count = 1;
    }

    Object.assign(pressState, { time: now, button: event.button, x: event.pageX, y: event.pageY });
    PRESS_COUNTS.set(event, pressState.count);

    return pressState.count;
}

/**
 * Returns the count of the most recent press, for the matching release.
 *
 * @returns {number}
 */
export function getPressCount() {
    return pressState.count;
}

/**
 * Converts a wheel event to lines, positive when scrolling up (or left).
 *
 * @param {WheelEvent} event
 * @returns {number}
 */
export function getScrollDelta(event) {
    // Lines, positive when scrolling up. A typical wheel notch is three lines.
    let lines = event.deltaY || event.deltaX;
    if (event.deltaMode === 0) {
        lines /= 33.3;
    } else if (event.deltaMode === 2) {
        lines *= 20;
    }

    return -lines;
}

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
export function createToolkitEvent(nativeEvent, type, owner) {
    // Share one toolkit event between all widgets the DOM event passes.
    const cacheKey = `wyEvent_${type}`;
    if (nativeEvent[cacheKey] && type !== EventType.ENTER && type !== EventType.LEAVE) {
        return nativeEvent[cacheKey];
    }

    const source = Widget.fromElement(nativeEvent.target) || owner;
    const modifiers = getModifiers(nativeEvent);
    const x = nativeEvent.pageX ?? 0;
    const y = nativeEvent.pageY ?? 0;

    let event = null;
    switch (type) {
        case EventType.MOTION:
            event = new MotionEvent(source, modifiers, x, y, nativeEvent);
            break;

        case EventType.SCROLL:
            event = new ScrollEvent(
                source,
                modifiers,
                x,
                y,
                getScrollDelta(nativeEvent),
                nativeEvent
            );
            break;

        case EventType.BUTTON_PRESS:
        case EventType.BUTTON_RELEASE: {
            const press = type === EventType.BUTTON_PRESS;
            if (press && nativeEvent.wyPressCount === undefined) {
                nativeEvent.wyPressCount = countPress(nativeEvent);
            }

            const button = DOM_TO_TOOLKIT_BUTTON[nativeEvent.button] || MouseButton.PRIMARY;
            const count = press ? nativeEvent.wyPressCount : pressState.count;
            event = new ButtonEvent(source, modifiers, x, y, press, button, count, nativeEvent);
            break;
        }

        case EventType.KEY_PRESS:
        case EventType.KEY_RELEASE:
            event = new KeyEvent(
                source,
                modifiers,
                type === EventType.KEY_PRESS,
                nativeEvent.key,
                nativeEvent
            );
            break;

        case EventType.ENTER:
        case EventType.LEAVE: {
            // Crossing events are about this widget.
            const related = Widget.fromElement(nativeEvent.relatedTarget);
            return new CrossingEvent(
                owner,
                modifiers,
                x,
                y,
                type === EventType.ENTER,
                related,
                nativeEvent
            );
        }
    }

    nativeEvent[cacheKey] = event;

    return event;
}

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
export class Widget extends Instance {
    _initialize() {
        super._initialize();

        /**
         * The root element.
         *
         * @type {HTMLElement}
         */
        this.el = this._render();
        this.el.classList.add('wy-widget');
        this.el.hidden = !this._visible;

        WIDGET_BY_ELEMENT.set(this.el, this);

        // Attached DOM listeners, by DOM event name and phase.
        this._domListeners = new Map();

        this._isHExpandCache = false;
        this._isVExpandCache = false;
        this._isSensitiveCache = this.isTopLevel;
        this._isVisibleCache = this.isTopLevel && this._visible;
        this._sizeAllocateObserver = null;
        this._tooltipHandlers = null;

        this.el.classList.toggle('wy-insensitive', !this._isSensitiveCache);

        this.el.addEventListener('focus', (event) => this._onFocusElementFocus(event, true), true);
        this.el.addEventListener('blur', (event) => this._onFocusElementFocus(event, false), true);

        this._updateTabIndex();

        // Apply the default expand flags, which subclasses may override.
        this._refreshExpand();

        // Keep the toolkit's own accessible names (marked with `data-wy-label`) translated.
        if (this.el.matches('[data-wy-label]') || this.el.querySelector('[data-wy-label]')) {
            bindToolkitText(this, () => translateLabels(this.el));
        }
    }

    /**
     * Creates the root element. Subclasses must implement this. It runs first during
     * initialization, so it should also store references to sub-elements that getters like
     * `focusElement` need.
     *
     * @protected
     * @returns {HTMLElement}
     */
    _render() {
        throw new Error(`${this.constructor.name} must implement _render().`);
    }

    /**
     * The element that receives the keyboard focus. Defaults to the root element.
     *
     * @type {HTMLElement}
     */
    get focusElement() {
        return this.el;
    }

    /**
     * Returns the elements that get the `aria-label` of `accessibleName`: the focus element, which
     * is the root element for widgets without a focus element of their own. Override to name other
     * elements.
     *
     * @protected
     * @returns {Element[]}
     */
    _getAccessibleNameElements() {
        return [this.focusElement];
    }

    /**
     * Puts `accessibleName` in the `aria-label` of the elements of
     * `_getAccessibleNameElements()`, or removes it. Widgets that compute their own `aria-label`
     * override this to combine the two.
     *
     * @protected
     */
    _syncAccessibleName() {
        const name = this._accessibleName;

        for (const element of this._getAccessibleNameElements()) {
            if (name) {
                // `aria-labelledby` takes precedence over `aria-label`, so set it aside.
                if (element.hasAttribute('aria-labelledby')) {
                    element.dataset.wyLabelledby = element.getAttribute('aria-labelledby');
                    element.removeAttribute('aria-labelledby');
                }

                element.setAttribute('aria-label', name);
            } else {
                element.removeAttribute('aria-label');

                if (element.dataset.wyLabelledby) {
                    element.setAttribute('aria-labelledby', element.dataset.wyLabelledby);
                    delete element.dataset.wyLabelledby;
                }
            }
        }
    }

    /**
     * The rendered position and size relative to the viewport, or zero if not rendered.
     *
     * @type {{x: number, y: number, width: number, height: number}}
     */
    get allocation() {
        const rect = this.el.getBoundingClientRect();

        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    }

    /**
     * Finds the widget an element belongs to: the nearest ancestor that is a widget's root.
     *
     * @param {Node | null} node
     * @returns {Widget | null}
     */
    static fromElement(node) {
        while (node) {
            const widget = WIDGET_BY_ELEMENT.get(/** @type {Element} */ (node));
            if (widget) {
                return widget;
            }

            node = node.parentNode || node.host || null;
        }

        return null;
    }

    /**
     * Whether `widget` is this widget or one of its descendants.
     *
     * @param {Widget | null} widget
     * @returns {boolean}
     */
    isAncestorOf(widget) {
        while (widget) {
            if (widget === this) {
                return true;
            }

            widget = widget.parent;
        }

        return false;
    }

    /**
     * Shows the widget. The same as setting `visible` to `true`.
     */
    show() {
        this.visible = true;
    }

    /**
     * Hides the widget. The same as setting `visible` to `false`.
     */
    hide() {
        this.visible = false;
    }

    /**
     * Adds a CSS class to the root element.
     *
     * @param {string} className
     */
    addStyleClass(className) {
        this.el.classList.add(className);
    }

    /**
     * Removes a CSS class from the root element.
     *
     * @param {string} className
     */
    removeStyleClass(className) {
        this.el.classList.remove(className);
    }

    /**
     * Whether the root element has a CSS class.
     *
     * @param {string} className
     * @returns {boolean}
     */
    hasStyleClass(className) {
        return this.el.classList.contains(className);
    }

    /**
     * Enables event signals. The same as `widget.events |= events`.
     *
     * @param {number} events One or more `Events`.
     */
    enableEvents(events) {
        this.events = this._events | events;
    }

    /**
     * Disables event signals. The same as `widget.events &= ~events`.
     *
     * @param {number} events One or more `Events`.
     */
    disableEvents(events) {
        this.events = this._events & ~events;
    }

    /**
     * Gives this widget the keyboard focus. If its window is not active, the widget gets the focus
     * when the window becomes active.
     *
     * @returns {boolean} Whether the widget is now the focus widget of its window.
     */
    focus() {
        if (!this.canFocus || !this.isSensitive || !this.isVisible) {
            return false;
        }

        const window = this.window;
        if (!window) {
            return false;
        }

        if (window.active) {
            this.focusElement.focus({ preventScroll: false });

            // The element may already have had the DOM focus (so no focus event fired) without
            // being the window's focus widget.
            if (document.activeElement === this.focusElement && window.focusWidget !== this) {
                window._setFocusWidget(this);
            }

            return document.activeElement === this.focusElement || this.isFocus;
        }

        window._setFocusWidget(this);

        return true;
    }

    /**
     * Removes the keyboard focus from this widget. Its window keeps no focus widget, but keeps the
     * keyboard focus itself if it is active.
     */
    blur() {
        if (!this.isFocus) {
            return;
        }

        const window = this.window;
        const hadDomFocus = this.focusElement.contains(document.activeElement);

        window?._setFocusWidget(null);

        if (hadDomFocus) {
            if (window?.active) {
                window.el.tabIndex = -1;
                window.el.focus({ preventScroll: true });
            } else {
                this.focusElement.blur();
            }
        }
    }

    /**
     * Connects to a signal. Connecting to `size-allocate` starts observing the rendered size.
     *
     * @param {string} name
     * @param {Function} method
     * @param {object} [context]
     * @returns {() => void}
     */
    connect(name, method, context) {
        if (name === 'size-allocate') {
            this._observeSize();
        }

        return super.connect(name, method, context);
    }

    /**
     * Destroys the widget: removes it from its parent, destroys its tooltip and removes its
     * element.
     */
    destroy() {
        if (this.isFocus) {
            this.window?._onFocusWidgetGone(this);
        }

        super.destroy();

        if (this._parent?.removeChild && this._parent.children?.includes(this)) {
            this._parent.removeChild(this);
        } else if (this._parent) {
            this._setParent(null);
        }

        this._tooltip?.destroy();
        this._tooltip = null;

        this._sizeAllocateObserver?.disconnect();

        LAYOUT_QUEUE.delete(this);

        this.el.remove();
    }

    /**
     * Sets the parent. Called by containers.
     *
     * @protected
     * @param {Widget | null} parent
     */
    _setParent(parent) {
        if (parent) {
            if (parent === this) {
                throw new Error('A widget cannot be added to itself.');
            }

            if (this._parent) {
                throw new Error('The widget has already been added to a container.');
            }

            if (this.isTopLevel) {
                throw new Error('A top-level widget cannot be added to a container.');
            }

            if (this.isAncestorOf(parent)) {
                throw new Error('A widget cannot be added to one of its descendants.');
            }
        }

        // Move the focus away first; this needs the window, so do it before unparenting.
        if (!parent && this.window && this._containsFocusWidget()) {
            this.window._onFocusWidgetGone(this);
        }

        const oldParent = this._parent;
        this._parent = parent;

        // Drop the layout styles of the old container, keeping the widget's own.
        if (!parent && oldParent) {
            this._clearLayoutStyles();
            this._applyLayoutStyle();
        }

        this._recalculateVisibility();
        this._recalculateSensitivity();

        this.emit('parent-change', this);
    }

    _containsFocusWidget() {
        const focusWidget = this.window?.focusWidget;

        return Boolean(focusWidget && this.isAncestorOf(focusWidget));
    }

    /**
     * Queues a layout update, which runs `_updateLayout()` at the end of the current task.
     *
     * @protected
     */
    _queueLayout() {
        LAYOUT_QUEUE.add(this);

        if (!layoutScheduled) {
            layoutScheduled = true;
            queueMicrotask(flushLayoutQueue);
        }
    }

    /**
     * Updates the layout of this widget's children. Containers override this.
     *
     * @protected
     */
    _updateLayout() {}

    /**
     * Applies the layout properties (alignment, margins and size request) to the root element.
     *
     * @protected
     */
    _applyLayoutStyle() {
        const margin = this._margin;
        const hasMargin = margin.top || margin.right || margin.bottom || margin.left;

        this._setLayoutStyle('margin', hasMargin ? marginToCss(margin) : '');
        this._setLayoutStyle(
            'justifySelf',
            this._hAlign === Align.FILL ? '' : SELF_ALIGNMENT[this._hAlign]
        );
        this._setLayoutStyle(
            'alignSelf',
            this._vAlign === Align.FILL ? '' : SELF_ALIGNMENT[this._vAlign]
        );

        // A requested size is a minimum when filling, and the natural size otherwise.
        const fillWidth = this._hAlign === Align.FILL;
        const fillHeight = this._vAlign === Align.FILL;
        const width = this._width >= 0 ? `${this._width}px` : '';
        const height = this._height >= 0 ? `${this._height}px` : '';

        this._setLayoutStyle('width', fillWidth ? '' : width);
        this._setLayoutStyle('minWidth', fillWidth ? width : '');
        this._setLayoutStyle('height', fillHeight ? '' : height);
        this._setLayoutStyle('minHeight', fillHeight ? height : '');

        this._parent?._onChildLayoutChange(this);
    }

    /**
     * Sets an inline style for layout. Only styles set this way are ever cleared again, so styles
     * that a widget or its stylesheet sets itself are kept when a layout property has its default.
     *
     * @protected
     * @param {string} name A camelCase CSS property name.
     * @param {string} value The value, or `''` for the default.
     */
    _setLayoutStyle(name, value) {
        if (!this._layoutStyles) {
            this._layoutStyles = new Set();
        }

        // A shorthand replaces its longhands, so they are no longer set by us.
        const ownLonghands = (LONGHANDS[name] || []).filter((x) => this._layoutStyles.delete(x));

        if (value) {
            this.el.style[name] = value;
            this._layoutStyles.add(name);
        } else if (this._layoutStyles.has(name)) {
            this.el.style[name] = '';
            this._layoutStyles.delete(name);
        } else {
            // Clear only the longhands we set, not ones the widget set itself.
            for (const longhand of ownLonghands) {
                this.el.style[longhand] = '';
            }
        }
    }

    /**
     * Clears all styles set with {@link Widget#_setLayoutStyle}, e.g. when the widget leaves its
     * container.
     *
     * @protected
     */
    _clearLayoutStyles() {
        for (const name of this._layoutStyles || []) {
            this.el.style[name] = '';
        }

        this._layoutStyles?.clear();
    }

    /**
     * Computes whether the widget expands in one direction. Containers also consider their
     * children.
     *
     * @protected
     * @param {'h' | 'v'} _direction
     * @returns {boolean}
     */
    _computeExpand(_direction) {
        return false;
    }

    /**
     * Recomputes the effective expand flags and propagates changes to the parent.
     *
     * @protected
     */
    _refreshExpand() {
        const hExpand = this._hExpand ?? this._computeExpand('h');
        const vExpand = this._vExpand ?? this._computeExpand('v');

        if (hExpand === this._isHExpandCache && vExpand === this._isVExpandCache) {
            return;
        }

        this._isHExpandCache = hExpand;
        this._isVExpandCache = vExpand;

        this.el.classList.toggle('wy-h-expand', hExpand);
        this.el.classList.toggle('wy-v-expand', vExpand);

        this._parent?._onChildExpandChange(this);
    }

    _recalculateVisibility() {
        const isVisible =
            this._visible && (this.isTopLevel ? this._isShown() : Boolean(this._parent?.isVisible));
        if (isVisible === this._isVisibleCache) {
            return;
        }

        this._isVisibleCache = isVisible;

        this._onIsVisibleChange(isVisible);

        this.emit('is-visible-change', this);
    }

    /**
     * Whether a top-level widget is actually on screen. Overridden by windows.
     *
     * @protected
     * @returns {boolean}
     */
    _isShown() {
        return this._visible;
    }

    /**
     * Called when the effective visibility changed. Containers propagate it to their children.
     *
     * @protected
     * @param {boolean} isVisible
     */
    _onIsVisibleChange(isVisible) {
        if (!isVisible) {
            this._tooltip?.disappear?.();

            if (this.isFocus) {
                this.window?._onFocusWidgetGone(this);
            }
        }
    }

    _recalculateSensitivity() {
        const isSensitive =
            this._sensitive && (this.isTopLevel || Boolean(this._parent?.isSensitive));
        if (isSensitive === this._isSensitiveCache) {
            return;
        }

        this._isSensitiveCache = isSensitive;

        this.el.classList.toggle('wy-insensitive', !isSensitive);

        this._onIsSensitiveChange(isSensitive);

        this.emit('is-sensitive-change', this);
    }

    /**
     * Called when the effective sensitivity changed. Containers propagate it to their children.
     *
     * @protected
     * @param {boolean} isSensitive
     */
    _onIsSensitiveChange(isSensitive) {
        this._updateTabIndex();

        if (!isSensitive) {
            this._tooltip?.disappear?.();

            if (this.isFocus) {
                this.window?._onFocusWidgetGone(this);
            }
        }
    }

    /**
     * Updates the tab index of the focus element from `canFocus` and the sensitivity.
     *
     * @protected
     */
    _updateTabIndex() {
        const focusable = this._canFocus && this._isSensitiveCache;
        const element = this.focusElement;

        if (focusable) {
            element.tabIndex = 0;
        } else if (
            element.tabIndex >= 0 ||
            element.hasAttribute('tabindex') ||
            element.matches('input, textarea, select, button, a[href]')
        ) {
            element.tabIndex = -1;
        }
    }

    /**
     * Updates the focus state flags. Called by the window.
     *
     * @protected
     * @param {boolean} isFocus
     * @param {boolean} hasFocus
     */
    _setFocusState(isFocus, hasFocus) {
        if (isFocus !== this._isFocus) {
            this._isFocus = isFocus;

            this.emit('is-focus-change', this);
        }

        if (hasFocus !== this._hasFocus) {
            this._hasFocus = hasFocus;

            this.el.classList.toggle('wy-focus', hasFocus);

            this.emit('has-focus-change', this);
        }
    }

    _onFocusElementFocus(nativeEvent, focus) {
        if (nativeEvent.target !== this.focusElement) {
            return;
        }

        if (this._events & (focus ? Events.FOCUS : Events.BLUR)) {
            const related = Widget.fromElement(nativeEvent.relatedTarget);
            const event = new FocusChangeEvent(
                this,
                getModifiers(nativeEvent),
                focus,
                related,
                nativeEvent
            );

            this._dispatchEvent(event, false);
        }
    }

    /**
     * Emits the signals for a toolkit event.
     *
     * @protected
     * @param {import('../events/events.js').ToolkitEvent} event
     * @param {boolean} capture Whether this is the capture phase.
     * @returns {boolean} Whether a handler handled the event.
     */
    _dispatchEvent(event, capture) {
        if (!this.isSensitive) {
            return false;
        }

        const prefix = capture ? 'capture-' : '';

        return (
            this.emit(`${prefix}${event.type}-event`, this, event) ||
            this.emit(`${prefix}event`, this, event)
        );
    }

    _syncEventListeners() {
        for (const [bubbleMask, captureMask, domName, type] of EVENT_BINDINGS) {
            for (const capture of [false, true]) {
                const mask = capture ? captureMask : bubbleMask;
                const wanted =
                    Boolean(mask && this._events & mask) ||
                    (!capture && domName === 'pointerdown' && Boolean(this._events & GRAB_MASK));

                const key = `${domName}:${capture}`;
                const existing = this._domListeners.get(key);

                if (wanted && !existing) {
                    const listener = (nativeEvent) => this._onDomEvent(nativeEvent, type, capture);
                    this.el.addEventListener(domName, listener, { capture, passive: false });
                    this._domListeners.set(key, listener);
                } else if (!wanted && existing) {
                    this.el.removeEventListener(domName, existing, { capture });
                    this._domListeners.delete(key);
                }
            }
        }
    }

    _onDomEvent(nativeEvent, type, capture) {
        try {
            this._handleDomEvent(nativeEvent, type, capture);
        } finally {
            this._grabAfterPress(nativeEvent, type, capture);
        }
    }

    /**
     * Grabs the pointer while a button is pressed, so motion and release keep coming to us. This
     * runs after the press handlers, because moving the pressed element in the document (which a
     * handler may do) makes the browser drop a pointer capture.
     */
    _grabAfterPress(nativeEvent, type, capture) {
        if (
            type !== EventType.BUTTON_PRESS ||
            capture ||
            !(this._events & GRAB_MASK) ||
            nativeEvent.wyGrabbed
        ) {
            return;
        }

        nativeEvent.wyGrabbed = true;

        // Capture on the pressed element, or on ourselves if a handler removed it.
        const target =
            nativeEvent.target?.isConnected && this.el.contains(nativeEvent.target)
                ? nativeEvent.target
                : this.el;

        try {
            target.setPointerCapture?.(nativeEvent.pointerId);
        } catch (_error) {
            // The pointer may already be gone.
        }
    }

    _handleDomEvent(nativeEvent, type, capture) {
        const mask = EVENT_BINDINGS.find((x) => x[3] === type)[capture ? 1 : 0];
        if (!(this._events & mask)) {
            return;
        }

        const event = this._createEvent(nativeEvent, type);
        if (!event) {
            return;
        }

        if (this._dispatchEvent(event, capture)) {
            nativeEvent.stopPropagation();

            // Keep the default for presses, so focusing and text selection keep working.
            if (type !== EventType.BUTTON_PRESS && type !== EventType.BUTTON_RELEASE) {
                nativeEvent.preventDefault();
            }
        }
    }

    _createEvent(nativeEvent, type) {
        return createToolkitEvent(nativeEvent, type, this);
    }

    _observeSize() {
        if (this._sizeAllocateObserver || typeof ResizeObserver === 'undefined') {
            return;
        }

        this._sizeAllocateObserver = new ResizeObserver(() => {
            if (!this.destroyed) {
                this.emit('size-allocate', this, this.allocation);
            }
        });

        this._sizeAllocateObserver.observe(this.el);
    }

    _createTooltip(properties) {
        const entry = getType('tooltip');
        if (!entry) {
            throw new Error('Tooltips need the Tooltip widget; import it first.');
        }

        return new entry.cls(properties);
    }

    _onTooltipDestroy() {
        this._tooltip = null;
        this._showTooltip = false;
        this._syncTooltipHandlers();
    }

    _syncTooltipHandlers() {
        const wanted = Boolean(this._showTooltip && this._tooltip);

        if (wanted && !this._tooltipHandlers) {
            this._tooltipHandlers = {
                enter: (event) => this._tooltip?.appearAt(this, event),
                move: (event) => this._tooltip?.follow?.(this, event),
                leave: () => this._tooltip?.disappear(),
                down: () => this._tooltip?.disappear(),
            };

            this.el.addEventListener('pointerenter', this._tooltipHandlers.enter);
            this.el.addEventListener('pointermove', this._tooltipHandlers.move);
            this.el.addEventListener('pointerleave', this._tooltipHandlers.leave);
            this.el.addEventListener('pointerdown', this._tooltipHandlers.down);
        } else if (!wanted && this._tooltipHandlers) {
            this.el.removeEventListener('pointerenter', this._tooltipHandlers.enter);
            this.el.removeEventListener('pointermove', this._tooltipHandlers.move);
            this.el.removeEventListener('pointerleave', this._tooltipHandlers.leave);
            this.el.removeEventListener('pointerdown', this._tooltipHandlers.down);

            this._tooltipHandlers = null;
        }
    }

    /**
     * Called by the container when the widget was placed in it. Applies the layout style.
     *
     * @protected
     */
    _onParented() {
        this._applyLayoutStyle();
    }
}

/**
 * Converts a margin object to a CSS `margin` value.
 *
 * @param {{top: number, right: number, bottom: number, left: number}} margin
 * @returns {string}
 */
export function marginToCss(margin) {
    return `${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px`;
}

/**
 * Converts a margin value (a number for all sides or an object) to a full margin object.
 *
 * @param {number | {top?: number, right?: number, bottom?: number, left?: number}} margin
 * @returns {{top: number, right: number, bottom: number, left: number}}
 */
function toMargin(margin) {
    if (typeof margin === 'number') {
        return { top: margin, right: margin, bottom: margin, left: margin };
    }

    return { top: 0, right: 0, bottom: 0, left: 0, ...margin };
}

function marginSide(side) {
    return {
        get() {
            return this._margin[side];
        },
        set(value) {
            if (this._margin[side] === value) {
                return false;
            }

            this._margin = { ...this._margin, [side]: value };
            this._applyLayoutStyle();
        },
    };
}

defineProperties(Widget, {
    /**
     * Whether the widget is shown. Set last when passing several properties.
     */
    visible: {
        value: true,
        late: true,
        changed(visible) {
            this.el.hidden = !visible;

            this._recalculateVisibility();
            this._recalculateSensitivity();

            this._parent?._onChildVisibleChange(this);
        },
    },

    /**
     * Whether the widget is effectively visible: it is `visible` and so are its ancestors.
     */
    isVisible: {
        readOnly: true,
        get() {
            return this._isVisibleCache;
        },
    },

    /**
     * Whether this is a top-level widget (a window), which cannot be put in a container.
     */
    isTopLevel: { value: false, readOnly: true },

    /**
     * The window the widget is in (the widget itself for windows), or `null`.
     */
    window: {
        readOnly: true,
        get() {
            let widget = this;
            while (widget && !widget.isWindow) {
                widget = widget._parent;
            }

            return widget || null;
        },
    },

    /**
     * Whether this widget is a window.
     */
    isWindow: { value: false, readOnly: true },

    /**
     * The parent container, or `null`.
     */
    parent: { value: null, readOnly: true },

    /**
     * A name for finding the widget, also set as the `data-name` attribute.
     */
    name: {
        value: '',
        changed(name) {
            if (name) {
                this.el.dataset.name = name;
            } else {
                delete this.el.dataset.name;
            }
        },
    },

    /**
     * The accessible name, for widgets without a visible label (such as an icon button or a line
     * edit next to a picture), or `''` for none. It is the `aria-label` of the focus element (or of
     * the root element of widgets that have none of their own). A label whose mnemonic widget
     * this is names the widget instead.
     */
    accessibleName: {
        value: '',
        coerce(name) {
            return name === null || name === undefined ? '' : String(name);
        },
        changed() {
            this._syncAccessibleName();
        },
    },

    /**
     * The requested width in pixels, or -1 for the natural width. When the widget fills its space
     * horizontally, this is its minimum width.
     */
    width: {
        value: -1,
        changed() {
            this._applyLayoutStyle();
        },
    },

    /**
     * The requested height in pixels, or -1 for the natural height. When the widget fills its space
     * vertically, this is its minimum height.
     */
    height: {
        value: -1,
        changed() {
            this._applyLayoutStyle();
        },
    },

    /**
     * The margin around the widget. Set a number for all sides, or an object with `top`, `right`,
     * `bottom` and `left`. Reading returns the object.
     */
    margin: {
        value: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }),
        coerce: toMargin,
        set(margin) {
            const old = this._margin;
            if (
                old.top === margin.top &&
                old.right === margin.right &&
                old.bottom === margin.bottom &&
                old.left === margin.left
            ) {
                return false;
            }

            this._margin = margin;
            this._applyLayoutStyle();
        },
    },

    marginTop: marginSide('top'),
    marginRight: marginSide('right'),
    marginBottom: marginSide('bottom'),
    marginLeft: marginSide('left'),

    /**
     * How the widget uses horizontal space: one of `Align`.
     */
    hAlign: {
        value: Align.FILL,
        changed() {
            this._applyLayoutStyle();
        },
    },

    /**
     * How the widget uses vertical space: one of `Align`.
     */
    vAlign: {
        value: Align.FILL,
        changed() {
            this._applyLayoutStyle();
        },
    },

    /**
     * Whether the widget takes extra horizontal space. `null` (the default) inherits it from the
     * children: a container expands when one of its children does.
     */
    hExpand: {
        value: null,
        changed() {
            this._refreshExpand();
        },
    },

    /**
     * Whether the widget takes extra vertical space. `null` inherits it from the children.
     */
    vExpand: {
        value: null,
        changed() {
            this._refreshExpand();
        },
    },

    /**
     * Whether the widget effectively expands horizontally.
     */
    isHExpand: {
        readOnly: true,
        get() {
            return this._isHExpandCache;
        },
    },

    /**
     * Whether the widget effectively expands vertically.
     */
    isVExpand: {
        readOnly: true,
        get() {
            return this._isVExpandCache;
        },
    },

    /**
     * Whether the user can interact with the widget. Insensitive widgets are grayed out.
     */
    sensitive: {
        value: true,
        changed(sensitive) {
            this.el.inert = !sensitive;
            this.el.setAttribute('aria-disabled', String(!sensitive));

            if (sensitive) {
                this.el.removeAttribute('aria-disabled');
            }

            this._recalculateSensitivity();
        },
    },

    /**
     * Whether the widget is effectively sensitive: it is `sensitive` and so are its ancestors.
     */
    isSensitive: {
        readOnly: true,
        get() {
            return this._isSensitiveCache;
        },
    },

    /**
     * Whether the widget can take the keyboard focus.
     */
    canFocus: {
        value: false,
        changed(canFocus) {
            this._updateTabIndex();

            if (!canFocus && this.isFocus) {
                this.window?._onFocusWidgetGone(this);
            }
        },
    },

    /**
     * Whether the widget is the focus widget of its window. Setting it focuses or blurs it.
     */
    isFocus: {
        value: false,
        signal: false,
        set(isFocus) {
            isFocus ? this.focus() : this.blur();

            return false;
        },
    },

    /**
     * Whether the widget has the keyboard focus: it `isFocus` and its window is active.
     */
    hasFocus: {
        value: false,
        signal: false,
        set(hasFocus) {
            if (hasFocus) {
                this.window?.present?.();
                this.focus();
            } else if (this._hasFocus) {
                this.focusElement.blur();
            }

            return false;
        },
    },

    /**
     * Whether the tooltip is shown when hovering. Setting `tooltipLabel` turns this on.
     */
    showTooltip: {
        value: false,
        changed(showTooltip) {
            if (showTooltip && !this._tooltip) {
                this.tooltip = this._createTooltip({});
            }

            this._syncTooltipHandlers();
        },
    },

    /**
     * The text of the tooltip, or `null` for none.
     */
    tooltipLabel: {
        signal: false,
        get() {
            return this._tooltip ? this._tooltip.label : null;
        },
        set(label) {
            if (label === null || label === undefined || label === '') {
                this.showTooltip = false;

                if (this._tooltip) {
                    this._tooltip.label = '';
                }

                return;
            }

            if (this._tooltip) {
                this._tooltip.label = label;
            } else {
                this.tooltip = this._createTooltip({ label });
            }

            this.showTooltip = true;
        },
    },

    /**
     * The `Tooltip` of the widget, or `null`.
     */
    tooltip: {
        value: null,
        set(tooltip) {
            if (this._tooltip) {
                this._tooltip.disconnect('destroy', this._onTooltipDestroy, this);

                if (this._tooltip !== tooltip) {
                    this._tooltip.destroy();
                }
            }

            this._tooltip = tooltip;
            tooltip?.connect('destroy', this._onTooltipDestroy, this);
            tooltip?._setWidget?.(this);

            this._syncTooltipHandlers();
        },
    },

    /**
     * The mask of `Events` whose signals the widget emits.
     */
    events: {
        value: Events.NONE,
        changed() {
            this._syncEventListeners();
        },
    },

    /**
     * Whether drags can start on this widget (see the drag events).
     */
    draggable: {
        value: false,
        changed(draggable) {
            this.el.classList.toggle('wy-draggable', draggable);
        },
    },

    /**
     * Whether things can be dropped on this widget (see the drag events).
     */
    droppable: {
        value: false,
        changed(droppable) {
            this.el.classList.toggle('wy-droppable', droppable);
        },
    },
});
