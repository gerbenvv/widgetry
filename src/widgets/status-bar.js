/**
 * @module widgets/status-bar
 */

import { getCursor } from '../core/cursor.js';
import { Align, CursorShape, ShadowType } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Box } from './box.js';

/**
 * The shadow types a status bar supports, for validating `shadowType`.
 *
 * @type {ReadonlySet<string>}
 */
const SHADOW_TYPES = new Set(Object.values(ShadowType));

/**
 * The description of the context with id 0, used when no context id is given.
 *
 * @type {string}
 */
const DEFAULT_CONTEXT = 'default';

/**
 * @typedef {object} StatusMessage
 * @property {number} id
 * @property {number} contextId
 * @property {string} text
 */

/**
 * Shows messages of minor importance to the user, usually along the bottom of the main window,
 * like GTK's status bar.
 *
 * A status bar keeps a stack of messages, and shows the one on top in an ellipsized label at its
 * start. Every message has a context id that identifies its source; get one with
 * `getContextId(description)`. `pop(contextId)` removes the most recent message of a context, so
 * several sources can maintain their own sub-stacks. Context id 0 is the default context.
 *
 * Children are packed after the label, at the end of the bar, e.g. a version label or a
 * progress bar. With `hasResizeGrip`, a grip at the end resizes the window the bar is in.
 *
 * Signals: `text-push` and `text-pop` (`statusBar, contextId, text`), and `text-change`.
 */
export class StatusBar extends Box {
    _initialize() {
        super._initialize();

        this._contexts = [DEFAULT_CONTEXT];

        /** @type {StatusMessage[]} */
        this._messages = [];
        this._nextMessageId = 1;
        this._gesture = null;

        this._gripEl.addEventListener('pointerdown', (event) => this._onGripPointerDown(event));

        this._syncGrip();
    }

    _render() {
        const element = createElement(`
            <div class="wy-box wy-status-bar wy-shadow-in" role="status">
                <span class="wy-status-bar-label"></span>
                <div class="wy-status-bar-grip" aria-hidden="true"></div>
            </div>
        `);

        this._labelEl = element.querySelector('.wy-status-bar-label');
        this._gripEl = element.querySelector('.wy-status-bar-grip');

        return element;
    }

    /**
     * The element of the label that shows the message, e.g. for styling.
     *
     * @type {HTMLElement}
     */
    get labelElement() {
        return this._labelEl;
    }

    /**
     * The messages on the stack, from the bottom to the top.
     *
     * @type {StatusMessage[]}
     */
    get messages() {
        return this._messages.map((x) => ({ ...x }));
    }

    /**
     * Returns the context id for a description, creating it if needed. The description is not
     * shown.
     *
     * @param {string} description
     * @returns {number}
     */
    getContextId(description) {
        const index = this._contexts.indexOf(String(description));
        if (index >= 0) {
            return index;
        }

        this._contexts.push(String(description));

        return this._contexts.length - 1;
    }

    /**
     * Pushes a message, which is shown until a newer message is pushed or it is removed.
     *
     * @param {number} contextId
     * @param {string} text
     * @returns {number} The id of the message, for `remove()`.
     * @throws {Error} If the context id is unknown.
     */
    push(contextId, text) {
        contextId = this._checkContextId(contextId);

        const message = { id: this._nextMessageId, contextId, text: String(text ?? '') };
        this._nextMessageId += 1;

        this._messages.push(message);
        this._syncLabel();

        this.emit('text-push', this, contextId, message.text);

        return message.id;
    }

    /**
     * Removes the most recent message of a context.
     *
     * @param {number} [contextId]
     * @throws {Error} If the context id is unknown.
     */
    pop(contextId = 0) {
        contextId = this._checkContextId(contextId);

        for (let i = this._messages.length - 1; i >= 0; --i) {
            if (this._messages[i].contextId === contextId) {
                const [message] = this._messages.splice(i, 1);
                this._syncLabel();

                this.emit('text-pop', this, contextId, message.text);

                return;
            }
        }
    }

    /**
     * Removes a message by its id.
     *
     * @param {number} messageId
     * @param {number} [contextId] If given, the message must be of this context.
     */
    remove(messageId, contextId) {
        if (contextId !== undefined) {
            contextId = this._checkContextId(contextId);
        }

        const index = this._messages.findIndex(
            (x) => x.id === messageId && (contextId === undefined || x.contextId === contextId)
        );

        if (index >= 0) {
            this._messages.splice(index, 1);
            this._syncLabel();
        }
    }

    /**
     * Removes all messages of a context.
     *
     * @param {number} [contextId]
     * @throws {Error} If the context id is unknown.
     */
    removeAll(contextId = 0) {
        contextId = this._checkContextId(contextId);

        this._messages = this._messages.filter((x) => x.contextId !== contextId);
        this._syncLabel();
    }

    /**
     * Pushes a message, with the original toolkit's argument order.
     *
     * @param {string} text
     * @param {number} [contextId]
     * @returns {number} The id of the message.
     */
    pushMessage(text, contextId = 0) {
        return this.push(contextId, text);
    }

    /**
     * Removes the most recent message of a context. The original toolkit's name of `pop()`.
     *
     * @param {number} [contextId]
     */
    popMessage(contextId = 0) {
        this.pop(contextId);
    }

    /**
     * Removes a message, with the original toolkit's arguments.
     *
     * @param {number} contextId
     * @param {number} messageId
     */
    removeMessage(contextId, messageId) {
        this.remove(messageId, contextId ?? 0);
    }

    /**
     * Removes all messages of a context. The original toolkit's name of `removeAll()`.
     *
     * @param {number} [contextId]
     */
    removeAllMessages(contextId = 0) {
        this.removeAll(contextId);
    }

    destroy() {
        this._endGesture();

        super.destroy();
    }

    _attachChildElement(widget, index) {
        // Keep the label first and the grip last.
        const next = this._children[index + 1];
        this.bodyElement.insertBefore(widget.el, next ? next.el : this._gripEl);
    }

    _checkContextId(contextId) {
        const id = contextId ?? 0;
        if (!Number.isInteger(id) || id < 0 || id >= this._contexts.length) {
            throw new Error(`Unknown status bar context id: ${contextId}.`);
        }

        return id;
    }

    _syncLabel() {
        const message = this._messages[this._messages.length - 1];
        const text = message ? message.text : '';

        if (this._labelEl.textContent !== text) {
            this._labelEl.textContent = text;
            this._labelEl.title = text;

            this.emit('text-change', this);
        }
    }

    _getResizableWindow() {
        const window = this.window;

        return window && typeof window.resize === 'function' && window.resizable ? window : null;
    }

    _syncGrip() {
        if (!this._gripEl) {
            return;
        }

        this._gripEl.hidden = !this._hasResizeGrip;
    }

    _onGripPointerDown(event) {
        const window = this._getResizableWindow();
        if (event.button !== 0 || !window || window.maximized || !this.isSensitive) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const target = this._gripEl;
        target.setPointerCapture(event.pointerId);

        const start = window.el.getBoundingClientRect();

        const move = (moveEvent) => {
            window.resize(
                Math.round(start.width + moveEvent.clientX - event.clientX),
                Math.round(start.height + moveEvent.clientY - event.clientY)
            );
        };

        const end = () => this._endGesture();

        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', end);
        target.addEventListener('pointercancel', end);

        this._gesture = { target, move, end };

        getCursor().pushShape(CursorShape.RESIZE_SE, 'status-bar');
    }

    _endGesture() {
        const gesture = this._gesture;
        if (!gesture) {
            return;
        }

        this._gesture = null;

        gesture.target.removeEventListener('pointermove', gesture.move);
        gesture.target.removeEventListener('pointerup', gesture.end);
        gesture.target.removeEventListener('pointercancel', gesture.end);

        getCursor().popShape('status-bar');
    }
}

defineProperties(StatusBar, {
    vExpand: { value: false },
    vAlign: { value: Align.END },
    spacing: { value: 2 },

    /**
     * The text currently shown: the message on top of the stack, or `''`.
     */
    text: {
        readOnly: true,
        signal: false,
        get() {
            return this._labelEl.textContent;
        },
    },

    /**
     * The border of the bar: one of `ShadowType`. To give only a part of the bar a border, put a
     * `Frame` in it.
     */
    shadowType: {
        value: ShadowType.IN,
        coerce(shadowType) {
            if (!SHADOW_TYPES.has(shadowType)) {
                throw new TypeError(`Invalid shadow type: ${shadowType}.`);
            }

            return shadowType;
        },
        changed(shadowType, oldShadowType) {
            this.el.classList.remove(`wy-shadow-${oldShadowType}`);
            this.el.classList.add(`wy-shadow-${shadowType}`);
        },
    },

    /**
     * Whether the bar shows a grip at its end that resizes its window (when that is a resizable
     * `Window`).
     */
    hasResizeGrip: {
        value: false,
        changed() {
            this._syncGrip();
        },
    },
});

registerType('status-bar', StatusBar);
