// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { showGuideOverlay } from '../src/inspector.js'

afterEach(() => document.body.replaceChildren())

describe('showGuideOverlay', () => {
  it('shows agent-oriented labels without changing the page controls', () => {
    document.body.innerHTML = '<main><h1>Shop</h1><button id="buy" data-a11y-guide-outcome="Adds one item to the cart.">Add to cart</button></main>'
    const button = document.querySelector<HTMLButtonElement>('#buy')!
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ x: 20, y: 30, left: 20, top: 30, right: 140, bottom: 74, width: 120, height: 44, toJSON: () => ({}) })

    const inspector = showGuideOverlay({ includeSections: false })
    const host = document.querySelector<HTMLElement>('[data-a11y-guide-inspector]')
    expect(host?.shadowRoot?.querySelector('.label')?.textContent).toContain('A1 · Add to cart')
    expect(host?.shadowRoot?.querySelector('.label')?.textContent).toContain('outcome: Adds one item to the cart.')
    expect(button.hasAttribute('role')).toBe(false)

    inspector.destroy()
    expect(document.querySelector('[data-a11y-guide-inspector]')).toBeNull()
  })
})
