// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { auditPage } from '../src/audit.js'

afterEach(() => {
  document.body.replaceChildren()
  document.head.replaceChildren()
  document.documentElement.lang = ''
})

describe('auditPage', () => {
  it('returns no findings for a small semantic page', () => {
    document.title = 'Accessible example'
    document.documentElement.lang = 'en'
    document.body.innerHTML = '<header><nav aria-label="Primary"><a href="/">Home</a></nav></header><main><h1>Example</h1><img src="x.png" alt="A useful chart"><button>Save</button></main>'
    expect(auditPage()).toEqual([])
  })

  it('reports high-signal semantic and guide errors', () => {
    document.body.innerHTML = '<div role="button"></div><img src="x.png"><h1>One</h1><h3>Three</h3>'
    const findings = auditPage({ steps: [{ id: 'missing', selector: '#missing', title: 'Missing' }] })
    expect(findings.map((item) => item.rule)).toEqual(expect.arrayContaining([
      'document-title', 'html-lang', 'main-landmark', 'accessible-name', 'image-alt',
      'custom-control-keyboard', 'heading-order', 'guide-target',
    ]))
  })

  it('does not accept placeholder text as a form label', () => {
    document.title = 'Form example'
    document.documentElement.lang = 'en'
    document.body.innerHTML = '<main><h1>Contact</h1><input placeholder="Email"></main>'
    expect(auditPage().map((item) => item.rule)).toContain('form-label')
  })

  it('does not accept option text as a select label', () => {
    document.title = 'Form example'
    document.documentElement.lang = 'en'
    document.body.innerHTML = '<main><h1>Contact</h1><select><option>Choose one</option></select></main>'
    expect(auditPage().map((item) => item.rule)).toContain('form-label')
  })
})
