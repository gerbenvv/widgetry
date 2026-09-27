/**
 * @module widgets/button
 */
import { Bin } from './bin.js';
import { Image } from './image.js';
import { Label } from './label.js';
/**
 * Button relief styles: whether the button's frame is drawn.
 *
 * @enum {string}
 */
export declare const Relief: Readonly<{
    NORMAL: "normal";
    NONE: "none";
}>;
/**
 * A push button. It holds one child, usually made from `label` and `icon`, and emits `activate`
 * when clicked: when the primary pointer button is released over it, when Space is released or
 * when Enter is pressed while it has the focus, or when its mnemonic is pressed.
 *
 * Setting `label`, `icon` or `useUnderline` creates the child: a label, an image, or both in a
 * box. When the child was set explicitly instead, `label` changes the text of a label child and
 * leaves other children alone.
 *
 * A button with `isDefault` is the default button of its window, as in dialogs: it gets a
 * stronger frame, and Enter activates it when the focus widget does not use Enter itself.
 * Widgets that handle Enter prevent the default of the key event, which keeps the default button
 * from activating; Enter in multi-line text never activates it.
 *
 * Signals: `activate` (`button`), and `clicked` (`button`), emitted after every click, also for
 * toggle buttons.
 */
export declare class Button extends Bin {
    _content: Image | Label;
    _contentKey: string;
    _labelWidget: Label;
    _imageWidget: Image;
    _ownImage: Image;
    _givenImage: any;
    _behavior: import("./button-behavior.js").ButtonBehavior;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Activates the button, as if it was clicked: emits `activate`.
     */
    activate(): void;
    /**
     * Clicks the button: activates it and emits `clicked`. Called by the pointer, keyboard,
     * mnemonic and default-button handling.
     *
     * @protected
     */
    protected _click(): void;
    /**
     * What a click does. Toggle buttons override this to toggle.
     *
     * @protected
     */
    protected _onClicked(): void;
    /**
     * Activates the button for its mnemonic: clicks it, or only focuses it when other widgets
     * share the mnemonic.
     *
     * @protected
     * @param {boolean} groupCycling Whether several widgets share the mnemonic.
     */
    protected _mnemonicActivate(groupCycling: boolean): void;
    destroy(): void;
    /**
     * Returns the text for the label of the created child, or `''` for none.
     *
     * @protected
     * @returns {string}
     */
    protected _getContentLabel(): string;
    /**
     * Creates the label of the created child. Subclasses change its alignment.
     *
     * @protected
     * @returns {Label}
     */
    protected _createLabel(): Label;
    /**
     * Creates, updates or removes the child made from `label` and `icon`.
     *
     * @protected
     */
    protected _syncContent(): void;
    _updateContentParts(label: any, icon: any): void;
    _removeContent(): void;
    _onChildrenChange(): void;
    _setDefault(isDefault: any): void;
}

/** The declared properties of {@link Button}. */
export interface Button {
    /**
     * The text of the button's label, or `null`. Setting it creates a label child (next to the
     * image of `icon`) when the button has no child of its own. Reading it returns the text of a
     * label child, or `null` if there is none.
     */
    label: string | null;
    /**
     * The icon of the button: an icon name (see `Image#icon`), an `Image` widget, or `''` for
     * none. It is shown next to the label, see `imagePosition`.
     */
    icon: string;
    /**
     * Where the image is shown relative to the label: one of `Position`.
     */
    imagePosition: string;
    /**
     * Whether an underscore in `label` marks the mnemonic (`'_Open'`), which is underlined and
     * clicks the button with Alt.
     */
    useUnderline: boolean;
    /**
     * The relief style: one of `Relief`. Buttons with `Relief.NONE` are flat and show their frame
     * only while hovered or pressed, as in tool bars.
     */
    relief: string;
    /**
     * Whether this is the default button of its window, which Enter activates.
     */
    isDefault: boolean;
}
