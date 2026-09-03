// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { evaluateAgentReadiness, renderAgentReadyReport } from '../src/index.js'

afterEach(() => {
  document.body.replaceChildren()
  document.head.replaceChildren()
  document.documentElement.lang = ''
})

function goodPage(): void {
  document.title = 'Coffee shop'
  document.documentElement.lang = 'en'
  document.body.innerHTML = `
    <header><nav aria-label="Primary"><a href="/">Home</a></nav></header>
    <main><h1>House coffee</h1><label for="quantity">Quantity</label><input id="quantity" type="number" value="2">
    <button data-a11y-guide="Add selected coffee to cart" data-a11y-guide-action="add-to-cart" data-a11y-guide-outcome="Adds two bags to the cart." data-a11y-guide-does-not="Payment does not begin." data-a11y-guide-completion="The cart status announces the new total." data-a11y-guide-confirmation="none">Add 2 to cart — $36</button></main>`
}

describe('evaluateAgentReadiness', () => {
  it('returns a high, deterministic score and an inspectable manifest for a semantic page', () => {
    goodPage()
    const result = evaluateAgentReadiness()
    expect(result.score).toBe(100)
    expect(result.grade).toBe('excellent')
    expect(result.dimensions).toHaveLength(5)
    expect(result.counts).toMatchObject({ actions: 3, namedActions: 3, guidedActions: 1 })
    expect(result.manifest.items.find((item) => item.title === 'Quantity')?.element.state).toEqual({ value: '2' })
  })

  it('makes deductions explainable by dimension and recommendation', () => {
    document.body.innerHTML = '<div role="button">Continue</div><button>Delete</button>'
    const result = evaluateAgentReadiness()
    expect(result.score).toBeLessThan(85)
    expect(result.findings.map((item) => item.rule)).toEqual(expect.arrayContaining([
      'document-title', 'html-lang', 'main-landmark', 'custom-control-keyboard', 'inferred-consequence-guidance',
    ]))
    expect(result.findings.every((item) => item.dimension && item.recommendation && item.deduction > 0)).toBe(true)
  })

  it('does not add target attributes during a read-only audit', () => {
    goodPage()
    const before = document.body.innerHTML
    const result = evaluateAgentReadiness({ readOnly: true })

    expect(result.score).toBe(100)
    expect(document.body.innerHTML).toBe(before)
    expect(result.manifest.items.every((item) => document.querySelector(item.selector))).toBe(true)
  })

  it('uses unique finding selectors when a page contains duplicate ids', () => {
    document.title = 'Duplicate controls'
    document.documentElement.lang = 'en'
    document.body.innerHTML = '<main><h1>Actions</h1><div id="duplicate" role="button">First</div><div id="duplicate" role="button">Second</div></main>'

    const findings = evaluateAgentReadiness({ readOnly: true }).findings
      .filter((item) => item.rule === 'custom-control-keyboard')

    expect(findings.map((item) => item.selector)).toHaveLength(2)
    expect(new Set(findings.map((item) => item.selector)).size).toBe(2)
    expect(findings.map((item) => document.querySelector(item.selector!)?.textContent)).toEqual(['First', 'Second'])
  })
})

describe('renderAgentReadyReport', () => {
  it('renders a standalone multi-page report and escapes page content', () => {
    goodPage()
    const first = evaluateAgentReadiness()
    const second = { ...first, page: { ...first.page, title: '<script>alert(1)</script>', url: 'javascript:alert(1)' }, score: 72 }
    const html = renderAgentReadyReport({ title: 'Polyform agent report', pages: [first, second], generatedAt: '2026-09-03T12:00:00.000Z' })
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('Polyform agent report')
    expect(html).toContain('86')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('not a WCAG score')
  })

  it('requires at least one page', () => {
    expect(() => renderAgentReadyReport({ pages: [] })).toThrow('At least one page')
  })

  it('groups repeated findings and includes a copyable remediation prompt', () => {
    document.title = 'Repeated controls'
    document.documentElement.lang = 'en'
    document.body.innerHTML = '<main><h1>Actions</h1><div role="button">First</div><div role="button">Second</div></main>'
    const page = evaluateAgentReadiness({ readOnly: true })
    const html = renderAgentReadyReport({ title: 'Repeated controls report', pages: [page] })

    expect(html.match(/A custom interactive element is not keyboard focusable/g)).toHaveLength(1)
    expect(html).toContain('2 occurrences')
    expect(html).toContain('View 2 affected selectors')
    expect(html).toContain('Give this remediation prompt to a coding agent')
    expect(html).toContain('Find and fix shared components or templates first')
  })
})
