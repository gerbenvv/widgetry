/**
 * @module widgets/info-bar
 */

import { Align, ButtonBoxStyle, FocusDirection, Response } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { createElement } from '../core/util.js';
import { Key } from '../events/constants.js';
import { bindToolkitText, toolkitText } from '../i18n/toolkit-text.js';
import { Bin } from './bin.js';
import { Box } from './box.js';
import { ButtonBox } from './button-box.js';
import { Button, Relief } from './button.js';
import { RESPONSE_LABELS } from './dialog.js';
import { Image } from './image.js';
import { MessageType } from './message-dialog.js';
import { Widget } from './widget.js';

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
 * The standard responses, for recognizing the argument order of `addButton()`.
 *
 * @type {ReadonlySet<string>}
 */
const RESPONSES = new Set(Object.values(Response));

/**
 * The size of the message icon, in pixels.
 *
 * @type {number}
 */
const ICON_SIZE = 24;

/**
 * The longest a reveal transition may take, in milliseconds, before it is finished anyway.
 *
 * @type {number}
 */
const MAX_TRANSITION_TIME = 1000;

/**
 * An inline message strip above content, like GTK's info bar: an icon for the kind of message
 * (`messageType`), a content area for a label or other widgets, an action area with buttons and an
 * optional close button. It is colored by its message type, as in the classic GTK 2 look: pale
 * blue for information and questions, pale yellow for warnings and pale red for errors.
 *
 * Buttons are added with `addButton(response, label)`, as in a dialog; activating them emits
 * `response`. The close button (`showCloseButton`) emits `response` with `Response.CLOSE`; the
 * handler usually hides the info bar by setting `revealed` to `false`, which slides it closed (or
 * hides it at once when the user prefers reduced motion).
 *
 * Escape in the bar gives the response of its Cancel button, or `Response.CLOSE` when it shows the
 * close button.
 *
 * Errors and warnings are announced by assistive technology right away (role `alert`), other
 * messages politely (role `status`).
 *
 * Signals: `response` (`infoBar, response`).
 *
 * @example
 * const bar = new InfoBar({ messageType: MessageType.WARNING, showCloseButton: true });
 * bar.addChild(new Label({ text: 'The file changed on disk.' }));
 * bar.addButton('reload', '_Reload');
 * bar.connect('response', (_bar, response) => {
 *     if (response === 'reload') {
 *         reload();
 *     }
 *
 *     bar.revealed = false;
 * });
 */
export class InfoBar extends Bin {
    _initialize() {
        super._initialize();

        /** @type {Map<string, Widget>} */
        this._buttons = new Map();

        this._transitionTimer = 0;

        this._image = new Image({ pixelSize: ICON_SIZE, vAlign: Align.CENTER });
        this._image.addStyleClass('wy-info-bar-icon');

        this._contentArea = new Box({ spacing: 6, hExpand: true, vAlign: Align.CENTER });
        this._contentArea.addStyleClass('wy-info-bar-content');

        this._actionArea = new ButtonBox({
            layoutStyle: ButtonBoxStyle.END,
            spacing: 6,
            vAlign: Align.CENTER,
        });
        this._actionArea.addStyleClass('wy-info-bar-actions');

        this._closeButton = new Button({
            icon: 'window-close',
            relief: Relief.NONE,
            vAlign: Align.CENTER,
            visible: false,
        });
        this._closeButton.addStyleClass('wy-info-bar-close');
        bindToolkitText(this._closeButton, () =>
            this._closeButton.el.setAttribute('aria-label', toolkitText('Close'))
        );
        this._closeButton.connect('activate', () => this.response(Response.CLOSE));

        this._box = new Box({ spacing: 8 });
        this._box.addStyleClass('wy-info-bar-box');
        this._box.addChild(this._image);
        this._box.addChild(this._contentArea);
        this._box.addChild(this._actionArea);
        this._box.addChild(this._closeButton);
        super.insertChild(this._box, 0);

        this.el.addEventListener('keydown', (event) => this._onKeyDown(event));

        this.el.addEventListener('transitionend', (event) => {
            if (event.target === this.el) {
                this._finishTransition();
            }
        });

        this._syncMessageType();
        this._syncActionArea();
        this._finishTransition();
    }

    _render() {
        const element = createElement(`
            <div class="wy-info-bar wy-revealed">
                <div class="wy-info-bar-clip">
                    <div class="wy-info-bar-frame"></div>
                </div>
            </div>
        `);

        this._clipEl = element.querySelector('.wy-info-bar-clip');
        this._frameEl = element.querySelector('.wy-info-bar-frame');
        this._bodyEl = this._frameEl;

        return element;
    }

    /**
     * The box for the message, next to the icon. `addChild()` adds to it too.
     *
     * @type {Box}
     */
    get contentArea() {
        return this._contentArea;
    }

    /**
     * The button box with the buttons.
     *
     * @type {ButtonBox}
     */
    get actionArea() {
        return this._actionArea;
    }

    /**
     * The image showing the icon of the message type.
     *
     * @type {Image}
     */
    get image() {
        return this._image;
    }

    /**
     * Adds a widget to the content area.
     *
     * @param {Widget} widget
     * @returns {Widget}
     */
    addChild(widget) {
        return this._contentArea.addChild(widget);
    }

    /**
     * Adds a button for a response, as in a dialog. The label defaults to the standard label of
     * the response (such as `'_OK'`); underscores mark mnemonics. `addButton(label, response)`
     * works as well when `response` is a standard `Response` and `label` is not.
     *
     * @param {string} response The response id.
     * @param {string | Button} [label] The label, or a button to use.
     * @returns {Widget} The button.
     * @throws {Error} If there already is a button for the response.
     */
    addButton(response, label) {
        if (
            typeof label === 'string' &&
            RESPONSES.has(label) &&
            !RESPONSES.has(response) &&
            !this._buttons.has(label)
        ) {
            [response, label] = [label, response];
        }

        if (label instanceof Widget) {
            return this.addActionWidget(label, response);
        }

        const button = new Button({ label: label ?? String(response), useUnderline: true });

        // A standard label follows the current language.
        if ((label === undefined || label === null) && RESPONSE_LABELS[response]) {
            bindToolkitText(button, () => (button.label = toolkitText(RESPONSE_LABELS[response])));
        }

        return this.addActionWidget(button, response);
    }

    /**
     * Adds buttons, as `[response, label]` pairs or response ids.
     *
     * @param {...([string, string?] | string)} buttons
     */
    addButtons(...buttons) {
        for (const button of buttons) {
            if (Array.isArray(button)) {
                this.addButton(button[0], button[1]);
            } else {
                this.addButton(button);
            }
        }
    }

    /**
     * Adds a widget to the action area for a response. Buttons emit the response when
     * activated.
     *
     * @param {Widget} widget
     * @param {string} response
     * @returns {Widget} The widget.
     * @throws {Error} If there already is a widget for the response.
     */
    addActionWidget(widget, response) {
        response = String(response);

        if (this._buttons.has(response)) {
            throw new Error(`The info bar already has a button for response '${response}'.`);
        }

        this._actionArea.addChild(widget);
        this._buttons.set(response, widget);

        if (typeof widget.activate === 'function') {
            widget.connect('activate', () => this.response(response));
        }

        widget.connect('destroy', () => {
            if (this._buttons.get(response) === widget) {
                this._buttons.delete(response);
                this._syncActionArea();
            }
        });

        this._syncActionArea();

        return widget;
    }

    /**
     * Removes (and destroys) the button of a response.
     *
     * @param {string} response
     * @throws {Error} If there is no button for the response.
     */
    removeButton(response) {
        const button = this._buttons.get(response);
        if (!button) {
            throw new Error(`The info bar has no button for response '${response}'.`);
        }

        this._buttons.delete(response);
        button.destroy();
        this._syncActionArea();
    }

    /**
     * Returns the button of a response, or `null`.
     *
     * @param {string} response
     * @returns {Widget | null}
     */
    getButton(response) {
        return this._buttons.get(response) || null;
    }

    /**
     * Makes the button of a response sensitive or not.
     *
     * @param {string} response
     * @param {boolean} sensitive
     */
    setResponseSensitive(response, sensitive) {
        const button = this._buttons.get(response);
        if (button) {
            button.sensitive = sensitive;
        }
    }

    /**
     * Gives a response: emits `response`.
     *
     * @param {string} response
     */
    response(response) {
        this.emit('response', this, response);
    }

    destroy() {
        clearTimeout(this._transitionTimer);

        super.destroy();
    }

    _getFocusChain() {
        return this._revealed ? super._getFocusChain() : [];
    }

    _onKeyDown(event) {
        if (
            event.key !== Key.ESCAPE ||
            event.defaultPrevented ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey ||
            event.shiftKey ||
            !this._revealed
        ) {
            return;
        }

        // Like GTK, Escape dismisses the bar when it has a Cancel or a close button.
        const cancel = this._buttons.get(Response.CANCEL);
        let response = null;
        if (cancel && cancel.isVisible && cancel.isSensitive) {
            response = Response.CANCEL;
        } else if (this._showCloseButton) {
            response = Response.CLOSE;
        }

        if (response === null) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.response(response);
    }

    _computeExpand(direction) {
        // An info bar only takes extra space in its own direction, not vertically.
        return direction === 'h' && super._computeExpand(direction);
    }

    _syncMessageType() {
        const messageType = this._messageType;
        const icon = ICONS[messageType];

        for (const type of Object.values(MessageType)) {
            this.el.classList.toggle(`wy-${type}`, type === messageType);
        }

        this._image.icon = icon;
        this._image.visible = Boolean(icon);

        // Errors and warnings are urgent; other messages are announced politely.
        const urgent = messageType === MessageType.ERROR || messageType === MessageType.WARNING;
        this.el.setAttribute('role', urgent ? 'alert' : 'status');
    }

    _syncActionArea() {
        this._actionArea.visible = this._buttons.size > 0;
    }

    _syncRevealed() {
        const revealed = this._revealed;

        clearTimeout(this._transitionTimer);

        this._clipEl.inert = !revealed;
        if (revealed) {
            this.el.removeAttribute('aria-hidden');
        } else {
            this.el.setAttribute('aria-hidden', 'true');
        }

        if (revealed) {
            // Show the collapsed bar first, so the transition starts from there.
            this.el.classList.remove('wy-collapsed');
            void this.el.offsetHeight;
        } else if (this.focusChild && this.window) {
            // Move the focus out of the bar before it goes.
            this.window.moveFocus(FocusDirection.FORWARD);
        }

        this.el.classList.toggle('wy-revealed', revealed);

        const duration = this.el.isConnected ? getTransitionTime(this.el) : 0;
        if (duration > 0) {
            this._transitionTimer = setTimeout(
                () => this._finishTransition(),
                Math.min(duration + 50, MAX_TRANSITION_TIME)
            );
        } else {
            this._finishTransition();
        }
    }

    _finishTransition() {
        clearTimeout(this._transitionTimer);
        this._transitionTimer = 0;

        // A collapsed bar takes no room at all, not even the spacing of its box.
        this.el.classList.toggle('wy-collapsed', !this._revealed);
    }
}

/**
 * Returns the longest transition (duration plus delay) of an element, in milliseconds.
 *
 * @param {HTMLElement} element
 * @returns {number}
 */
function getTransitionTime(element) {
    const style = getComputedStyle(element);
    const toTimes = (text) =>
        text.split(',').map((x) => parseFloat(x) * (x.trim().endsWith('ms') ? 1 : 1000) || 0);

    const durations = toTimes(style.transitionDuration);
    const delays = toTimes(style.transitionDelay);

    return Math.max(0, ...durations.map((x, i) => x + (delays[i % delays.length] || 0)));
}

defineProperties(InfoBar, {
    /**
     * The child of an info bar is its content: setting it replaces the content area's children.
     */
    child: {
        get() {
            return this._contentArea?.children[0] || null;
        },
        set(widget) {
            this._contentArea.removeAllChildren();

            if (widget) {
                this._contentArea.addChild(widget);
            }
        },
    },

    /**
     * The kind of message: one of `MessageType`, which selects the icon and the colors.
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
            this._syncMessageType();
        },
    },

    /**
     * Whether a close button is shown at the end, which gives the response `Response.CLOSE`.
     */
    showCloseButton: {
        value: false,
        coerce: Boolean,
        changed(showCloseButton) {
            this._closeButton.visible = showCloseButton;
        },
    },

    /**
     * Whether the info bar is shown. Changing it slides the bar open or closed.
     */
    revealed: {
        value: true,
        coerce: Boolean,
        changed() {
            this._syncRevealed();
        },
    },
});

InfoBar.builderProperties = {
    /**
     * Adds buttons: an array of `[response, label]` pairs, response ids, or objects with a
     * `response` and further button properties (such as `label`), like a dialog's.
     *
     * @param {object} builder
     * @param {InfoBar} infoBar
     * @param {Array<string | [string, string?] | {response: string}>} buttons
     */
    buttons(builder, infoBar, buttons) {
        if (!Array.isArray(buttons)) {
            throw new Error('Info bar buttons must be an array.');
        }

        for (const button of buttons) {
            if (Array.isArray(button)) {
                infoBar.addButton(button[0], button[1]);
            } else if (button && typeof button === 'object') {
                const { response, ...spec } = button;
                if (spec.type) {
                    infoBar.addActionWidget(builder.build(spec)[0], response);
                } else {
                    infoBar.addButton(response, spec.label);
                }
            } else {
                infoBar.addButton(button);
            }
        }
    },
};

registerType('info-bar', InfoBar);
