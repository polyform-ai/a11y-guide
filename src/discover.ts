import type { GuideContext, GuideItemKind, GuideStep, ResolvedGuideStep } from './types.js'
import { accessibleDescription, accessibleName, isVisible } from './dom.js'

const ACTION_SELECTOR = 'a[href], area[href], button, input:not([type="hidden"]), select, textarea, summary, [contenteditable="true"], [role="button"], [role="link"], [role="checkbox"], [role="combobox"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="radio"], [role="slider"], [role="spinbutton"], [role="switch"], [role="tab"], [role="textbox"]'
const SECTION_SELECTOR = 'main, nav, aside, [role="main"], [role="navigation"], [role="complementary"], h1, h2, h3, [data-a11y-guide]'

export interface DiscoveryOptions {
  /** Avoid adding generated data attributes while inspecting a third-party page. */
  readOnly?: boolean
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value)
  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character.codePointAt(0)?.toString(16)} `)
}

function sectionName(element: HTMLElement): string {
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const labelledText = labelledBy.split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (labelledText) return labelledText
  }
  const explicit = element.getAttribute('aria-label') || element.getAttribute('title')
  if (explicit?.trim()) return explicit.trim()
  if (element.matches('h1, h2, h3')) return accessibleName(element)
  if (element.matches('main, [role="main"]')) return 'Main content'
  if (element.matches('nav, [role="navigation"]')) return 'Navigation'
  if (element.matches('aside, [role="complementary"]')) return 'Related information'
  const heading = element.querySelector<HTMLElement>('h1, h2, h3')
  if (heading) return accessibleName(heading)
  return ''
}

function isUnique(root: Document | HTMLElement, selector: string): boolean {
  try {
    return root.querySelectorAll(selector).length === 1
  } catch {
    return false
  }
}

function structuralSelector(element: HTMLElement, root: Document | HTMLElement): string {
  const parts: string[] = []
  const boundary = root.nodeType === 1 ? root as HTMLElement : null
  let current: HTMLElement | null = element

  while (current && current !== boundary) {
    const idSelector = current.id ? `#${cssEscape(current.id)}` : ''
    const guideId = current.dataset.a11yGuideId
    const guideSelector = guideId ? `[data-a11y-guide-id="${cssEscape(guideId)}"]` : ''
    if (idSelector && isUnique(root, idSelector)) return idSelector
    if (guideSelector && isUnique(root, guideSelector)) return guideSelector

    const tag = current.tagName.toLowerCase()
    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter((sibling) => sibling.tagName === current?.tagName)
      : []
    const position = siblings.indexOf(current)
    parts.unshift(siblings.length > 1 && position >= 0 ? `${tag}:nth-of-type(${position + 1})` : tag)

    const candidate = parts.join(' > ')
    if (isUnique(root, candidate)) return candidate
    current = current.parentElement
  }

  return parts.join(' > ') || element.tagName.toLowerCase()
}

function selectorFor(element: HTMLElement, index: number, root: Document | HTMLElement, readOnly: boolean): string {
  const idSelector = element.id ? `#${cssEscape(element.id)}` : ''
  if (idSelector && isUnique(root, idSelector)) return idSelector
  const guideId = element.dataset.a11yGuideId
  const guideSelector = guideId ? `[data-a11y-guide-id="${cssEscape(guideId)}"]` : ''
  if (guideSelector && isUnique(root, guideSelector)) return guideSelector
  if (readOnly) return structuralSelector(element, root)
  const generatedId = `a11y-guide-target-${index + 1}`
  element.dataset.a11yGuideId = generatedId
  return `[data-a11y-guide-id="${generatedId}"]`
}

function kindFor(element: HTMLElement): GuideItemKind {
  return element.matches(ACTION_SELECTOR) ? 'action' : 'section'
}

function titleFor(element: HTMLElement, kind: GuideItemKind, index: number): string {
  const authored = element.dataset.a11yGuide
  if (authored) return authored
  const label = kind === 'section' ? sectionName(element) : accessibleName(element)
  if (label) return label.length > 90 ? `${label.slice(0, 87).trimEnd()}…` : label
  return kind === 'action' ? `Action ${index + 1}` : `Section ${index + 1}`
}

function actionFor(element: HTMLElement): GuideStep['action'] {
  const authored = element.dataset.a11yGuideAction
  const actions = ['navigate', 'select', 'toggle', 'submit', 'add-to-cart', 'purchase', 'delete', 'download', 'upload', 'custom']
  if (authored && actions.includes(authored)) return authored as GuideStep['action']
  if (element.matches('a[href], area[href]')) return 'navigate'
  if (element.matches('select, input[type="checkbox"], input[type="radio"], [role="option"], [role="radio"]')) return 'select'
  if (element.matches('summary, [aria-pressed], [role="switch"], [role="tab"]')) return 'toggle'
  if (element.matches('button[type="submit"], input[type="submit"]')) return 'submit'
  return undefined
}

function confirmationFor(element: HTMLElement): GuideStep['confirmation'] {
  const value = element.dataset.a11yGuideConfirmation
  return value === 'none' || value === 'review' || value === 'explicit' ? value : undefined
}

function contextFor(element: HTMLElement): GuideContext | undefined {
  const source = element.dataset.a11yGuideContext
  if (!source) return undefined
  try {
    const parsed: unknown = JSON.parse(source)
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return undefined
    const entries = Object.entries(parsed).filter((entry): entry is [string, string | number | boolean] => {
      return ['string', 'number', 'boolean'].includes(typeof entry[1])
    })
    return entries.length ? Object.fromEntries(entries) : undefined
  } catch {
    return undefined
  }
}

export function discoverGuideSteps(root: Document | HTMLElement = document, options: DiscoveryOptions = {}): GuideStep[] {
  const scope = root
  const elements = Array.from(scope.querySelectorAll<HTMLElement>(`${SECTION_SELECTOR}, ${ACTION_SELECTOR}`))
  const seen = new Set<HTMLElement>()

  return elements
    .filter((element) => {
      if (seen.has(element) || element.closest('[data-a11y-guide-ui], [data-a11y-guide-inspector]') || !isVisible(element)) return false
      seen.add(element)
      return true
    })
    .map((element, index) => {
      const authoredKind = element.dataset.a11yGuideKind
      const kind = authoredKind === 'section' || authoredKind === 'action' ? authoredKind : kindFor(element)
      return {
        id: element.dataset.a11yGuideId || `auto-${index + 1}`,
        selector: selectorFor(element, index, root, options.readOnly === true),
        title: titleFor(element, kind, index),
        description: element.dataset.a11yGuideDescription || accessibleDescription(element) || undefined,
        outcome: element.dataset.a11yGuideOutcome,
        action: actionFor(element),
        doesNot: element.dataset.a11yGuideDoesNot,
        confirmation: confirmationFor(element),
        completion: element.dataset.a11yGuideCompletion,
        requirements: element.dataset.a11yGuideRequires?.split('|').map((item) => item.trim()).filter(Boolean),
        context: contextFor(element),
        kind,
      }
    })
}

export function resolveGuideSteps(
  root: Document | HTMLElement,
  steps: GuideStep[],
): ResolvedGuideStep[] {
  const scope = root
  return steps.flatMap((step) => {
    let element: HTMLElement | null = null
    try {
      element = scope.querySelector<HTMLElement>(step.selector)
    } catch {
      return []
    }
    if (!element || element.closest('[data-a11y-guide-ui], [data-a11y-guide-inspector]') || !isVisible(element)) return []
    return [{ ...step, kind: step.kind ?? kindFor(element), element }]
  })
}

export function collectGuideItems(
  root: Document | HTMLElement,
  authored: GuideStep[] = [],
  autoDiscover = true,
  options: DiscoveryOptions = {},
): ResolvedGuideStep[] {
  const authoredItems = resolveGuideSteps(root, authored)
  const authoredElements = new Set(authoredItems.map((item) => item.element))
  const discoveredItems = autoDiscover
    ? resolveGuideSteps(root, discoverGuideSteps(root, options)).filter((item) => !authoredElements.has(item.element))
    : []
  const positionFollowing = root.ownerDocument?.defaultView?.Node?.DOCUMENT_POSITION_FOLLOWING
    ?? (root as Document).defaultView?.Node?.DOCUMENT_POSITION_FOLLOWING
    ?? 4
  const items = [...authoredItems, ...discoveredItems]
  if (items.some((item) => typeof item.element.compareDocumentPosition !== 'function')) return items
  return items.sort((left, right) => {
    if (left.element === right.element) return 0
    return left.element.compareDocumentPosition(right.element) & positionFollowing ? -1 : 1
  })
}
