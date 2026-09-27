/**
 * @module widgets/message-dialog
 */

import { Align, Orientation, Response } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { Box } from './box.js';
import { Dialog } from './dialog.js';
import { Image } from './image.js';
import { Label } from './label.js';
import { LineEdit } from './line-edit.js';

/**
 * The kinds of message a message dialog shows, which select its icon.
 *
 * @enum {string}
 */
export const MessageType = Object.freeze({
    INFO: 'info',
    WARNING: 'warning',
    QUESTION: 'question',
    ERROR: 'error',
    OTHER: 'other', // No icon.
});

/**
 * The sets of buttons a message dialog can have.
 *
 * @enum {string}
 */
export const ButtonsType = Object.freeze({
    NONE: 'none',
    OK: 'ok',
    CLOSE: 'close',
    CANCEL: 'cancel',
    YES_NO: 'yes-no',
    OK_CANCEL: 'ok-cancel',
});

/**
 * The icon of each message type.
 *
 * @type {Readonly<Record<string, string>>}
 */
const ICONS = Object.freeze({
    [MessageType.INFO]: 'dialog-information',
    [MessageType.WARNING]: 'dialog-warning',
    [MessageType.QUESTION]: 'dialog-question',
    [MessageType.ERROR]: 'dialog-error',
    [MessageType.OTHER]: '',
});

/**
 * The responses of each set of buttons, in order, and the default response.
 *
 * @type {Readonly<Record<string, {responses: string[], defaultResponse: string | null}>>}
 */
const BUTTONS = Object.freeze({
    [ButtonsType.NONE]: { responses: [], defaultResponse: null },
    [ButtonsType.OK]: { responses: [Response.OK], defaultResponse: Response.OK },
    [ButtonsType.CLOSE]: { responses: [Response.CLOSE], defaultResponse: Response.CLOSE },
    [ButtonsType.CANCEL]: { responses: [Response.CANCEL], defaultResponse: Response.CANCEL },
    [ButtonsType.YES_NO]: { responses: [Response.NO, Response.YES], defaultResponse: Response.YES },
    [ButtonsType.OK_CANCEL]: {
        responses: [Response.CANCEL, Response.OK],
        defaultResponse: Response.OK,
    },
});

/**
 * The size of the message icon, in pixels.
 *
 * @type {number}
 */
const ICON_SIZE = 48;

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
export class MessageDialog extends Dialog {
    _initialize() {
        super._initialize();

        this.el.classList.add('wy-message-dialog');

        this._image = new Image({ pixelSize: ICON_SIZE, vAlign: Align.START });
        this._image.addStyleClass('wy-message-dialog-icon');

        this._textLabel = new Label({ wrap: true, selectable: true, maxWidthChars: 50 });
        this._textLabel.addStyleClass('wy-message-dialog-text');

        this._secondaryLabel = new Label({ wrap: true, selectable: true, maxWidthChars: 50 });
        this._secondaryLabel.addStyleClass('wy-message-dialog-secondary-text');

        this._messageArea = new Box({ orientation: Orientation.VERTICAL, spacing: 6 });
        this._messageArea.addChild(this._textLabel);
        this._messageArea.addChild(this._secondaryLabel);

        const box = new Box({ spacing: 12 });
        box.addStyleClass('wy-message-dialog-box');
        box.addChild(this._image);
        box.addChild(this._messageArea);

        this.contentArea.addChild(box);

        this._syncIcon();
        this._syncTexts();
    }

    /**
     * The vertical box with the texts, to add more widgets to.
     *
     * @type {Box}
     */
    get messageArea() {
        return this._messageArea;
    }

    /**
     * The image showing the icon of the message type.
     *
     * @type {Image}
     */
    get image() {
        return this._image;
    }

    _syncIcon() {
        const icon = ICONS[this._messageType];

        this._image.icon = icon;
        this._image.visible = Boolean(icon);
    }

    _syncTexts() {
        this._textLabel.useMarkup = this._useMarkup;
        this._textLabel.text = this._text;

        this._secondaryLabel.useMarkup = this._secondaryUseMarkup;
        this._secondaryLabel.text = this._secondaryText;
        this._secondaryLabel.visible = Boolean(this._secondaryText);
    }

    _addButtons(buttonsType) {
        const { responses, defaultResponse } = BUTTONS[buttonsType];

        for (const response of responses) {
            this.addButton(response);
        }

        if (defaultResponse) {
            this.defaultResponse = defaultResponse;
        }
    }
}

defineProperties(MessageDialog, {
    /**
     * The kind of message: one of `MessageType`, which selects the icon.
     */
    messageType: {
        value: MessageType.INFO,
        coerce(messageType) {
            if (!Object.hasOwn(ICONS, messageType)) {
                throw new TypeError(`Invalid message type: ${messageType}.`);
            }

            return messageType;
        },
        changed() {
            this._syncIcon();
        },
    },

    /**
     * The primary text, shown bold.
     */
    text: {
        value: '',
        coerce(text) {
            return text === null || text === undefined ? '' : String(text);
        },
        changed() {
            this._syncTexts();
        },
    },

    /**
     * The secondary text, shown below the primary text, or `''`.
     */
    secondaryText: {
        value: '',
        coerce(text) {
            return text === null || text === undefined ? '' : String(text);
        },
        changed() {
            this._syncTexts();
        },
    },

    /**
     * Whether the primary text is markup (see `Label`).
     */
    useMarkup: {
        value: false,
        changed() {
            this._syncTexts();
        },
    },

    /**
     * Whether the secondary text is markup (see `Label`).
     */
    secondaryUseMarkup: {
        value: false,
        changed() {
            this._syncTexts();
        },
    },

    /**
     * The standard buttons: one of `ButtonsType`. They are added when this is set, so set it
     * once.
     */
    buttonsType: {
        value: ButtonsType.NONE,
        coerce(buttonsType) {
            if (!Object.hasOwn(BUTTONS, buttonsType)) {
                throw new TypeError(`Invalid buttons type: ${buttonsType}.`);
            }

            return buttonsType;
        },
        set(buttonsType) {
            if (this._buttonsType !== ButtonsType.NONE) {
                throw new Error('The buttons of a message dialog can only be set once.');
            }

            this._buttonsType = buttonsType;
            this._addButtons(buttonsType);
        },
    },
});

MessageDialog.builderProperties = {
    ...Dialog.builderProperties,

    /**
     * Adds buttons: a `ButtonsType` preset, or buttons like for a `Dialog`.
     *
     * @param {object} builder
     * @param {MessageDialog} dialog
     * @param {string | Array} buttons
     */
    buttons(builder, dialog, buttons) {
        if (typeof buttons === 'string') {
            dialog.buttonsType = buttons;
        } else {
            Dialog.builderProperties.buttons(builder, dialog, buttons);
        }
    },
};

registerType('message-dialog', MessageDialog);

/**
 * @typedef {object} MessageOptions
 * @property {string} [title] The window title.
 * @property {string} [secondaryText] The text below the message.
 * @property {string} [messageType] One of `MessageType`.
 * @property {import('./window.js').Window | null} [transientFor] The window to center over.
 */

function createMessageDialog(text, options, defaults) {
    const { title, secondaryText, messageType, transientFor, buttonsType } = {
        ...defaults,
        ...options,
    };

    return new MessageDialog({
        title: title ?? '',
        text,
        secondaryText: secondaryText ?? '',
        messageType,
        transientFor: transientFor ?? null,
        buttonsType,
    });
}

/**
 * Shows a message with an OK button, and waits until it is dismissed.
 *
 * @param {string} text
 * @param {MessageOptions} [options]
 * @returns {Promise<void>}
 */
export async function alert(text, options = {}) {
    const dialog = createMessageDialog(text, options, {
        messageType: MessageType.INFO,
        buttonsType: ButtonsType.OK,
    });

    await dialog.run();
}

/**
 * Asks a question with OK and Cancel buttons (or Yes and No, with `buttonsType: 'yes-no'`).
 *
 * @param {string} text
 * @param {MessageOptions & {buttonsType?: string}} [options]
 * @returns {Promise<boolean>} Whether the user chose OK (or Yes).
 */
export async function confirm(text, options = {}) {
    const dialog = createMessageDialog(text, options, {
        messageType: MessageType.QUESTION,
        buttonsType: ButtonsType.OK_CANCEL,
    });

    const response = await dialog.run();

    return response === Response.OK || response === Response.YES;
}

/**
 * Asks the user for a text, with a line edit and OK and Cancel buttons.
 *
 * @param {string} text
 * @param {MessageOptions & {value?: string, placeholder?: string}} [options]
 * @returns {Promise<string | null>} The text, or `null` when canceled.
 */
export async function prompt(text, options = {}) {
    const dialog = createMessageDialog(text, options, {
        messageType: MessageType.QUESTION,
        buttonsType: ButtonsType.OK_CANCEL,
    });

    const lineEdit = new LineEdit({
        text: options.value ?? '',
        placeholder: options.placeholder ?? '',
        hExpand: true,
    });
    dialog.messageArea.addChild(lineEdit);

    const result = dialog.run();

    lineEdit.focus();
    lineEdit.selectAll?.();

    const response = await result;

    return response === Response.OK ? lineEdit.text : null;
}
