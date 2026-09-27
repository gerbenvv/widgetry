/**
 * @module widgets/check-tool-item
 */
import { CheckMenuItem } from './check-menu-item.js';
import { ToolItem } from './tool-item.js';
/**
 * A tool item that toggles between active (drawn pressed) and inactive when activated.
 *
 * Signals: `activate` (`item`) when the user activates the item (a click, Space or Enter, or its
 * proxy in the overflow menu of the tool bar) or `activate()` is called, after it toggled;
 * `toggle` (`item`) and `active-change` on every change of `active`, also from code.
 */
export declare class CheckToolItem extends ToolItem {
    _initialize(): void;
    /**
     * Activates the item, as the user does: toggles `active` and emits `activate`. Does nothing if
     * it is insensitive.
     *
     * @returns {boolean} Whether the item was activated.
     */
    activate(): boolean;
    /**
     * Changes `active` for an activation. Radio items override this.
     *
     * @protected
     */
    protected _toggleOnActivate(): void;
    _createMenuProxy(): CheckMenuItem;
    _updateActiveState(): void;
}

/** The declared properties of {@link CheckToolItem}. */
export interface CheckToolItem {
    /**
     * Whether the item is active (checked), which draws it pressed.
     */
    active: boolean;
}
