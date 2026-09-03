const SPACE = /\s+/g

function normalized(value: string | null | undefined): string {
  return (value ?? '').replace(SPACE, ' ').trim()
}

function referencedText(element: HTMLElement, attribute: string): string {
  const ids = normalized(element.getAttribute(attribute)).split(' ').filter(Boolean)
  return normalized(ids.map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '').join(' '))
}

function labelText(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  const labels = Array.from(element.labels ?? [])
  return normalized(labels.map((label) => label.textContent ?? '').join(' '))
}

function subtreeText(element: HTMLElement): string {
  const ownText = normalized(element.textContent)
  if (ownText) return ownText
  return normalized(Array.from(element.querySelectorAll<HTMLImageElement>('img[alt]')).map((image) => image.alt).join(' '))
}

/** A pragmatic accessible-name approximation for discovery and audits. */
export function accessibleName(element: HTMLElement): string {
  const labelledBy = referencedText(element, 'aria-labelledby')
  if (labelledBy) return labelledBy
  const ariaLabel = normalized(element.getAttribute('aria-label'))
  if (ariaLabel) return ariaLabel

  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase()
    const label = labelText(element)
    if (label) return label
    if (type === 'image') return normalized(element.alt || element.title)
    if (['button', 'submit', 'reset'].includes(type)) return normalized(element.value || element.title)
    return normalized(element.title)
  }
  if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    return labelText(element) || normalized(element.title)
  }
  if (element instanceof HTMLImageElement || element instanceof HTMLAreaElement) {
    return normalized(element.alt || element.title)
  }

  if (element.matches('button, a[href], summary, h1, h2, h3, h4, h5, h6, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [role="option"], [role="radio"], [role="switch"], [role="tab"]')) {
    return subtreeText(element) || normalized(element.title)
  }
  return normalized(element.title)
}

export function accessibleDescription(element: HTMLElement): string {
  return referencedText(element, 'aria-describedby') || normalized(element.getAttribute('title'))
}

export function visibleText(element: HTMLElement): string {
  if (element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type.toLowerCase())) {
    return normalized(element.value)
  }
  return subtreeText(element)
}

export function isVisible(element: HTMLElement): boolean {
  if (element.matches('input[type="hidden"]') || element.closest('[hidden], [aria-hidden="true"], [inert]')) return false
  const closedDetails = element.closest('details:not([open])')
  if (closedDetails && !element.closest('summary')) return false
  const view = element.ownerDocument.defaultView
  if (!view) return true
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = view.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden') return false
  }
  return true
}

export function isDisabled(element: HTMLElement): boolean {
  return element.matches(':disabled, [aria-disabled="true"]') || Boolean(element.closest('[inert]'))
}

export function implicitRole(element: HTMLElement): string | undefined {
  const explicit = normalized(element.getAttribute('role'))
  if (explicit) return explicit.split(' ')[0]
  if (element.matches('button, input[type="button"], input[type="submit"], input[type="reset"]')) return 'button'
  if (element.matches('a[href], area[href]')) return 'link'
  if (element.matches('input[type="checkbox"]')) return 'checkbox'
  if (element.matches('input[type="radio"]')) return 'radio'
  if (element.matches('input[type="range"]')) return 'slider'
  if (element.matches('input:not([type]), input[type="text"], input[type="email"], input[type="search"], input[type="tel"], input[type="url"]')) return 'textbox'
  if (element.matches('select')) return 'combobox'
  if (element.matches('textarea')) return 'textbox'
  if (element.matches('summary')) return 'button'
  if (element.matches('nav')) return 'navigation'
  if (element.matches('main')) return 'main'
  if (element.matches('aside')) return 'complementary'
  return undefined
}

export function exposedState(element: HTMLElement): Record<string, string | number | boolean> | undefined {
  const state: Record<string, string | number | boolean> = {}
  const booleanAttributes = ['aria-checked', 'aria-expanded', 'aria-invalid', 'aria-pressed', 'aria-selected']
  booleanAttributes.forEach((attribute) => {
    const value = element.getAttribute(attribute)
    if (value === 'true' || value === 'false') state[attribute.slice(5)] = value === 'true'
    else if (value) state[attribute.slice(5)] = value
  })
  const current = element.getAttribute('aria-current')
  if (current) state.current = current === 'true' ? true : current
  if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) state.checked = element.checked
  if (element instanceof HTMLInputElement && ['number', 'range'].includes(element.type)) state.value = element.value
  if (element instanceof HTMLSelectElement) state.selectedOption = element.selectedOptions[0]?.textContent?.trim() ?? ''
  return Object.keys(state).length ? state : undefined
}
