import type { GuideStep } from './types.js'

export type AuditImpact = 'critical' | 'serious' | 'moderate'

export interface AuditFinding {
  rule: string
  impact: AuditImpact
  message: string
  selector?: string
  element?: Element
}

export interface AuditOptions {
  root?: Document | HTMLElement
  steps?: GuideStep[]
}

function accessibleName(element: HTMLElement): string {
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const document = element.ownerDocument
    const label = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
    if (label.trim()) return label.trim()
  }
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel?.trim()) return ariaLabel.trim()
  if (element.matches('input, select, textarea')) {
    const control = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    const explicit = control.id ? control.ownerDocument.querySelector<HTMLLabelElement>(`label[for="${control.id}"]`) : null
    const wrapping = element.closest('label')
    const type = control instanceof HTMLInputElement ? control.type.toLowerCase() : ''
    const nativeValue = control instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(type) ? control.value : ''
    return (explicit?.textContent || wrapping?.textContent || element.getAttribute('title') || nativeValue || '').trim()
  }
  return (element.getAttribute('alt')
    || element.getAttribute('title')
    || element.textContent
    || '').replace(/\s+/g, ' ').trim()
}

function visible(element: HTMLElement): boolean {
  if (element.closest('[hidden], [aria-hidden="true"]')) return false
  const view = element.ownerDocument.defaultView
  if (!view) return true
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = view.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden') return false
  }
  return true
}

function selectorFor(element: Element): string {
  if (element.id) return `#${element.id}`
  const guideId = (element as HTMLElement).dataset?.a11yGuideId
  if (guideId) return `[data-a11y-guide-id="${guideId}"]`
  return element.tagName.toLowerCase()
}

function finding(rule: string, impact: AuditImpact, message: string, element?: Element): AuditFinding {
  return { rule, impact, message, element, selector: element ? selectorFor(element) : undefined }
}

export function auditPage(options: AuditOptions = {}): AuditFinding[] {
  const root = options.root ?? document
  const isDocument = root.nodeType === 9
  const documentRoot = isDocument ? root as Document : root.ownerDocument
  if (!documentRoot) throw new Error('The audit root must belong to a document.')
  const findings: AuditFinding[] = []

  if (isDocument) {
    if (!documentRoot.title.trim()) findings.push(finding('document-title', 'serious', 'The document needs a descriptive title.'))
    if (!documentRoot.documentElement.lang.trim()) findings.push(finding('html-lang', 'serious', 'The document language is missing.'))
  }

  const query = <T extends Element>(selector: string): T[] => Array.from(root.querySelectorAll<T>(selector))
  const mains = query<HTMLElement>('main, [role="main"]')
  if (mains.length !== 1) findings.push(finding('main-landmark', 'serious', `Expected exactly one main landmark; found ${mains.length}.`))

  const ids = new Map<string, Element[]>()
  query<HTMLElement>('[id]').forEach((element) => {
    const matches = ids.get(element.id) ?? []
    matches.push(element)
    ids.set(element.id, matches)
  })
  ids.forEach((elements, id) => {
    if (elements.length > 1) findings.push(finding('duplicate-id', 'serious', `The id "${id}" is used ${elements.length} times.`, elements[0]))
  })

  query<HTMLElement>('button, a[href], [role="button"], [role="link"]').filter(visible).forEach((element) => {
    if (!accessibleName(element)) findings.push(finding('accessible-name', 'critical', 'Interactive controls need an accessible name.', element))
  })

  query<HTMLElement>('input:not([type="hidden"]), select, textarea').filter(visible).forEach((element) => {
    if (!accessibleName(element)) findings.push(finding('form-label', 'critical', 'Form controls need an accessible label.', element))
  })

  query<HTMLImageElement>('img').forEach((element) => {
    if (!element.hasAttribute('alt')) findings.push(finding('image-alt', 'critical', 'Images need an alt attribute; use alt="" only for decorative images.', element))
  })

  query<HTMLElement>('[tabindex]').forEach((element) => {
    if (element.tabIndex > 0) findings.push(finding('positive-tabindex', 'serious', 'Positive tabindex values create an unpredictable focus order.', element))
  })

  query<HTMLElement>('div[onclick], div[role="button"], span[onclick], span[role="button"]').forEach((element) => {
    if (element.tabIndex < 0) findings.push(finding('custom-control-keyboard', 'critical', 'A custom interactive element is not keyboard focusable; prefer a native button or link.', element))
    else findings.push(finding('custom-control-native-html', 'moderate', 'Verify keyboard behavior for this custom control; a native button or link is safer.', element))
  })

  let previousLevel = 0
  query<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6').filter(visible).forEach((heading) => {
    const level = Number(heading.tagName.slice(1))
    if (previousLevel && level > previousLevel + 1) findings.push(finding('heading-order', 'moderate', `Heading level jumps from h${previousLevel} to h${level}.`, heading))
    previousLevel = level
  })

  options.steps?.forEach((step) => {
    try {
      if (!root.querySelector(step.selector)) findings.push(finding('guide-target', 'serious', `Guide step "${step.id}" does not match ${step.selector}.`))
    } catch {
      findings.push(finding('guide-selector', 'serious', `Guide step "${step.id}" has an invalid selector: ${step.selector}.`))
    }
  })

  return findings
}
