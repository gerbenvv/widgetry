/**
 * Enumerations shared across widgets.
 *
 * @module core/enums
 */
/**
 * Orientation of boxes, separators, sliders and the like.
 *
 * @enum {string}
 */
export declare const Orientation: Readonly<{
    HORIZONTAL: "horizontal";
    VERTICAL: "vertical";
}>;
/**
 * How a widget uses the space its parent allocates to it along one axis.
 *
 * @enum {string}
 */
export declare const Align: Readonly<{
    FILL: "fill";
    START: "start";
    CENTER: "center";
    END: "end";
}>;
/**
 * Alignment of text within its box.
 *
 * @enum {string}
 */
export declare const Justification: Readonly<{
    START: "start";
    END: "end";
    CENTER: "center";
    FILL: "fill";
}>;
/**
 * How text that does not fit is shortened.
 *
 * @enum {string}
 */
export declare const EllipsizeMode: Readonly<{
    NONE: "none";
    START: "start";
    MIDDLE: "middle";
    END: "end";
}>;
/**
 * Label text styles, as a bit mask.
 *
 * @enum {number}
 */
export declare const LabelStyles: Readonly<{
    NORMAL: 0;
    BOLD: number;
    ITALIC: number;
    UNDERLINE: number;
    STRIKETHROUGH: number;
}>;
/**
 * Sorting order of models and table columns. It is also the sort indicator of table column headers.
 *
 * @enum {string}
 */
export declare const SortOrder: Readonly<{
    NONE: "none";
    ASCENDING: "ascending";
    DESCENDING: "descending";
}>;
/**
 * How the rows of tables, list boxes and selections can be selected, as in GTK.
 *
 * @enum {string}
 */
export declare const SelectionMode: Readonly<{
    NONE: "none";
    SINGLE: "single";
    BROWSE: "browse";
    MULTIPLE: "multiple";
}>;
/**
 * Pointer cursor shapes.
 *
 * @enum {string}
 */
export declare const CursorShape: Readonly<{
    ARROW: "arrow";
    MOVE: "move";
    CROSSHAIR: "crosshair";
    WAIT: "wait";
    BUSY: "busy";
    TEXT: "text";
    HELP: "help";
    POINTING_HAND: "pointing-hand";
    OPEN_HAND: "open-hand";
    CLOSED_HAND: "closed-hand";
    NO_DROP: "no-drop";
    COPY: "copy";
    ALIAS: "alias";
    RESIZE_N: "resize-n";
    RESIZE_NE: "resize-ne";
    RESIZE_E: "resize-e";
    RESIZE_SE: "resize-se";
    RESIZE_S: "resize-s";
    RESIZE_SW: "resize-sw";
    RESIZE_W: "resize-w";
    RESIZE_NW: "resize-nw";
    RESIZE_H: "resize-h";
    RESIZE_V: "resize-v";
}>;
/**
 * Frame and scroll area border styles.
 *
 * @enum {string}
 */
export declare const ShadowType: Readonly<{
    NONE: "none";
    IN: "in";
    OUT: "out";
    ETCHED_IN: "etched-in";
    ETCHED_OUT: "etched-out";
}>;
/**
 * Scroll bar visibility policies.
 *
 * @enum {string}
 */
export declare const Policy: Readonly<{
    ALWAYS: "always";
    AUTOMATIC: "automatic";
    NEVER: "never";
}>;
/**
 * Button box layout styles.
 *
 * @enum {string}
 */
export declare const ButtonBoxStyle: Readonly<{
    SPREAD: "spread";
    EDGE: "edge";
    START: "start";
    END: "end";
    CENTER: "center";
}>;
/**
 * Directions in which keyboard focus can move.
 *
 * @enum {string}
 */
export declare const FocusDirection: Readonly<{
    START: "start";
    END: "end";
    FORWARD: "forward";
    BACKWARD: "backward";
}>;
/**
 * Resize directions, as a bit mask.
 *
 * @enum {number}
 */
export declare const ResizeDirections: Readonly<{
    NONE: 0;
    HORIZONTAL: number;
    VERTICAL: number;
    ALL: number;
}>;
/**
 * Where something is placed relative to something else, e.g. notebook tabs or popups.
 *
 * @enum {string}
 */
export declare const Position: Readonly<{
    TOP: "top";
    RIGHT: "right";
    BOTTOM: "bottom";
    LEFT: "left";
}>;
/**
 * Standard dialog responses.
 *
 * @enum {string}
 */
export declare const Response: Readonly<{
    NONE: "none";
    OK: "ok";
    CANCEL: "cancel";
    CLOSE: "close";
    YES: "yes";
    NO: "no";
    APPLY: "apply";
    HELP: "help";
}>;
/**
 * Tool bar item display styles.
 *
 * @enum {string}
 */
export declare const ToolBarStyle: Readonly<{
    ICONS: "icons";
    TEXT: "text";
    BOTH: "both";
    BOTH_HORIZONTAL: "both-horizontal";
}>;
