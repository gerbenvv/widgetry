/**
 * @module widgets/tooltip
 */
import { Bin } from './bin.js';
/**
 * Where tooltips are placed.
 *
 * @enum {string}
 */
export declare const TooltipPlacement: Readonly<{
    POINTER: "pointer";
    WIDGET: "widget";
}>;
/**
 * A small popup with a hint about a widget, shown when the pointer rests on the widget.
 *
 * Widgets create their tooltip when `tooltipLabel` is set, and call `appearAt()` when the pointer
 * enters, `follow()` when it moves and `disappear()` when it leaves or presses. The tooltip
 * appears after `appearDelay` (by default `settings.tooltipAppearDelay`) of the pointer resting,
 * below the pointer (or below the widget), and disappears after `disappearDelay`. Only one
 * tooltip is shown at a time, and while one is shown (or just disappeared), moving to another
 * widget shows that widget's tooltip right away. Pressing a key or scrolling hides it.
 *
 * The tooltip shows its `label`, or a custom widget set as `content`. It describes its widget for
 * assistive technology (`aria-describedby`).
 */
export declare class Tooltip extends Bin {
    /** @type {import('./widget.js').Widget | null} */
    _widget: import('./widget.js').Widget | null;
    _pointer: {
        x: any;
        y: any;
    };
    _appearTimer: number;
    _disappearTimer: number;
    _listening: any;
    _onDocumentEvent: () => void;
    _labelEl: Element;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * The tooltip that is currently shown, or `null`.
     *
     * @type {Tooltip | null}
     */
    static get shown(): Tooltip | null;
    /**
     * Makes the tooltip appear for a widget after the delay, or right away when another tooltip is
     * shown or just disappeared.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {PointerEvent | MouseEvent} [event] The pointer event, for placing the tooltip at the
     *     pointer.
     */
    appearAt(widget: import('./widget.js').Widget, event?: PointerEvent | MouseEvent): void;
    /**
     * Follows the pointer moving over the widget: while the tooltip waits to appear, the pointer
     * must rest again for the full delay; once shown, it moves along if `followPointer` is set.
     *
     * @param {import('./widget.js').Widget} widget
     * @param {PointerEvent | MouseEvent} [event]
     */
    follow(widget: import('./widget.js').Widget, event?: PointerEvent | MouseEvent): void;
    /**
     * Makes the tooltip disappear after `disappearDelay`, and cancels a pending appearance.
     */
    disappear(): void;
    /**
     * Destroys the tooltip, removing it from the screen and from its widget's description.
     */
    destroy(): void;
    _appear(): void;
    _disappearNow(): void;
    _listen(listen: any): void;
    _updatePointer(event: any): void;
    _setWidget(widget: any): void;
    _onVisibleChange(visible: any): void;
    _place(): void;
    _updateContent(): void;
    _onChildrenChange(): void;
}

/** The declared properties of {@link Tooltip}. */
export interface Tooltip {
    readonly isTopLevel: any;
    visible: boolean;
    /**
     * The text of the tooltip.
     */
    label: string;
    /**
     * A custom widget shown instead of the label, or `null`. The same as `child`.
     */
    content: any;
    /**
     * The widget the tooltip was last shown (or asked to appear) for, or `null`.
     */
    readonly widget: any;
    /**
     * The delay in milliseconds before the tooltip appears, or -1 for the default
     * (`settings.tooltipAppearDelay`).
     */
    appearDelay: any;
    /**
     * The delay in milliseconds before the tooltip disappears, or -1 for the default
     * (`settings.tooltipDisappearDelay`).
     */
    disappearDelay: any;
    /**
     * Where the tooltip appears: one of `TooltipPlacement`.
     */
    placement: any;
    /**
     * Whether a shown tooltip moves along with the pointer.
     */
    followPointer: any;
    /**
     * The position of the shown tooltip in viewport coordinates, as `{x, y}`. Setting it pins the
     * tooltip there (kept on screen); set `null` to place it automatically again.
     */
    position: any;
    /**
     * The x position of the tooltip. Does not signal.
     */
    x: any;
    /**
     * The y position of the tooltip. Does not signal.
     */
    y: any;
}
