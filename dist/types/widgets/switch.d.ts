/**
 * @module widgets/switch
 */
import { Widget } from './widget.js';
/**
 * An on/off switch, like GTK 3's: a sunken trough with a raised slider that sits at the left when
 * off and at the right when on, where the trough is filled with the accent color. The uncovered
 * half shows a symbol for the state.
 *
 * Clicking the switch toggles it, and so does dragging the slider past the middle. Space and
 * Enter toggle it while it has the focus, and so does its mnemonic (as the `mnemonicWidget` of a
 * label).
 *
 * When the user toggles the switch, `state-set` (`switch, state`) is emitted with the new state
 * before `active` changes. A handler that returns `true` vetoes the change, as in GTK: `active`
 * keeps its value, and the handler may set it later itself, for example once a slow operation
 * finished. Setting `active` from code does not emit `state-set`.
 *
 * Signals: `state-set` (`switch, state`), `activate` (`switch`) when the user toggled it, and
 * `active-change`.
 *
 * @example
 * const wifi = new Switch({ active: true });
 * wifi.connect('state-set', (_switch, state) => {
 *     enableWifi(state);
 * });
 */
export declare class Switch extends Widget {
    _drag: {
        pointerId: any;
        startX: any;
        startLeft: number;
        range: number;
        dragging: boolean;
    };
    _sliderEl: Element;
    active: boolean;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Toggles the switch as if the user clicked it: emits `state-set`, and changes `active` unless
     * a handler vetoed it.
     *
     * @returns {boolean} Whether `active` changed.
     */
    activate(): boolean;
    /**
     * Asks for a new state on behalf of the user, as described for `state-set`.
     *
     * @protected
     * @param {boolean} state
     * @returns {boolean} Whether `active` changed.
     */
    protected _requestState(state: boolean): boolean;
    /**
     * Focuses and toggles the switch for its mnemonic, or only focuses it when other widgets share
     * the mnemonic.
     *
     * @protected
     * @param {boolean} groupCycling
     */
    protected _mnemonicActivate(groupCycling: boolean): void;
    /**
     * Updates the state classes, the accessible state and the slider position.
     *
     * @protected
     */
    protected _updateState(): void;
    _onPointerDown(event: any): void;
    _onPointerMove(event: any): void;
    _onPointerUp(event: any, released: any): void;
    _onKeyDown(event: any): void;
}

/** The declared properties of {@link Switch}. */
export interface Switch {
    canFocus: any;
    hAlign: any;
    vAlign: any;
}
