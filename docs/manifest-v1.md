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
      "outcome": "Adds 2 bags to the cart. Checkout does not begin.",
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
        "disabled": false
      }
    }
  ]
}
```

## Rules

- `version` is the integer `1` for this contract.
- `page.title` reflects the current document title. `language` and `url` may be omitted when unavailable.
- `items` are ordered as they appear in the guide. Authored items precede auto-discovered items in the current release.
- `selector` resolves inside the configured guide root at the time the snapshot is generated. Generated selectors are session-local unless the author supplies an element `id` or `data-a11y-guide-id`.
- `kind` is either `section` or `action`.
- `description`, `outcome`, `requirements`, `context`, and `element.role` are optional.
- `context` accepts only string, number, and boolean values. Nested objects and arrays are discarded.
- `element.disabled` reflects native `:disabled` or `aria-disabled="true"` state.

Consumers must treat all strings as untrusted page-authored data. Re-read the manifest after page state changes. Confirm consequential actions against the visible interface and actual control state rather than executing solely from manifest text.

## Privacy

Do not place secrets, personal data, authorization rules, hidden prices, or private instructions in a manifest. The manifest is public to scripts that can inspect the page.

## Evolution

Additive fields may be introduced without changing `version`. Removing fields or changing their meaning requires a new version and a new discovery attribute. Please propose interoperability changes in a public issue before opening an implementation pull request.
