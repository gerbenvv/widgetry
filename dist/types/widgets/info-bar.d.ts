/**
 * @module widgets/info-bar
 */
import { Bin } from './bin.js';
import { Box } from './box.js';
import { ButtonBox } from './button-box.js';
import { Button } from './button.js';
import { Image } from './image.js';
import { Widget } from './widget.js';
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
export declare class InfoBar extends Bin {
    /** @type {Map<string, Widget>} */
    _buttons: Map<string, Widget>;
    _transitionTimer: number;
    _image: Image;
    _contentArea: Box;
    _actionArea: ButtonBox;
    _closeButton: Button;
    _box: Box;
    _clipEl: Element;
    _frameEl: Element;
    _bodyEl: Element;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The box for the message, next to the icon. `addChild()` adds to it too.
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
     * The image showing the icon of the message type.
     *
     * @type {Image}
     */
    get image(): Image;
    /**
     * Adds a widget to the content area.
     *
     * @param {Widget} widget
     * @returns {Widget}
     */
    addChild(widget: Widget): Widget;
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
    addButton(response: string, label?: string | Button): Widget;
    /**
     * Adds buttons, as `[response, label]` pairs or response ids.
     *
     * @param {...([string, string?] | string)} buttons
     */
    addButtons(...buttons: ([string, string?] | string)[]): void;
    /**
     * Adds a widget to the action area for a response. Buttons emit the response when
     * activated.
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
     * Makes the button of a response sensitive or not.
     *
     * @param {string} response
     * @param {boolean} sensitive
     */
    setResponseSensitive(response: string, sensitive: boolean): void;
    /**
     * Gives a response: emits `response`.
     *
     * @param {string} response
     */
    response(response: string): void;
    destroy(): void;
    _getFocusChain(): Widget[];
    _computeExpand(direction: any): boolean;
    _syncMessageType(): void;
    _syncActionArea(): void;
    _syncRevealed(): void;
    _finishTransition(): void;
}
export declare namespace InfoBar {
    var builderProperties: {
        /**
         * Adds buttons: an array of `[response, label]` pairs, response ids, or objects with a
         * `response` and further button properties (such as `label`), like a dialog's.
         *
         * @param {object} builder
         * @param {InfoBar} infoBar
         * @param {Array<string | [string, string?] | {response: string}>} buttons
         */
        buttons(builder: object, infoBar: InfoBar, buttons: Array<string | [string, string?] | {
            response: string;
        }>): void;
    };
}

/** The declared properties of {@link InfoBar}. */
export interface InfoBar {
    /**
     * The child of an info bar is its content: setting it replaces the content area's children.
     */
    child: any;
    /**
     * The kind of message: one of `MessageType`, which selects the icon and the colors.
     */
    messageType: any;
    /**
     * Whether a close button is shown at the end, which gives the response `Response.CLOSE`.
     */
    showCloseButton: boolean;
    /**
     * Whether the info bar is shown. Changing it slides the bar open or closed.
     */
    revealed: boolean;
}
