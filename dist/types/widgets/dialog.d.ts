/**
 * @module widgets/dialog
 */
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
export declare const RESPONSE_LABELS: Readonly<Record<string, string>>;
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
export declare class Dialog extends Window {
    /** @type {Map<string, Widget>} */
    _buttons: Map<string, Widget>;
    /** @type {((response: string) => void)[]} */
    _runResolvers: ((response: string) => void)[];
    _responding: number;
    _closeAfterResponse: boolean;
    _parentHandler: any;
    _vbox: Box;
    _contentArea: Box;
    _actionArea: ButtonBox;
    modal: any;
    _initialize(): void;
    /**
     * The vertical box for the content, above the buttons.
     *
     * @type {Box}
     */
    get contentArea(): Box;
    /**
     * The button box with the buttons.
     *
     * @type {ButtonBox}
     */
    get actionArea(): ButtonBox;
    /**
     * Adds a widget to the content area.
     *
     * @param {Widget} widget
     * @returns {Widget}
     */
    addChild(widget: Widget): Widget;
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
    addButton(response: string, label?: string | Button): Widget;
    /**
     * Adds buttons, as `[response, label]` pairs.
     *
     * @param {...([string, string?] | string)} buttons
     */
    addButtons(...buttons: ([string, string?] | string)[]): void;
    /**
     * Adds a widget to the action area for a response. Buttons emit the response when
     * activated. A Help button is placed apart, at the other end.
     *
     * @param {Widget} widget
     * @param {string} response
     * @returns {Widget} The widget.
     * @throws {Error} If there already is a widget for the response.
     */
    addActionWidget(widget: Widget, response: string): Widget;
    /**
     * Removes (and destroys) the button of a response.
     *
     * @param {string} response
     * @throws {Error} If there is no button for the response.
     */
    removeButton(response: string): void;
    /**
     * Returns the button of a response, or `null`.
     *
     * @param {string} response
     * @returns {Widget | null}
     */
    getButton(response: string): Widget | null;
    /**
     * Returns the button of a response, or `null`. GTK's name of `getButton()`.
     *
     * @param {string} response
     * @returns {Widget | null}
     */
    getWidgetForResponse(response: string): Widget | null;
    /**
     * Makes the button of a response sensitive or not.
     *
     * @param {string} response
     * @param {boolean} sensitive
     */
    setResponseSensitive(response: string, sensitive: boolean): void;
    /**
     * Gives a response: emits `response`, and settles the promise of `run()`.
     *
     * @param {string} response
     */
    response(response: string): void;
    /**
     * Shows the dialog modally and waits for a response. The dialog closes after the response.
     *
     * @returns {Promise<string>} The response; `Response.NONE` when the dialog was closed
     *     otherwise.
     */
    run(): Promise<string>;
    destroy(): void;
    _onVisibleChange(visible: any): void;
    _settle(response: any): void;
    _onDialogKeyDown(event: any): void;
    _syncDefaultButton(response: any, oldResponse: any): void;
    _syncParentHandler(): void;
}
export declare namespace Dialog {
    var builderProperties: {
        /**
         * Adds buttons: an array of `[response, label]` pairs, response ids, or objects with a
         * `response` and further button properties (such as `label`).
         *
         * @param {object} builder
         * @param {Dialog} dialog
         * @param {Array<string | [string, string?] | {response: string}>} buttons
         */
        buttons(builder: object, dialog: Dialog, buttons: Array<string | [string, string?] | {
            response: string;
        }>): void;
    };
}

/** The declared properties of {@link Dialog}. */
export interface Dialog {
    resizable: any;
    maximizable: any;
    /**
     * The child of a dialog is its content: setting it replaces the content area's children.
     */
    child: any;
    /**
     * The response whose button Enter activates, or `null`. That button is drawn as the default
     * button.
     */
    defaultResponse: any;
    /**
     * The window the dialog belongs to. The dialog is centered over it when first shown.
     */
    transientFor: any;
    /**
     * Whether the dialog is destroyed when its `transientFor` window is destroyed.
     */
    destroyWithParent: boolean;
}
