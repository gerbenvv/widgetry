/**
 * @module widgets/radio-button
 */
import { CheckBox } from './check-box.js';
/**
 * A radio button: one choice of a group of radio buttons (see `group` and `join()`), of which
 * one is active. Clicking a radio button activates it; clicking it again does not deactivate it.
 *
 * Like on the desktop, a group is a single stop in the focus chain: Tab moves the focus to the
 * active radio button (or to every button while none is active), and the arrow keys move the
 * focus to the previous or next button of the group and activate it.
 *
 * Signals: `activate` (`button`) when the user activates the button or `activate()` is called,
 * also when it already was active; `toggle` (`button`) and `active-change` on every change of
 * `active`, also from code (so both for the button that became active and for the one that became
 * inactive); and `clicked` (`button`) after a click.
 */
export declare class RadioButton extends CheckBox {
    _disconnectGroup: any;
    _mnemonicStop: any;
    _initialize(): void;
    _render(): HTMLElement;
    _setAccessibleState(_state: any): void;
    /**
     * Activates the button, as if the user clicked it: clears `inconsistent`, makes the button
     * active (a radio button never deactivates itself) and emits `activate`.
     */
    activate(): void;
    _onClicked(): void;
    /**
     * Activates the button for its mnemonic. When other widgets share the mnemonic, the button
     * only takes the focus, also when it is not the group's stop in the focus chain; it stays a
     * stop until the focus leaves it.
     *
     * @protected
     * @param {boolean} groupCycling
     */
    protected _mnemonicActivate(groupCycling: boolean): void;
    _setMnemonicStop(stop: any): void;
    _onGroupChange(old: any, group: any): void;
    _updateGroupFocus(group: any): void;
    /**
     * Whether the button is the group's stop in the focus chain.
     *
     * @protected
     * @returns {boolean}
     */
    protected _isFocusStop(): boolean;
    _onIsVisibleChange(isVisible: any): void;
    _onIsSensitiveChange(isSensitive: any): void;
    _updateTabIndex(): void;
    _onKeyDown(event: any): void;
    destroy(): void;
}

/** The declared properties of {@link RadioButton}. */
export interface RadioButton {
    /**
     * Whether the button can take the focus. Within a group, only the active button can (see
     * the class description).
     */
    canFocus: any;
}
