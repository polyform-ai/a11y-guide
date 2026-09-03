// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { createGuide, discoverGuideSteps } from '../src/index.js'

afterEach(() => {
  document.body.replaceChildren()
  document.head.replaceChildren()
})

describe('discoverGuideSteps', () => {
  it('finds meaningful sections and every named action without making layout divs focusable', () => {
    document.body.innerHTML = `
      <main id="main"><h1>Example page</h1><div class="layout"><button>Save report</button></div></main>
    `

    const steps = discoverGuideSteps(document)
    expect(steps.map((step) => step.title)).toEqual(['Main content', 'Example page', 'Save report'])
    expect(steps.map((step) => step.kind)).toEqual(['section', 'section', 'action'])
    expect(document.querySelector('.layout')?.hasAttribute('tabindex')).toBe(false)
  })

  it('uses author guidance when it is present', () => {
    document.body.innerHTML = `
      <main><section data-a11y-guide="Choose a starting point" data-a11y-guide-description="These paths lead to different workflows." data-a11y-guide-outcome="A workflow is selected." data-a11y-guide-requires="Choose an account | Confirm access" data-a11y-guide-context='{"workflowCount":3,"signedIn":true,"private":{"ignored":true}}'><h2>Paths</h2></section></main>
    `
    const step = discoverGuideSteps(document).find((candidate) => candidate.title === 'Choose a starting point')
    expect(step?.description).toBe('These paths lead to different workflows.')
    expect(step?.outcome).toBe('A workflow is selected.')
    expect(step?.requirements).toEqual(['Choose an account', 'Confirm access'])
    expect(step?.context).toEqual({ workflowCount: 3, signedIn: true })
  })

  it('can produce resolvable selectors without changing a third-party page', () => {
    document.body.innerHTML = `
      <main><h1>Example</h1><div><button id="duplicate">First action</button><button id="duplicate">Second action</button></div></main>
    `
    const before = document.body.innerHTML
    const steps = discoverGuideSteps(document, { readOnly: true })
    const actions = steps.filter((step) => step.kind === 'action')

    expect(document.body.innerHTML).toBe(before)
    expect(actions).toHaveLength(2)
    expect(actions.map((step) => document.querySelector(step.selector)?.textContent)).toEqual(['First action', 'Second action'])
  })
})

describe('createGuide', () => {
  it('opens, lists actions, moves focus, closes with Escape, and cleans up', () => {
    document.body.innerHTML = '<main><h1>Example</h1><button id="save">Save</button></main>'
    const controller = createGuide({ observe: false, scroll: false })
    const host = document.querySelector<HTMLElement>('[data-a11y-guide-ui]')
    const shadow = host?.shadowRoot
    const toggle = shadow?.querySelector<HTMLButtonElement>('.toggle')

    toggle?.click()
    expect(toggle?.getAttribute('aria-expanded')).toBe('true')
    expect(shadow?.querySelector('.panel')?.hasAttribute('hidden')).toBe(false)
    expect(Array.from(shadow?.querySelectorAll('.item strong') ?? []).map((node) => node.textContent)).toContain('Save')

    const saveItem = Array.from(shadow?.querySelectorAll<HTMLButtonElement>('.item') ?? []).find((button) => button.textContent === 'Save')
    saveItem?.click()
    expect(document.activeElement).toBe(document.querySelector('#save'))

    expect(controller.getManifest()).toMatchObject({
      version: 1,
      items: expect.arrayContaining([
        expect.objectContaining({ title: 'Save', kind: 'action', element: expect.objectContaining({ tagName: 'button', disabled: false, accessibleName: 'Save' }) }),
      ]),
    })
    const publishedManifest = host?.querySelector<HTMLScriptElement>('[data-a11y-guide-manifest]')
    expect(JSON.parse(publishedManifest?.textContent ?? '{}').version).toBe(1)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')

    controller.destroy()
    expect(document.querySelector('[data-a11y-guide-ui]')).toBeNull()
  })

  it('lets authored guidance replace the auto-discovered entry for the same element', () => {
    document.body.innerHTML = '<nav aria-label="Primary"><a href="/">Home</a></nav><main><h1>Example</h1></main>'
    const controller = createGuide({
      observe: false,
      steps: [{ id: 'primary', selector: 'nav', title: 'Choose a destination', kind: 'section' }],
    })
    const navItems = controller.getItems().filter((item) => item.element.matches('nav'))
    expect(navItems).toHaveLength(1)
    expect(navItems[0]?.title).toBe('Choose a destination')
    controller.destroy()
  })

  it('uses native form labels, excludes inert controls, and preserves page order', () => {
    document.body.innerHTML = `
      <main>
        <h1>Checkout</h1>
        <label for="quantity">Quantity</label><input id="quantity" type="number" value="2">
        <div inert><button>Unavailable action</button></div>
        <button id="purchase">Place order</button>
      </main>
    `
    const controller = createGuide({
      observe: false,
      steps: [{ id: 'purchase', selector: '#purchase', title: 'Place order for $36', action: 'purchase', confirmation: 'explicit' }],
    })
    const actions = controller.getItems().filter((item) => item.kind === 'action')
    expect(actions.map((item) => item.title)).toEqual(['Quantity', 'Place order for $36'])
    expect(actions[1]?.action).toBe('purchase')
    controller.destroy()
  })

  it('refreshes the manifest after visible action text changes', async () => {
    document.body.innerHTML = '<main><h1>Cart</h1><button id="add">Add 1 to cart</button></main>'
    const controller = createGuide({ scroll: false })
    document.querySelector('#add')!.textContent = 'Add 2 to cart'
    await new Promise((resolve) => setTimeout(resolve, 75))
    expect(controller.getItems().find((item) => item.id === 'auto-3')?.title).toBe('Add 2 to cart')
    controller.destroy()
  })
})
