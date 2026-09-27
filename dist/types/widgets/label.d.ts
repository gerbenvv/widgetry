/**
 * @module widgets/label
 */
import { Widget } from './widget.js';
/**
 * Activates the mnemonic of a key in a window, as pressing Alt and the key does: the widget of
 * the label with that mnemonic is activated (a button is clicked) or focused. When several
 * labels share the mnemonic, each press focuses the next of their widgets instead.
 *
 * @param {import('./abstract-window.js').AbstractWindow} window
 * @param {string} key A single character.
 * @returns {boolean} Whether a mnemonic was activated.
 */
export declare function activateMnemonic(window: import('./abstract-window.js').AbstractWindow, key: string): boolean;
/**
 * A widget that shows a small to medium amount of text, most often to label another widget.
 *
 * Labels keep their natural size by default: they are aligned at the start horizontally and
 * centered vertically (`hAlign` is `START`, `vAlign` is `CENTER`), like a GTK label with an
 * `xalign` of 0. Set `hAlign` to `FILL` to give the label all horizontal space, and `justify` to
 * align the lines of its text within it. Spaces and newlines in the text are kept.
 *
 * With `useMarkup`, the text may contain a small set of formatting tags: `b`, `strong`, `i`,
 * `em`, `u`, `s`, `strike`, `del`, `ins`, `small`, `big`, `sub`, `sup`, `tt`, `code`, `mark`,
 * `br` and `span` (whose `class` attribute is kept, for style classes). Other tags are shown as
 * text and attributes are dropped, so markup is safe to use with untrusted text as long as the
 * text parts are escaped. Character references such as `&amp;` are allowed.
 *
 * With `useUnderline`, an underscore marks the next character as the mnemonic (`'_File'`), which
 * is underlined; `'__'` is a literal underscore. Pressing Alt and the mnemonic key activates the
 * `mnemonicWidget`, or the nearest ancestor that handles mnemonics, like a button.
 *
 * Add the style class `dim-label` for secondary, dimmed text.
 */
export declare class Label extends Widget {
    _id: string;
    _mnemonicKey: any;
    _mnemonicWidgetDisconnect: any;
    _initialize(): void;
    _render(): HTMLElement;
    destroy(): void;
    _applyLayoutStyle(): void;
    /**
     * Returns the widget the mnemonic activates: the mnemonic widget, or the nearest ancestor
     * that handles mnemonics.
     *
     * @protected
     * @returns {Widget | null}
     */
    protected _getMnemonicTarget(): Widget | null;
    _renderContent(): void;
    _applyStyles(): void;
    _applyEllipsize(): void;
    _applyLines(): void;
    _applyWidthChars(): void;
    _linkMnemonicWidget(widget: any): void;
    _unlinkMnemonicWidget(widget: any): void;
}

/** The declared properties of {@link Label}. */
export interface Label {
    /**
     * The text of the label. With `useMarkup` it is markup, with `useUnderline` underscores mark
     * the mnemonic.
     */
    text: string;
    /**
     * The same as `text`, following GTK's name.
     */
    label: string;
    /**
     * Whether the text is markup with a small set of formatting tags (see the class
     * description).
     */
    useMarkup: boolean;
    /**
     * The same as `useMarkup`, following the original toolkit's name.
     */
    enableMarkup: boolean;
    /**
     * Whether an underscore in the text marks the next character as the mnemonic.
     */
    useUnderline: boolean;
    /**
     * The mnemonic key (lowercase), or `''` if the label has no mnemonic.
     */
    readonly mnemonicKey: any;
    /**
     * The widget the mnemonic activates, or `null` for the nearest ancestor that handles
     * mnemonics (such as a button). The label also becomes the accessible label of the widget.
     */
    mnemonicWidget: any;
    /**
     * The text styles: a mask of `LabelStyles`.
     */
    styles: number;
    /**
     * How the lines of the text are aligned relative to each other: one of `Justification`.
     */
    justify: string;
    /**
     * Whether the text wraps at word boundaries when it does not fit. A wrapping label's natural
     * width is limited (see `maxWidthChars`), unless it fills its space.
     */
    wrap: boolean;
    /**
     * How the text is shortened with an ellipsis when it does not fit: one of `EllipsizeMode`.
     * An ellipsizing label can shrink below its natural width. Middle ellipsizing needs plain
     * text; markup is ellipsized at the end instead.
     */
    ellipsize: string;
    /**
     * The maximum number of lines of a wrapping, ellipsizing label, or -1 for no limit.
     */
    lines: number;
    /**
     * Whether the user can select the text, e.g. to copy it.
     */
    selectable: boolean;
    /**
     * The minimum width in characters, or -1 for the natural width.
     */
    widthChars: number;
    /**
     * The maximum natural width in characters, or -1 for no limit (a wrapping label is limited
     * to about 60 characters then).
     */
    maxWidthChars: number;
}
