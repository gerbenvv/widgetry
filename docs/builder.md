# The builder

`Builder` (`src/construction/builder.js`) builds objects (widget trees, models, validators and so
on) from plain objects, arrays or JSON. Types are looked up in the registry
(`src/core/registry.js`), where each widget module registers its classes when it is imported. The
builder imports no widgets, so import the modules of the types you use first.

```js
import { Builder } from './src/construction/builder.js';
import './src/widgets/window.js';
import './src/widgets/box.js';
import './src/widgets/button.js';

const builder = new Builder();
const [window] = builder.build({
    type: 'window',
    title: 'Hello',
    child: {
        type: 'box',
        orientation: 'vertical',
        spacing: 6,
        children: [
            { type: 'label', id: 'message', text: 'Hello, world!' },
            { type: 'button', label: 'Close', handlers: { activate() { window.close(); } } },
        ],
    },
});

builder.getObjectById('message').text = 'Goodbye!';
```

## API

- `build(input)` builds a description, an array of descriptions (nested arrays are flattened) or a
  JSON string of either, and returns the root objects.
- `buildOne(input)` builds exactly one object and returns it.
- `objects` holds the root objects of all builds so far.
- `getObjectById(id)` returns an object by id and throws if there is none; `hasObject(id)` checks.
- `buildValue(value)` builds a value like a property value, for builder property hooks.
- `scope` is an object with handler functions, for handlers given by name.
- `build(input, options)`, the function, builds with a new builder.

Errors are `BuilderError`s whose message starts with the path of the offending object, e.g.
`(window).child(box).children[1](button #close): 'button' has no property named 'lable'.` The
original error, if any, is the `cause`. The ids of a failed build are forgotten.

## Descriptions

A description is an object with a `type` and optionally an `id`. The other keys are handled in
this order of precedence:

- **Builder properties** of the class: static `builderProperties` hooks, looked up along the class
  hierarchy (the most derived class wins). They run after the normal properties, in input order,
  as `hook(builder, instance, value)` with the value as given (not built).
- **`handlers`**: `{ signal: handler }`. Each handler is connected with the object as `this`. A
  string handler is looked up in the builder's `scope`, which is how JSON connects handlers.
- **Properties**: writable properties, set together with `instance.set()`, so late properties such
  as `visible` are set last. Names may be camelCase or kebab-case.
- **`children`** of an object with `addChild()`: each child is built and added in order.
- **`child`** of an object without a writable `child` property: built and added with `addChild()`.
  Bins have a `child` property, which is set.

Other keys are errors for `Instance` classes. For plain classes they are assigned.

## Values

Property values are built recursively:

- A plain object with a `type` becomes an object: `adjustment: { type: 'adjustment', upper: 10 }`.
- `{ id: '...' }` (with no other keys) is a reference to the object with that id. It may refer to
  an object built later in the same `build()` call; the property is then set at the end.
- Arrays and other plain objects are built element by element.
- Everything else, including existing objects, is used as it is. `undefined` becomes `null`.

Existing instances can also be given where descriptions are expected, e.g. as children, and so can
references to objects built before:

```js
builder.build([
    { type: 'radio-button', id: 'small', label: 'Small' },
    { type: 'radio-button', id: 'large', label: 'Large' },
    { type: 'button-group', buttons: [{ id: 'small' }, { id: 'large' }] },
]);
```

## Factories

Classes whose constructor does not take a property object are registered with a factory:

```js
registerType('matrix', Matrix, (properties, builder) => new Matrix(properties.m11, properties.m12));
```

The factory gets the built values of the normal keys, by camelCase name (so they cannot refer to
objects built later). Builder properties, handlers and children are applied to its result as usual.

## Builder properties

A class defines its special keys as static `builderProperties`. Hooks that build nested
descriptions use `builder.build()` or `builder.buildOne()`, which keeps the error path:

```js
Grid.builderProperties = {
    children(builder, grid, children) {
        if (!Array.isArray(children)) {
            throw new Error('Grid children must be an array.');
        }

        for (const { row, column, rowSpan, columnSpan, ...child } of children) {
            grid.addChild(builder.buildOne(child), row, column, rowSpan, columnSpan);
        }
    },
};
```

The original toolkit had these special keys, which the widget modules define:

| Class          | Key        | Handling                                                                            |
| -------------- | ---------- | ----------------------------------------------------------------------------------- |
| `Fixed`        | `children` | Each child may have `x` and `y`: `fixed.addChild(child, x, y)`.                     |
| `Paned`        | `children` | Each child may have `resize`: `paned.addChild(child, resize)`.                      |
| `Grid`         | `children` | `row`, `column`, `rowSpan` and `columnSpan` (originally `row-span` and `col-span`). |
| `VectorCanvas` | `sprites`  | Sprite descriptions, added with `canvas.addSprite()`.                               |
| `ButtonGroup`  | `buttons`  | Buttons or references, added with `group.addButton()`.                              |
| `Dialog`       | `buttons`  | Buttons, added with `dialog.addButton()`.                                           |
| `Table`        | `columns`  | Column descriptions, added with `table.addColumn()`.                                |

## JSON

JSON input works the same way, with handlers given by name:

```json
{
    "type": "button",
    "label": "Open",
    "handlers": { "activate": "onOpen" }
}
```

```js
new Builder({ scope: { onOpen() { openFile(); } } }).build(json);
```
