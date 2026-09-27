/**
 * @module widgets/dialog
 */

import { Application } from '../core/application.js';
import { ButtonBoxStyle, Orientation, Response } from '../core/enums.js';
import { defineProperties } from '../core/instance.js';
import { registerType } from '../core/registry.js';
import { Key } from '../events/constants.js';
import { bindToolkitText, toolkitText } from '../i18n/toolkit-text.js';
import { Box } from './box.js';
import { ButtonBox } from './button-box.js';
import { Button } from './button.js';
import { Widget } from './widget.js';
import { Window } from './window.js';

/**
 * The labels of buttons for the standard responses, with mnemonics.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const RESPONSE_LABELS = Object.freeze({
    [Response.OK]: '_OK',
    [Response.CANCEL]: '_Cancel',
    [Response.CLOSE]: '_Close',
    [Response.YES]: '_Yes',
    [Response.NO]: '_No',
    [Response.APPLY]: '_Apply',
    [Response.HELP]: '_Help',
});

/**
 * The standard responses, for recognizing the argument order of `addButton()`.
 *
 * @type {ReadonlySet<string>}
 */
const RESPONSES = new Set(Object.values(Response));

/**
 * The responses Escape gives, in order of preference, when the dialog has a button for them.
 *
 * @type {ReadonlyArray<string>}
 */
const ESCAPE_RESPONSES = [Response.CANCEL, Response.CLOSE, Response.NO];

/**
 * A window with a content area above a row of buttons (the action area), for asking the user
 * something, like GTK's dialog.
 *
 * Put the content in `contentArea` (a vertical box; `addChild()` adds to it too), and add buttons
 * with `addButton(response, label)`, which emit `response` with their response id when
 * activated. Response ids are the standard `Response` values or any other string.
 *
 * - Enter activates the button of `defaultResponse`, unless the focus widget uses Enter itself.
 * - Escape gives the response of the Cancel (or Close, or No) button if there is one, and closes
 *   the dialog otherwise.
 * - Closing the dialog with its close button emits `response` with `Response.NONE`.
 * - `run()` shows the dialog modally and returns a promise of the response, closing the dialog
 *   afterwards.
 *
 * Dialogs are not resizable by default, like in the original toolkit. With `transientFor`, a
 * dialog is centered over that window, and destroyed with it when `destroyWithParent` is set.
 *
 * Signals: `response` (`dialog, response`).
 *
 * @example
 * const dialog = new Dialog({ title: 'Save changes?', transientFor: window });
 * dialog.contentArea.addChild(new Label({ text: 'The document has unsaved changes.' }));
 * dialog.addButton(Response.CANCEL);
 * dialog.addButton(Response.OK, '_Save');
 * dialog.defaultResponse = Response.OK;
 *
 * if ((await dialog.run()) === Response.OK) {
 *     save();
 * }
 */
export class Dialog extends Window {
    _initialize() {
        super._initialize();

        /** @type {Map<string, Widget>} */
        this._buttons = new Map();

        /** @type {((response: string) => void)[]} */
        this._runResolvers = [];
        this._responding = 0;
        this._closeAfterResponse = false;
        this._parentHandler = null;

        // The window that was active when the dialog was shown, which gets the keyboard back.
        this._previousWindow = null;

        this.el.classList.add('wy-dialog');

        this._vbox = new Box({ orientation: Orientation.VERTICAL });
        this._vbox.addStyleClass('wy-dialog-vbox');

        this._contentArea = new Box({
            orientation: Orientation.VERTICAL,
            spacing: 6,
            vExpand: true,
        });
        this._contentArea.addStyleClass('wy-dialog-content');

        this._actionArea = new ButtonBox({ layoutStyle: ButtonBoxStyle.END, spacing: 6 });
        this._actionArea.addStyleClass('wy-dialog-actions');

        this._vbox.addChild(this._contentArea);
        this._vbox.addChild(this._actionArea);
        this.insertChild(this._vbox, 0);

        this.el.addEventListener('keydown', (event) => this._onDialogKeyDown(event));

        // Closing without a response counts as the response `none`. This runs before the dialog
        // is hidden or destroyed, so response handlers still see it.
        this.connect('close', () => {
            if (!this._responding && !this._closeAfterResponse) {
                this.response(Response.NONE);
            }
        });
    }

    /**
     * The vertical box for the content, above the buttons.
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
     * Adds a widget to the content area.
     *
     * @param {Widget} widget
     * @returns {Widget}
     */
    addChild(widget) {
        return this._contentArea.addChild(widget);
    }

    /**
     * Adds a button for a response. The label defaults to the standard label of the response
     * (such as `'_OK'`); underscores mark mnemonics. The argument order is the original
     * toolkit's; `addButton(label, response)` works as well when `response` is a standard
     * `Response` and `label` is not.
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
        if (label === undefined || label === null) {
            const standard = RESPONSE_LABELS[response];
            if (standard) {
                bindToolkitText(button, () => (button.label = toolkitText(standard)));
            }
        }

        return this.addActionWidget(button, response);
    }

    /**
     * Adds buttons, as `[response, label]` pairs.
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
     * activated. A Help button is placed apart, at the other end.
     *
     * @param {Widget} widget
     * @param {string} response
     * @returns {Widget} The widget.
     * @throws {Error} If there already is a widget for the response.
     */
    addActionWidget(widget, response) {
        response = String(response);

        if (this._buttons.has(response)) {
            throw new Error(`The dialog already has a button for response '${response}'.`);
        }

        this._actionArea.addChild(widget);
        this._buttons.set(response, widget);

        if (response === Response.HELP) {
            this._actionArea.setChildSecondary(widget, true);
        }

        if (typeof widget.activate === 'function') {
            widget.connect('activate', () => this.response(response));
        }

        widget.connect('destroy', () => {
            if (this._buttons.get(response) === widget) {
                this._buttons.delete(response);
            }
        });

        if (response === this._defaultResponse && 'isDefault' in widget) {
            widget.isDefault = true;
        }

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
            throw new Error(`The dialog has no button for response '${response}'.`);
        }

        this._buttons.delete(response);
        button.destroy();
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
     * Returns the button of a response, or `null`. GTK's name of `getButton()`.
     *
     * @param {string} response
     * @returns {Widget | null}
     */
    getWidgetForResponse(response) {
        return this.getButton(response);
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
     * Gives a response: emits `response`, and settles the promise of `run()`.
     *
     * @param {string} response
     */
    response(response) {
        // Settle first: a handler may close (and destroy) the dialog.
        this._settle(response);

        this._responding += 1;
        try {
            this.emit('response', this, response);
        } finally {
            this._responding -= 1;
        }
    }

    /**
     * Shows the dialog modally and waits for a response. The dialog closes after the response.
     *
     * @returns {Promise<string>} The response; `Response.NONE` when the dialog was closed
     *     otherwise.
     */
    run() {
        if (this.destroyed) {
            return Promise.reject(new Error('The dialog has been destroyed.'));
        }

        const wasModal = this._modal;
        this.modal = true;

        const promise = new Promise((resolve) => this._runResolvers.push(resolve));

        this.present();

        return promise.then((response) => {
            if (!this.destroyed) {
                this.modal = wasModal;

                if (this._visible) {
                    this._closeAfterResponse = true;
                    try {
                        this.close();
                    } finally {
                        this._closeAfterResponse = false;
                    }
                }
            }

            return response;
        });
    }

    destroy() {
        // A response handler may already have destroyed the dialog while it was closing.
        if (this.destroyed) {
            return;
        }

        this._parentHandler?.();
        this._parentHandler = null;

        const wasActive = this._visible && this._active;

        super.destroy();

        this._settle(Response.NONE);

        if (wasActive) {
            this._activatePreviousWindow();
        }
    }

    _onVisibleChange(visible) {
        const wasActive = this._active;
        if (visible) {
            const active = Application.activeWindow;
            this._previousWindow = active !== this ? active : null;
        }

        super._onVisibleChange(visible);

        if (!visible) {
            // Hiding the dialog ends `run()`, like closing it.
            this._settle(Response.NONE);

            if (wasActive) {
                this._activatePreviousWindow();
            }

            return;
        }

        // Like GTK, focus the default button unless a widget in the content took the focus.
        const button = this._defaultResponse !== null && this._buttons.get(this._defaultResponse);
        const focusWidget = this._focusWidget;
        if (
            visible &&
            button &&
            (!focusWidget || this._actionArea.isAncestorOf(focusWidget)) &&
            button !== focusWidget
        ) {
            button.focus();
        }
    }

    _activatePreviousWindow() {
        const previous = this._previousWindow;
        this._previousWindow = null;

        // Give the keyboard back to the window the dialog was shown from, or its parent.
        for (const window of [previous, this._transientFor]) {
            if (window && !window.destroyed && window.visible && window !== this) {
                if (!Application.activeWindow) {
                    window.active = true;
                }

                return;
            }
        }
    }

    _settle(response) {
        const resolvers = this._runResolvers;
        this._runResolvers = [];

        for (const resolve of resolvers) {
            resolve(response);
        }
    }

    _onDialogKeyDown(event) {
        if (
            event.key !== Key.ESCAPE ||
            event.defaultPrevented ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey ||
            event.shiftKey
        ) {
            return;
        }

        // Only handle Escape for our own widgets, not for nested windows such as menus.
        const source = Widget.fromElement(event.target);
        if (source && source.window !== this) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        for (const response of ESCAPE_RESPONSES) {
            const button = this._buttons.get(response);
            if (button && button.isVisible && button.isSensitive) {
                this.response(response);

                return;
            }
        }

        if (this._closable) {
            this.close();
        }
    }

    _syncDefaultButton(response, oldResponse) {
        const old = oldResponse !== null ? this._buttons.get(oldResponse) : null;
        if (old && 'isDefault' in old) {
            old.isDefault = false;
        }

        const button = response !== null ? this._buttons.get(response) : null;
        if (button && 'isDefault' in button) {
            button.isDefault = true;
        }
    }

    _syncParentHandler() {
        this._parentHandler?.();
        this._parentHandler = null;

        const parent = this._transientFor;
        if (parent && this._destroyWithParent) {
            this._parentHandler = parent.connect('destroy', () => {
                if (!this.destroyed) {
                    this.destroy();
                }
            });
        }
    }
}

defineProperties(Dialog, {
    resizable: { value: false },
    maximizable: { value: false },

    /**
     * The child of a dialog is its content: setting it replaces the content area's children.
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
     * The response whose button Enter activates, or `null`. That button is drawn as the default
     * button.
     */
    defaultResponse: {
        value: null,
        changed(response, oldResponse) {
            this._syncDefaultButton(response, oldResponse);
        },
    },

    /**
     * The window the dialog belongs to. The dialog is centered over it when first shown.
     */
    transientFor: {
        value: null,
        changed() {
            this._syncParentHandler();
        },
    },

    /**
     * Whether the dialog is destroyed when its `transientFor` window is destroyed.
     */
    destroyWithParent: {
        value: false,
        changed() {
            this._syncParentHandler();
        },
    },
});

Dialog.builderProperties = {
    /**
     * Adds buttons: an array of `[response, label]` pairs, response ids, or objects with a
     * `response` and further button properties (such as `label`).
     *
     * @param {object} builder
     * @param {Dialog} dialog
     * @param {Array<string | [string, string?] | {response: string}>} buttons
     */
    buttons(builder, dialog, buttons) {
        if (!Array.isArray(buttons)) {
            throw new Error('Dialog buttons must be an array.');
        }

        for (const button of buttons) {
            if (Array.isArray(button)) {
                dialog.addButton(button[0], button[1]);
            } else if (button && typeof button === 'object') {
                const { response, ...spec } = button;
                if (spec.type) {
                    dialog.addActionWidget(builder.build(spec)[0], response);
                } else {
                    dialog.addButton(response, spec.label);
                }
            } else {
                dialog.addButton(button);
            }
        }
    },
};

registerType('dialog', Dialog);
