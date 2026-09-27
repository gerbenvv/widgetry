/**
 * @module widgets/message-dialog
 */
import { Box } from './box.js';
import { Dialog } from './dialog.js';
import { Image } from './image.js';
import { Label } from './label.js';
/**
 * The kinds of message a message dialog shows, which select its icon.
 *
 * @enum {string}
 */
export declare const MessageType: Readonly<{
    INFO: "info";
    WARNING: "warning";
    QUESTION: "question";
    ERROR: "error";
    OTHER: "other";
}>;
/**
 * The sets of buttons a message dialog can have.
 *
 * @enum {string}
 */
export declare const ButtonsType: Readonly<{
    NONE: "none";
    OK: "ok";
    CLOSE: "close";
    CANCEL: "cancel";
    YES_NO: "yes-no";
    OK_CANCEL: "ok-cancel";
}>;
/**
 * A dialog that shows a message with an icon for its kind, a bold primary text and an optional
 * secondary text, like GTK's message dialog.
 *
 * Choose standard buttons with `buttonsType` (it can only be set once, typically in the
 * constructor), or add your own with `addButton()`. More widgets can be added to `messageArea`,
 * the box with the texts.
 *
 * See also the promise helpers `alert()`, `confirm()` and `prompt()`.
 *
 * @example
 * const dialog = new MessageDialog({
 *     messageType: MessageType.WARNING,
 *     text: 'Delete the file?',
 *     secondaryText: 'It cannot be restored.',
 *     buttonsType: ButtonsType.OK_CANCEL,
 * });
 * const response = await dialog.run();
 */
export declare class MessageDialog extends Dialog {
    _image: Image;
    _textLabel: Label;
    _secondaryLabel: Label;
    _messageArea: Box;
    defaultResponse: string;
    _initialize(): void;
    /**
     * The vertical box with the texts, to add more widgets to.
     *
     * @type {Box}
     */
    get messageArea(): Box;
    /**
     * The image showing the icon of the message type.
     *
     * @type {Image}
     */
    get image(): Image;
    _syncIcon(): void;
    _syncTexts(): void;
    _addButtons(buttonsType: any): void;
}
export declare namespace MessageDialog {
    var builderProperties: {
        /**
         * Adds buttons: a `ButtonsType` preset, or buttons like for a `Dialog`.
         *
         * @param {object} builder
         * @param {MessageDialog} dialog
         * @param {string | Array} buttons
         */
        buttons(builder: object, dialog: MessageDialog, buttons: string | any[]): void;
    };
}
export type MessageOptions = {
    /**
     * The window title.
     */
    title?: string;
    /**
     * The text below the message.
     */
    secondaryText?: string;
    /**
     * One of `MessageType`.
     */
    messageType?: string;
    /**
     * The window to center over.
     */
    transientFor?: import('./window.js').Window | null;
};
/**
 * Shows a message with an OK button, and waits until it is dismissed.
 *
 * @param {string} text
 * @param {MessageOptions} [options]
 * @returns {Promise<void>}
 */
export declare function alert(text: string, options?: MessageOptions): Promise<void>;
/**
 * Asks a question with OK and Cancel buttons (or Yes and No, with `buttonsType: 'yes-no'`).
 *
 * @param {string} text
 * @param {MessageOptions & {buttonsType?: string}} [options]
 * @returns {Promise<boolean>} Whether the user chose OK (or Yes).
 */
export declare function confirm(text: string, options?: MessageOptions & {
    buttonsType?: string;
}): Promise<boolean>;
/**
 * Asks the user for a text, with a line edit and OK and Cancel buttons.
 *
 * @example
 * const name = await prompt('Save as', { text: 'notes.txt', placeholder: 'File name' });
 *
 * @param {string} message The question.
 * @param {MessageOptions & {text?: string, value?: string, placeholder?: string}} [options] The
 *     initial `text` of the line edit (or `value`, the same) and its `placeholder`.
 * @returns {Promise<string | null>} The text, or `null` when canceled.
 */
export declare function prompt(message: string, options?: MessageOptions & {
    text?: string;
    value?: string;
    placeholder?: string;
}): Promise<string | null>;

/** The declared properties of {@link MessageDialog}. */
export interface MessageDialog {
    /**
     * The kind of message: one of `MessageType`, which selects the icon.
     */
    messageType: string;
    /**
     * The primary text, shown bold.
     */
    text: string;
    /**
     * The secondary text, shown below the primary text, or `''`.
     */
    secondaryText: string;
    /**
     * Whether the primary text is markup (see `Label`).
     */
    useMarkup: boolean;
    /**
     * Whether the secondary text is markup (see `Label`).
     */
    secondaryUseMarkup: boolean;
    /**
     * The standard buttons: one of `ButtonsType`. They are added when this is set, so set it
     * once.
     */
    buttonsType: string;
}
