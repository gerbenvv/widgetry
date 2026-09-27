/**
 * @module widgets/status-bar
 */
import { Box } from './box.js';
export type StatusMessage = {
    id: number;
    contextId: number;
    text: string;
};
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
export declare class StatusBar extends Box {
    _contexts: string[];
    /** @type {StatusMessage[]} */
    _messages: StatusMessage[];
    _nextMessageId: number;
    _gesture: {
        target: Element;
        move: (moveEvent: any) => void;
        end: () => void;
    };
    _labelEl: Element;
    _gripEl: Element;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The element of the label that shows the message, e.g. for styling.
     *
     * @type {HTMLElement}
     */
    get labelElement(): HTMLElement;
    /**
     * The messages on the stack, from the bottom to the top.
     *
     * @type {StatusMessage[]}
     */
    get messages(): StatusMessage[];
    /**
     * Returns the context id for a description, creating it if needed. The description is not
     * shown.
     *
     * @param {string} description
     * @returns {number}
     */
    getContextId(description: string): number;
    /**
     * Pushes a message, which is shown until a newer message is pushed or it is removed.
     *
     * @param {number} contextId
     * @param {string} text
     * @returns {number} The id of the message, for `remove()`.
     * @throws {Error} If the context id is unknown.
     */
    push(contextId: number, text: string): number;
    /**
     * Removes the most recent message of a context.
     *
     * @param {number} [contextId]
     * @throws {Error} If the context id is unknown.
     */
    pop(contextId?: number): void;
    /**
     * Removes a message by its id.
     *
     * @param {number} messageId
     * @param {number} [contextId] If given, the message must be of this context.
     */
    remove(messageId: number, contextId?: number): void;
    /**
     * Removes all messages of a context.
     *
     * @param {number} [contextId]
     * @throws {Error} If the context id is unknown.
     */
    removeAll(contextId?: number): void;
    /**
     * Pushes a message, with the original toolkit's argument order.
     *
     * @param {string} text
     * @param {number} [contextId]
     * @returns {number} The id of the message.
     */
    pushMessage(text: string, contextId?: number): number;
    /**
     * Removes the most recent message of a context. The original toolkit's name of `pop()`.
     *
     * @param {number} [contextId]
     */
    popMessage(contextId?: number): void;
    /**
     * Removes a message, with the original toolkit's arguments.
     *
     * @param {number} contextId
     * @param {number} messageId
     */
    removeMessage(contextId: number, messageId: number): void;
    /**
     * Removes all messages of a context. The original toolkit's name of `removeAll()`.
     *
     * @param {number} [contextId]
     */
    removeAllMessages(contextId?: number): void;
    destroy(): void;
    _attachChildElement(widget: any, index: any): void;
    _checkContextId(contextId: any): any;
    _syncLabel(): void;
    _getResizableWindow(): any;
    _syncGrip(): void;
    _onGripPointerDown(event: any): void;
    _endGesture(): void;
}

/** The declared properties of {@link StatusBar}. */
export interface StatusBar {
    vExpand: any;
    vAlign: any;
    spacing: any;
    /**
     * The text currently shown: the message on top of the stack, or `''`.
     */
    readonly text: any;
    /**
     * The border of the bar: one of `ShadowType`. To give only a part of the bar a border, put a
     * `Frame` in it.
     */
    shadowType: any;
    /**
     * Whether the bar shows a grip at its end that resizes its window (when that is a resizable
     * `Window`).
     */
    hasResizeGrip: boolean;
}
