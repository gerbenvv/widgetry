/**
 * @module widgets/check-tool-item
 */
import { CheckMenuItem } from './check-menu-item.js';
import { ToolItem } from './tool-item.js';
/**
 * A tool item that toggles between active (drawn pressed) and inactive when activated.
 *
 * Signals: `activate` (when activated, after toggling) and `toggle` (whenever `active` changes).
 */
export declare class CheckToolItem extends ToolItem {
    active: boolean;
    _initialize(): void;
    /**
     * Activates the item: toggles it and emits `activate`. Does nothing if it is insensitive.
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

}
