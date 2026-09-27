/**
 * @module widgets/toggle-button
 */
import { Button } from './button.js';
import { ButtonGroup } from './button-group.js';
/**
 * A button that stays pressed when clicked (`active`), and is released by clicking again.
 *
 * Toggle buttons can be put in a `ButtonGroup`, of which at most one is active at a time. The
 * group is created lazily: a toggle button has none until `group` is set or `join()` is called.
 *
 * `inconsistent` shows a third, "mixed" state, e.g. for a setting that applies to only some of
 * the selected items. Clicking the button clears it.
 *
 * Signals: `toggle` (`button`) on every change of `active`, `activate` when it becomes active and
 * `deactivate` when it becomes inactive (like the original toolkit), and `clicked` after a click.
 */
export declare class ToggleButton extends Button {
    active: boolean;
    group: ButtonGroup;
    inconsistent: boolean;
    _initialize(): void;
    _render(): HTMLElement;
    /**
     * Makes the button active. The same as setting `active` to `true`.
     */
    activate(): void;
    /**
     * Makes the button inactive. The same as setting `active` to `false`.
     */
    deactivate(): void;
    /**
     * Toggles the button.
     */
    toggle(): void;
    /**
     * Adds another button to the group of this button, creating the group if needed. The same as
     * `other.group = button.group` once the button has a group.
     *
     * @param {ToggleButton} button Any button with `active` and `group`, such as a radio menu
     *     item.
     */
    join(button: ToggleButton): void;
    _onClicked(): void;
    /**
     * Updates the state classes and the accessible state.
     *
     * @protected
     */
    protected _updateState(): void;
    /**
     * Sets the accessible toggle state.
     *
     * @protected
     * @param {'true' | 'false' | 'mixed'} state
     */
    protected _setAccessibleState(state: 'true' | 'false' | 'mixed'): void;
    /**
     * Called after `group` changed.
     *
     * @protected
     * @param {ButtonGroup | null} _old
     * @param {ButtonGroup | null} _group
     */
    protected _onGroupChange(_old: ButtonGroup | null, _group: ButtonGroup | null): void;
}

/** The declared properties of {@link ToggleButton}. */
export interface ToggleButton {

}
