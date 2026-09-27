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
 */
export declare class RadioButton extends CheckBox {
    _disconnectGroup: any;
    _initialize(): void;
    _render(): HTMLElement;
    _onClicked(): void;
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
