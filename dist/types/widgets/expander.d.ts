/**
 * @module widgets/expander
 */
import { Bin } from './bin.js';
/**
 * A bin that shows or hides its child when its title is clicked, with a triangle that points
 * right when collapsed and down when expanded, like GTK's expander.
 *
 * The title is a text (`label`) or any widget (`labelWidget`). The title takes the keyboard
 * focus; Enter and Space toggle it.
 *
 * Signals: `activate` when the user toggles the expander (or `activate()` is called), and
 * `expanded-change`.
 */
export declare class Expander extends Bin {
    _releaseLabelWidget: any;
    _headerEl: Element;
    _labelEl: Element;
    _bodyEl: Element;
    expanded: boolean;
    labelWidget: any;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The title, which takes the keyboard focus.
     *
     * @type {HTMLElement}
     */
    get focusElement(): HTMLElement;
    /**
     * Toggles the expander, as a click on its title does, and emits `activate`.
     */
    activate(): void;
    destroy(): void;
    _getFocusChain(): import("./widget.js").Widget[];
    _computeExpand(direction: any): boolean;
    _onIsVisibleChange(isVisible: any): void;
    _onIsSensitiveChange(isSensitive: any): void;
    _syncExpanded(): void;
    _syncSpacing(): void;
    _onHeaderClick(event: any): void;
    _onHeaderKeyDown(event: any): void;
    _onLabelWidgetDestroy(): void;
}

/** The declared properties of {@link Expander}. */
export interface Expander {
    /**
     * Expanders take the keyboard focus on their title.
     */
    canFocus: any;
    /**
     * The text of the title. It is not shown while there is a `labelWidget`, and reads as `null`
     * then.
     */
    label: string;
    /**
     * The space between the title and the child, in pixels.
     */
    spacing: number;
}
