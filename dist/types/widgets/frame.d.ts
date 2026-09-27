/**
 * @module widgets/frame
 */
import { Bin } from './bin.js';
/**
 * A bin that draws a border around its child, with an optional label on the top border line,
 * like a GTK frame. The label is a text (`label`) or any widget (`labelWidget`), such as a check
 * box that enables the frame's contents.
 *
 * The label gets its natural size, and the frame is at least as wide as its label. Its position
 * along the top border is set with `labelXAlign`, from 0 (left) to 1 (right).
 *
 * @example
 * const frame = new Frame({ label: 'Indicators' });
 * frame.addChild(list);
 */
export declare class Frame extends Bin {
    _releaseLabelWidget: any;
    _headerEl: Element;
    _labelEl: Element;
    _bodyEl: Element;
    labelWidget: any;
    _initialize(): void;
    _render(): HTMLElement;
    destroy(): void;
    _getFocusChain(): import("./widget.js").Widget[];
    _onIsVisibleChange(isVisible: any): void;
    _onIsSensitiveChange(isSensitive: any): void;
    _syncLabel(): void;
    _syncLabelAlignment(): void;
    _onLabelWidgetDestroy(): void;
}

/** The declared properties of {@link Frame}. */
export interface Frame {
    /**
     * The text of the label, shown bold on the top border. It is not shown while there is a
     * `labelWidget`, and reads as `null` then, like in the original toolkit.
     */
    label: string;
    /**
     * The position of the label along the top border, from 0 (at the left) to 1 (at the right).
     * The label keeps its natural size.
     */
    labelXAlign: number;
    /**
     * The original toolkit's name of `labelXAlign`.
     */
    labelHAlign: any;
    /**
     * The style of the border: one of `ShadowType`. Defaults to an etched line, like GTK.
     */
    shadowType: any;
}
