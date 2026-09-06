// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import {
  evaluateAgentReadiness,
  evaluateAgentReadinessWhenStable,
  renderAgentReadyReport,
} from '../src/index.js'

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

  it('normalizes a non-unique authored selector during read-only evaluation', () => {
    document.title = 'Authored controls'
    document.documentElement.lang = 'en'
    document.body.innerHTML = '<main><h1>Actions</h1><button class="purchase-button">Buy first</button><button class="purchase-button">Buy second</button></main>'
    const result = evaluateAgentReadiness({
      readOnly: true,
      autoDiscover: false,
      steps: [{ id: 'purchase', selector: '.purchase-button', title: 'Buy first' }],
    })
    const selector = result.manifest.items[0]?.selector

    expect(selector).not.toBe('.purchase-button')
    expect(document.querySelectorAll(selector!)).toHaveLength(1)
  })

  it('does not deduct twice when page and guide audits find the same unnamed control', () => {
    document.title = 'Search'
    document.documentElement.lang = 'en'
    document.body.innerHTML = '<main><h1>Search</h1><input type="search" placeholder="Search tasks"></main>'

    const rules = evaluateAgentReadiness({ readOnly: true }).findings
      .filter((item) => item.selector?.includes('input'))
      .map((item) => item.rule)

    expect(rules).toEqual(['form-label'])
  })

  it('does not infer consequential mutations from task titles or ordinary send actions', () => {
    document.title = 'Tasks'
    document.documentElement.lang = 'en'
    document.body.innerHTML = `
      <main><h1>Tasks</h1>
        <button aria-label="Open task Cancel subscription request"><span aria-hidden="true">CS</span></button>
        <button>Send</button>
      </main>
    `

    expect(evaluateAgentReadiness({ readOnly: true }).findings.map((item) => item.rule))
      .not.toContain('inferred-consequence-guidance')
  })

  it('scores repeated identical component findings once while retaining every occurrence', () => {
    document.title = 'Actions'
    document.documentElement.lang = 'en'
    document.body.innerHTML = '<main><h1>Actions</h1><button aria-label="Open item 1">I1</button></main>'
    const one = evaluateAgentReadiness({ readOnly: true })
    document.body.innerHTML = `<main><h1>Actions</h1>${Array.from({ length: 20 }, (_, index) => `<button aria-label="Open item ${index}">I${index}</button>`).join('')}</main>`
    const repeated = evaluateAgentReadiness({ readOnly: true })

    expect(repeated.findings.filter((item) => item.rule === 'guide-label-in-name')).toHaveLength(20)
    expect(repeated.dimensions.find((item) => item.id === 'actions')?.score)
      .toBe(one.dimensions.find((item) => item.id === 'actions')?.score)
  })

  it('waits for the rendered DOM to settle before evaluating it', async () => {
    goodPage()
    const pending = evaluateAgentReadinessWhenStable({ settleTimeMs: 20, timeoutMs: 250 })
    window.setTimeout(() => {
      document.querySelector('main')?.insertAdjacentHTML('beforeend', '<button>View cart</button>')
    }, 5)

    const result = await pending

    expect(result.manifest.items.some((item) => item.title === 'View cart')).toBe(true)
  })

  it('supports cancelling a pending stable-DOM evaluation', async () => {
    goodPage()
    const controller = new AbortController()
    const pending = evaluateAgentReadinessWhenStable({
      settleTimeMs: 100,
      timeoutMs: 250,
      signal: controller.signal,
    })

    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
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
    expect(html).toContain('View affected pages and selectors')
    expect(html).toContain('Give this remediation prompt to a coding agent')
    expect(html).toContain('Find and fix shared components or templates first')
  })

  it('groups the same finding once across multiple pages with page attribution', () => {
    document.title = 'First page'
    document.documentElement.lang = 'en'
    document.body.innerHTML = '<main><h1>Actions</h1><div role="button">One</div><div role="button">Two</div></main>'
    const first = evaluateAgentReadiness({ readOnly: true })
    const second = { ...first, page: { ...first.page, title: 'Second page', url: 'https://example.com/second' } }
    const html = renderAgentReadyReport({ pages: [first, second] })

    expect(html.match(/A custom interactive element is not keyboard focusable/g)).toHaveLength(1)
    expect(html).toContain('4 occurrences across 2 pages')
    expect(html).toContain('Second page')
    expect(html).toContain('https://example.com/second')
  })

  it('orders site-wide finding groups by severity and occurrence count', () => {
    document.title = 'Moderate page'
    document.body.innerHTML = '<main><h1>Actions</h1><div role="button" tabindex="0">One</div></main>'
    const moderatePage = evaluateAgentReadiness({ readOnly: true })
    document.title = 'Critical page'
    document.body.innerHTML = '<main><h1>Actions</h1><button></button></main>'
    const criticalPage = evaluateAgentReadiness({ readOnly: true })
    const html = renderAgentReadyReport({ pages: [moderatePage, criticalPage] })
    const siteFindings = html.split('<section class="site-findings">')[1] ?? ''

    expect(siteFindings.indexOf('action-name')).toBeLessThan(siteFindings.indexOf('custom-control-native-html'))
  })

  it('sanitizes private report values before rendering HTML or the remediation prompt', () => {
    goodPage()
    const page = evaluateAgentReadiness({ readOnly: true })
    page.page = {
      ...page.page,
      title: 'Private customer dashboard',
      url: 'https://example.com/customers/private-id?email=private@example.com',
    }
    page.findings = [{
      rule: 'example',
      impact: 'moderate',
      dimension: 'actions',
      message: 'Control "private@example.com" needs review.',
      recommendation: 'Review the control.',
      selector: '#private-customer-id',
      deduction: 6,
    }]

    const html = renderAgentReadyReport({
      pages: [page],
      generatedAt: 'private-generated-at',
      sanitize: (value, { field }) => {
        if (field === 'page-title') return 'Redacted page'
        if (field === 'page-url') return undefined
        if (field === 'finding-message') return 'Sensitive control needs review.'
        if (field === 'finding-selector') return undefined
        if (field === 'generated-at') return undefined
        return value
      },
    })

    expect(html).toContain('Redacted page')
    expect(html).not.toMatch(/Private customer|private-id|private@example\.com|private-customer-id|private-generated-at/)
  })
})
