import type { GuideStep } from './types.js'
import { collectGuideItems, selectorForElement } from './discover.js'
import { accessibleName, isDisabled, isVisible, visibleText } from './dom.js'

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
  autoDiscover?: boolean
  /** Inspect without adding generated target attributes to the host page. */
  readOnly?: boolean
}

function finding(root: Document | HTMLElement, rule: string, impact: AuditImpact, message: string, element?: HTMLElement): AuditFinding {
  return { rule, impact, message, element, selector: element ? selectorForElement(element, root) : undefined }
}

export function auditPage(options: AuditOptions = {}): AuditFinding[] {
  const root = options.root ?? document
  const isDocument = root.nodeType === 9
  const documentRoot = isDocument ? root as Document : root.ownerDocument
  if (!documentRoot) throw new Error('The audit root must belong to a document.')
  const findings: AuditFinding[] = []

  if (isDocument) {
    if (!documentRoot.title.trim()) findings.push(finding(root, 'document-title', 'serious', 'The document needs a descriptive title.'))
    if (!documentRoot.documentElement.lang.trim()) findings.push(finding(root, 'html-lang', 'serious', 'The document language is missing.'))
  }

  const query = <T extends Element>(selector: string): T[] => Array.from(root.querySelectorAll<T>(selector))
  const mains = query<HTMLElement>('main, [role="main"]')
  if (mains.length !== 1) findings.push(finding(root, 'main-landmark', 'serious', `Expected exactly one main landmark; found ${mains.length}.`))

  const ids = new Map<string, HTMLElement[]>()
  query<HTMLElement>('[id]').forEach((element) => {
    const matches = ids.get(element.id) ?? []
    matches.push(element)
    ids.set(element.id, matches)
  })
  ids.forEach((elements, id) => {
    if (elements.length > 1) findings.push(finding(root, 'duplicate-id', 'serious', `The id "${id}" is used ${elements.length} times.`, elements[0]))
  })

  query<HTMLElement>('button, a[href], [role="button"], [role="link"]').filter(isVisible).forEach((element) => {
    if (!accessibleName(element)) findings.push(finding(root, 'accessible-name', 'critical', 'Interactive controls need an accessible name.', element))
  })

  query<HTMLElement>('[aria-controls]').forEach((element) => {
    const targets = element.getAttribute('aria-controls')?.trim().split(/\s+/).filter(Boolean) ?? []
    if (targets.some((id) => !documentRoot.getElementById(id))) {
      findings.push(finding(root, 'aria-controls-target', 'serious', 'aria-controls references an element that does not exist.', element))
    }
  })

  const actionNames = new Map<string, HTMLElement[]>()
  query<HTMLAnchorElement>('a[href]').filter(isVisible).forEach((element) => {
    const name = normalized(accessibleName(element))
    if (!name) return
    const matches = actionNames.get(name) ?? []
    matches.push(element)
    actionNames.set(name, matches)
  })
  actionNames.forEach((elements, name) => {
    if (elements.length < 2) return
    const destinations = new Set(elements.map((element) => (element as HTMLAnchorElement).href))
    if (destinations.size > 1) {
      findings.push(finding(root, 'duplicate-action-name', 'moderate', `The action name "${name}" is used for different destinations or effects.`, elements[0]))
    }
  })

  query<HTMLElement>('input:not([type="hidden"]), select, textarea').filter(isVisible).forEach((element) => {
    if (!accessibleName(element)) findings.push(finding(root, 'form-label', 'critical', 'Form controls need an accessible label.', element))
  })

  query<HTMLImageElement>('img').forEach((element) => {
    if (!element.hasAttribute('alt')) findings.push(finding(root, 'image-alt', 'critical', 'Images need an alt attribute; use alt="" only for decorative images.', element))
  })

  query<HTMLElement>('[tabindex]').forEach((element) => {
    if (element.tabIndex > 0) findings.push(finding(root, 'positive-tabindex', 'serious', 'Positive tabindex values create an unpredictable focus order.', element))
  })

  query<HTMLElement>('div[onclick], div[role="button"], span[onclick], span[role="button"]').forEach((element) => {
    if (element.tabIndex < 0) findings.push(finding(root, 'custom-control-keyboard', 'critical', 'A custom interactive element is not keyboard focusable; prefer a native button or link.', element))
    else findings.push(finding(root, 'custom-control-native-html', 'moderate', 'Verify keyboard behavior for this custom control; a native button or link is safer.', element))
  })

  let previousLevel = 0
  query<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6').filter(isVisible).forEach((heading) => {
    const level = Number(heading.tagName.slice(1))
    if (previousLevel && level > previousLevel + 1) findings.push(finding(root, 'heading-order', 'moderate', `Heading level jumps from h${previousLevel} to h${level}.`, heading))
    previousLevel = level
  })

  options.steps?.forEach((step) => {
    try {
      if (!root.querySelector(step.selector)) findings.push(finding(root, 'guide-target', 'serious', `Guide step "${step.id}" does not match ${step.selector}.`))
    } catch {
      findings.push(finding(root, 'guide-selector', 'serious', `Guide step "${step.id}" has an invalid selector: ${step.selector}.`))
    }
  })

  return findings
}

const AMBIGUOUS_ACTION = /^(click here|continue|go|learn more|more|next|ok|submit|yes|no)$/i
const CONSEQUENTIAL_ACTIONS = new Set(['purchase', 'delete'])
const SENSITIVE_CONTEXT_KEY = /(address|card|credential|email|password|phone|secret|ssn|token)/i

function normalized(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

/** Reviews whether authored guidance agrees with the visible, operable interface. */
export function auditGuidance(options: AuditOptions = {}): AuditFinding[] {
  const root = options.root ?? document
  const findings: AuditFinding[] = []
  const items = collectGuideItems(root, options.steps ?? [], options.autoDiscover !== false, { readOnly: options.readOnly })

  items.filter((item) => item.kind === 'action').forEach((item) => {
    const element = item.element
    const name = accessibleName(element)
    const visible = visibleText(element)
    if (element.matches('button, a[href], summary, [role="button"], [role="link"]') && visible && name && !normalized(name).includes(normalized(visible))) {
      findings.push(finding(root, 'guide-label-in-name', 'serious', `Visible text "${visible}" is not contained in the accessible name "${name}".`, element))
    }
    if (AMBIGUOUS_ACTION.test(item.title.trim())) {
      findings.push(finding(root, 'guide-ambiguous-action', 'moderate', `The action name "${item.title}" does not explain what will happen.`, element))
    }
    if (item.title.startsWith('Action ')) {
      findings.push(finding(root, 'guide-action-name', 'critical', 'The guide could not find an accessible name for this action.', element))
    }
    if (CONSEQUENTIAL_ACTIONS.has(item.action ?? '')) {
      if (!item.outcome) findings.push(finding(root, 'guide-consequence', 'serious', `The ${item.action} action needs a truthful outcome.`, element))
      if (!item.completion) findings.push(finding(root, 'guide-completion', 'serious', `The ${item.action} action needs a visible or announced completion signal.`, element))
      if (!item.confirmation || item.confirmation === 'none') findings.push(finding(root, 'guide-confirmation', 'serious', `The ${item.action} action needs a review or explicit confirmation boundary.`, element))
    }
    if (isDisabled(element) && !item.description && !item.requirements?.length) {
      findings.push(finding(root, 'guide-disabled-reason', 'moderate', 'Explain why this action is unavailable or what is required to enable it.', element))
    }
    Object.keys(item.context ?? {}).filter((key) => SENSITIVE_CONTEXT_KEY.test(key)).forEach((key) => {
      findings.push(finding(root, 'guide-sensitive-context', 'serious', `The public guide context contains a potentially sensitive "${key}" field.`, element))
    })
    if (element.hasAttribute('data-a11y-guide-context') && !item.context) {
      findings.push(finding(root, 'guide-context-json', 'moderate', 'The guide context must be a JSON object containing only string, number, or boolean values.', element))
    }
  })

  return findings
}
