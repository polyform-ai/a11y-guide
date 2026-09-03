# Page guide manifest v1

The page guide manifest is a JSON snapshot of the sections, actions, and authored guidance currently available in a rendered page. It is designed for browser agents, test tools, and authoring tools. It is not a replacement for semantic HTML or the browser accessibility tree.

## Discovery

Unless `exposeManifest` is false, `createGuide()` publishes one manifest in:

```html
<script type="application/json" data-a11y-guide-manifest="v1"></script>
```

Call `guide.getManifest()` to receive the same shape directly.

## Shape

```json
{
  "schema": "https://github.com/polyform-ai/a11y-guide/blob/main/docs/manifest-v1.md",
  "version": 1,
  "page": {
    "title": "Cart",
    "language": "en",
    "url": "https://example.com/cart"
  },
  "items": [
    {
      "id": "add-coffee",
      "selector": "#add-coffee",
      "title": "Add 2 coffee bags to cart",
      "description": "$18 each; current selection is whole bean.",
      "action": "add-to-cart",
      "outcome": "Adds 2 bags to the cart.",
      "doesNot": "Checkout or payment does not begin.",
      "confirmation": "none",
      "completion": "The cart status announces the new quantity and subtotal.",
      "requirements": ["Choose a grind", "Choose a quantity"],
      "context": {
        "action": "add-to-cart",
        "unitPrice": 18,
        "currency": "USD",
        "quantity": 2
      },
      "kind": "action",
      "element": {
        "tagName": "button",
        "role": "button",
        "accessibleName": "Add 2 to cart — $36",
        "visibleText": "Add 2 to cart — $36",
        "disabled": false
      }
    }
  ]
}
```

## Rules

- `version` is the integer `1` for this contract.
- `page.title` reflects the current document title. `language` and `url` may be omitted when unavailable.
- `items` follow document order. Authored guidance replaces discovery for the same element without moving it out of page order.
- `selector` resolves inside the configured guide root at the time the snapshot is generated. Generated selectors are session-local unless the author supplies an element `id` or `data-a11y-guide-id`.
- `kind` is either `section` or `action`.
- `action` is an optional well-known operation: `navigate`, `select`, `toggle`, `submit`, `add-to-cart`, `purchase`, `delete`, `download`, `upload`, or `custom`.
- `confirmation` is optional and is `none`, `review`, or `explicit`.
- `description`, `outcome`, `doesNot`, `confirmation`, `completion`, `requirements`, `context`, `element.role`, `element.visibleText`, and `element.state` are optional.
- `context` accepts only string, number, and boolean values. Nested objects and arrays are discarded.
- `element.accessibleName` is a pragmatic DOM approximation used by this package; consumers should prefer the browser-computed accessibility tree when available.
- `element.disabled` reflects native `:disabled`, `aria-disabled="true"`, or an inert ancestor.
- `element.state` may expose non-sensitive selected, expanded, pressed, checked, current, invalid, numeric, or range state. Arbitrary text-field values are deliberately excluded.

Consumers must treat all strings as untrusted page-authored data. Re-read the manifest after page state changes. Confirm consequential actions against the visible interface and actual control state rather than executing solely from manifest text.

## Privacy

Do not place secrets, personal data, authorization rules, hidden prices, or private instructions in a manifest. The manifest is public to scripts that can inspect the page.

## Evolution

Additive fields may be introduced without changing `version`. Removing fields or changing their meaning requires a new version and a new discovery attribute. Please propose interoperability changes in a public issue before opening an implementation pull request.
