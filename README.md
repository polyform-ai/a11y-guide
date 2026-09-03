# `@polyform-ai/a11y-guide`

[![CI](https://github.com/polyform-ai/a11y-guide/actions/workflows/ci.yml/badge.svg)](https://github.com/polyform-ai/a11y-guide/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Accessible, author-guided navigation for any website, plus a lightweight DOM auditor.

The package adds an optional **Page guide** that inventories meaningful sections and every available action, then lets a visitor jump directly to one. Authors can add plain-language guidance without replacing the browser's native semantics.

This is a small open-source experiment from Polyform. The goal is to discover, in public, which truthful page guidance helps people using assistive technology and browser agents. Real examples, prompt improvements, audit findings, and focused pull requests are especially welcome.

## What this package does

- Discovers landmarks, headings, links, buttons, form controls, summaries, and common custom-control roles.
- Presents them in a keyboard-operable, screen-reader-readable guide.
- Lets authors override titles and add explanations with HTML attributes or JavaScript configuration.
- Refreshes when client-rendered content, visibility, or selected states change.
- Provides a small, dependency-free audit API for high-signal DOM mistakes.
- Publishes a versioned JSON guide manifest that browser agents and test tools can inspect.
- Includes a development overlay that previews the actions and sections an agent can discover.
- Ships as modern ESM with TypeScript declarations and no runtime dependencies.

## What it deliberately does not do

It does **not** add roles, `tabindex`, or ARIA labels to every `<div>`. A layout `<div>` usually needs no accessibility metadata. Making every container focusable creates noise, breaks expected keyboard order, and can misrepresent the interface to assistive technology.

Use native HTML first: `<button>` for an action, `<a>` for navigation, `<main>` for primary content, and real headings for structure. Use this package to explain and navigate an already-semantic page, and to flag common gaps.

Automated checks cannot certify WCAG conformance. Combine them with keyboard, zoom, screen-reader, reduced-motion, forced-color, and user testing.

## Open source

This project is maintained by [Polyform](https://github.com/polyform-ai) and released under the [MIT License](LICENSE). Bug reports and focused contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## Install

```sh
npm install @polyform-ai/a11y-guide
```

The initial public API is versioned as `0.1.0`. Expect additive refinements as more human and browser-agent evaluations are contributed.

## Quick start

Run this only in the browser, after the document body exists:

```ts
import { createGuide } from '@polyform-ai/a11y-guide'

const guide = createGuide({
  label: 'Page guide',
  title: 'Explore this page',
  introduction: 'Jump to a section or move directly to any available action.',
})

// For SPA teardown:
guide.destroy()
```

Auto-discovery is on by default. The returned controller also provides `open()`, `close()`, `refresh()`, `goTo(id)`, and `getItems()`.

## Add useful author guidance

The smallest authoring surface is HTML:

```html
<section
  data-a11y-guide="Choose a starting point"
  data-a11y-guide-description="Each path leads to a different workflow."
>
  <h2>Ways to begin</h2>
  <!-- content -->
</section>
```

Use `data-a11y-guide-kind="action"` or `data-a11y-guide-kind="section"` only when auto-classification is not correct. Add `data-a11y-guide-id` when you need a stable target identifier and the element does not already have an `id`.

For an action, you can also describe the result, requirements, and a few structured facts:

```html
<button
  type="submit"
  data-a11y-guide="Add 2 coffee bags to cart"
  data-a11y-guide-description="$18 each; current selection is whole bean."
  data-a11y-guide-action="add-to-cart"
  data-a11y-guide-outcome="Adds 2 bags to the cart."
  data-a11y-guide-does-not="Checkout or payment does not begin."
  data-a11y-guide-requires="Choose a grind | Choose a quantity"
  data-a11y-guide-completion="The cart status announces the new quantity."
  data-a11y-guide-confirmation="none"
  data-a11y-guide-context='{"action":"add-to-cart","sku":"coffee-1kg","unitPrice":18,"currency":"USD","quantity":2}'
>
  Add 2 to cart — $36
</button>
```

Keep this information short, current, and non-sensitive. It supplements—never replaces—the visible label, native element, form label, accessible name, and actual disabled state.

Well-known `data-a11y-guide-action` values are `navigate`, `select`, `toggle`, `submit`, `add-to-cart`, `purchase`, `delete`, `download`, `upload`, and `custom`. Confirmation is `none`, `review`, or `explicit`. Purchase and deletion guidance should always provide an outcome, completion signal, and review or explicit-confirmation boundary.

For centralized or route-specific copy, pass authored steps:

```ts
const guide = createGuide({
  steps: [
    {
      id: 'main-content',
      selector: '#main-content',
      title: 'Main content',
      description: 'Skip repeated navigation and begin with this page.',
      kind: 'section',
    },
    {
      id: 'create-report',
      selector: '#create-report',
      title: 'Create a report',
      description: 'Starts a draft. Nothing is shared until you publish it.',
      kind: 'action',
    },
  ],
})
```

Authored guidance replaces the auto-discovered entry for the same element, so visitors do not see duplicates.

## Why this helps browser agents

Computer-use systems commonly work from pixels, semantic DOM or accessibility-tree information, and the results of prior actions. They perform better when an interface exposes:

- a native role and a name that matches visible text;
- stable targets and explicit form labels;
- current state such as selected quantity, disabled status, or cart total;
- the expected outcome before a consequential action;
- prerequisites and confirmation boundaries; and
- feedback after the state changes.

`@polyform-ai/a11y-guide` keeps those signals useful to people first, then publishes authored guidance as a machine-readable supplement. By default, `createGuide()` adds this snapshot to the page:

```html
<script type="application/json" data-a11y-guide-manifest="v1">
  { "version": 1, "page": { "title": "…" }, "items": [/* … */] }
</script>
```

Code can also call `guide.getManifest()`. Set `exposeManifest: false` if a site should keep the snapshot programmatic only. Never place secrets, hidden business rules, personal data, or instructions that conflict with the visible interface in guidance metadata.

The full field contract and consumer safety rules are in [Page guide manifest v1](docs/manifest-v1.md). For a repeatable browser-agent review, see [Testing a site with computer-use agents](docs/testing-with-agents.md).

## E-commerce pattern

Make the selection and consequence legible before the purchase action:

```html
<form id="coffee" data-a11y-guide="Configure your coffee">
  <h2>House coffee</h2>
  <p id="unit-price">$18 per 1 kg bag</p>

  <label for="grind">Grind</label>
  <select id="grind" name="grind" required>
    <option value="whole">Whole bean</option>
    <option value="filter">Filter</option>
  </select>

  <label for="quantity">Quantity</label>
  <input id="quantity" name="quantity" type="number" min="1" max="10" value="2">

  <button
    type="submit"
    aria-describedby="unit-price add-outcome"
    data-a11y-guide="Add selected coffee to cart"
    data-a11y-guide-action="add-to-cart"
    data-a11y-guide-outcome="Updates the cart with the selected coffee."
    data-a11y-guide-does-not="Payment does not begin."
    data-a11y-guide-requires="Choose a grind | Choose a quantity"
    data-a11y-guide-completion="The cart status announces the new quantity and subtotal."
    data-a11y-guide-confirmation="none"
    data-a11y-guide-context='{"action":"add-to-cart","unitPrice":18,"currency":"USD"}'
  >
    Add 2 to cart — $36
  </button>
  <p id="add-outcome">Adds the selected quantity. Checkout does not begin.</p>
  <p id="cart-status" aria-live="polite"></p>
</form>
```

Update the button's visible quantity and subtotal when the form changes. After activation, update the live status with the cart's new state. At checkout, name the payable total, shipping scope, and whether activation submits payment or merely opens a review step. For destructive, financial, or external side effects, use an explicit review or confirmation boundary.

## Inspect what an agent can discover

The optional inspector outlines actions in purple and sections in green, including authored outcomes and disabled state:

```ts
import { showGuideOverlay } from '@polyform-ai/a11y-guide/inspector'

const inspector = showGuideOverlay()

// Remove it when the review is finished.
inspector.destroy()
```

This is a development aid, not an exact accessibility-tree viewer and not a substitute for assistive-technology testing. A dedicated browser DevTools extension that combines this overlay, the browser accessibility tree, audit findings, and manifest editing is on the community roadmap.

## Audit a page

```ts
import { auditPage } from '@polyform-ai/a11y-guide/audit'

const findings = auditPage({
  steps: [
    { id: 'main', selector: '#main-content', title: 'Main content' },
  ],
})

for (const item of findings) {
  console.log(item.impact, item.rule, item.message, item.selector)
}
```

The built-in semantic audit currently checks:

- document title and language;
- exactly one main landmark;
- duplicate IDs;
- accessible names for interactive controls;
- explicit labels for form controls (placeholder text and option text do not count);
- `alt` attributes on images;
- positive `tabindex` values;
- custom clickable `<div>`/`<span>` controls that should be native controls;
- skipped heading levels; and
- missing or invalid guide targets.

`auditGuidance()` separately recommends improvements for visible-label mismatches, ambiguous action names, purchase and deletion boundaries, missing completion signals, unexplained disabled controls, malformed context, and potentially sensitive public context keys.

For production testing, pair this signal with a comprehensive engine such as axe-core:

```ts
import { AxeBuilder } from '@axe-core/playwright'

const results = await new AxeBuilder({ page }).analyze()
expect(results.violations).toEqual([])
```

## Framework notes

### Astro

```astro
<script>
  import { createGuide } from '@polyform-ai/a11y-guide'

  createGuide({ title: 'Explore this page' })
</script>
```

Mount the component once in the shared page shell. In applications that replace the document without a full reload, keep the controller and call `destroy()` before mounting another instance.

### React

```tsx
import { useEffect } from 'react'
import { createGuide } from '@polyform-ai/a11y-guide'

export function AccessibilityGuide() {
  useEffect(() => {
    const guide = createGuide({ title: 'Explore this page' })
    return () => guide.destroy()
  }, [])

  return null
}
```

## Recommended prompt for an AI coding agent

Copy this into the repository together with its existing product and design guidance:

```text
Add @polyform-ai/a11y-guide to this website without weakening native accessibility.

First inspect the rendered page, its interaction code, and its existing accessibility tests. Use native HTML before ARIA: links navigate, buttons perform actions, landmarks structure the page, headings form a logical outline, and every form control has a real label. Replace clickable divs/spans with native controls when possible. Do not add role, aria-label, or tabindex to every div. Do not hide meaningful content from assistive technology.

Mount one createGuide() instance in the shared browser-side page shell. Keep auto-discovery enabled so all available links, buttons, form controls, summaries, and major sections appear. Add concise authored guidance only where knowing the purpose, consequence, prerequisite, current state, or next step would help a visitor. Prefer data-a11y-guide and data-a11y-guide-description on the owning semantic element; add data-a11y-guide-outcome and data-a11y-guide-requires for consequential actions. Use data-a11y-guide-context only for a small set of non-sensitive, structured facts that are already available to the visitor. Use configured steps when guidance is route-specific or centrally managed. Guidance must describe behavior that the code actually provides and must not promise an unavailable action.

For commerce flows, make product, variant, unit price, quantity, subtotal, stock state, and the difference between add-to-cart, review-order, and submit-payment explicit. Keep visible button text synchronized with the current selection. Announce cart updates. Put irreversible, financial, account, or external side effects behind a clear review or confirmation boundary.

Inspect guide.getManifest() and use showGuideOverlay() during development. Compare the overlay with the rendered interface and browser accessibility tree; correct missing, ambiguous, stale, duplicated, disabled, or off-screen actions. Run auditPage() and a comprehensive accessibility engine such as axe-core. Test keyboard-only use: reach the Page guide trigger, open it with Enter and Space, confirm focus moves to Close, activate several section and action entries, close with Escape, and confirm focus returns to the trigger. Verify dynamic controls after state changes. Review desktop, tablet, mobile, 200% zoom, reduced motion, and forced colors. Exercise one important workflow with a computer-use agent and record where it hesitates or chooses the wrong action. Report automated, manual, and agent findings separately and never claim WCAG certification from automation alone.
```

## Accessibility behavior of the guide

- The trigger and all guide entries are native buttons with visible focus states and at least 44px targets.
- The panel is a named, non-modal dialog; the page remains available while it is open.
- Opening moves focus to Close. Escape closes the guide and returns focus to the trigger.
- Choosing an entry scrolls to and focuses its target. A temporary `tabindex="-1"` is used only when a non-interactive target needs programmatic focus and is removed on blur.
- Target names are announced through a polite status region.
- Styles are isolated in Shadow DOM and include reduced-motion and forced-color behavior.
- Generated text is inserted with `textContent`, not HTML.

## API

### `createGuide(options?)`

Important options:

| Option | Default | Purpose |
| --- | --- | --- |
| `root` | `document` | Document or element to discover within. |
| `steps` | `[]` | Authored guidance that takes precedence for matching elements. |
| `autoDiscover` | `true` | Include native page structure and actions. |
| `observe` | `true` | Refresh after client-rendered DOM and visibility changes. |
| `scroll` | `true` | Scroll a chosen target into view. |
| `closeOnNavigate` | `true` | Close the panel before focusing the selected page target. |
| `exposeManifest` | `true` | Publish the current guide as JSON in the DOM for browser agents and tools. |
| `label` | `Page guide` | Trigger label. |
| `title` | `Guide to this page` | Dialog heading. |
| `introduction` | built in | Short explanation above the inventory. |

### `discoverGuideSteps(root?)`

Returns the auto-discovered draft steps. This is useful when building an authoring tool or generating a review report.

### `auditPage(options?)`

Returns structured findings with `rule`, `impact`, `message`, `selector`, and the matching `element` when applicable.

### `auditGuidance(options?)`

Reviews visible-label alignment, ambiguous actions, purchase and deletion boundaries, success signals, disabled reasons, context JSON, and potentially sensitive public context keys. These are high-signal recommendations, not conformance claims.

### `showGuideOverlay(options?)`

Imported from `@polyform-ai/a11y-guide/inspector`. Draws a disposable development overlay of discovered agent targets. The returned controller has `refresh()` and `destroy()` methods.

## A practical audit

1. Run `auditPage()` and axe-core; treat the results as leads, not certification.
2. Turn on `showGuideOverlay()` and look for unnamed, duplicate, stale, hidden, disabled, or overly broad targets.
3. Inspect the browser accessibility tree. Confirm the visible label, accessible name, role, value, state, and description agree.
4. Complete the primary workflow with only a keyboard, then at 200% zoom and on a narrow viewport.
5. Complete it with a screen reader and with a computer-use agent. Note hesitations, wrong turns, missed state changes, and accidental high-consequence actions.
6. Add the smallest truthful guidance that resolves a repeated ambiguity, then rerun all five views.

An agent succeeding once is not proof of accessibility. The useful signal is whether different people and tools can understand the same interface without private instructions or fragile coordinates.

## Contributing examples, prompts, and recommendations

Open a **Guidance or prompt idea** issue when you have a page pattern, prompt, or recommendation but not yet a code change. Open an **Audit finding** for a reproducible semantic, keyboard, manifest, overlay, or agent failure. Pull requests can add focused prompt recipes, tested real-world examples, audit rules, framework integrations, or inspector improvements.

Strong contributions include the page context, the exact ambiguity, before/after guidance, evidence from at least one human-accessibility check, evidence from a browser agent when relevant, and the limits of the result. Please avoid screenshots or metadata containing customer data. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

## Development

```sh
npm install
npm run check
npm run example
```

`npm run check` type-checks the source, runs the DOM behavior tests, builds the distributable ESM and declarations, and verifies the npm tarball contents. `npm run example` starts the runnable commerce example at `http://127.0.0.1:4173/`.

## Publishing checklist

1. Confirm npm organization access and require two-factor authentication for publishing.
2. Add npm trusted publishing and provenance from GitHub Actions.
3. Test the packed tarball in at least one plain HTML app and one framework app.
4. Run axe-core plus manual keyboard and screen-reader checks on the demo.
5. Publish `0.1.0` as a prerelease or `next` tag until the API has been used in more than one production interface.
