import { collectGuideItems, discoverGuideSteps } from './discover.js'
import type { GuideController, GuideOptions, ResolvedGuideStep } from './types.js'
import { evaluateAgentReadiness } from './score.js'
import { buildGuideManifest } from './manifest.js'

export type { GuideActionType, GuideConfirmation, GuideContext, GuideContextValue, GuideController, GuideItemKind, GuideManifest, GuideManifestItem, GuideOptions, GuideStep, ResolvedGuideStep } from './types.js'
export { auditGuidance, auditPage, type AuditFinding, type AuditImpact, type AuditOptions } from './audit.js'
export { evaluateAgentReadiness, type AgentReadinessDimension, type AgentReadinessDimensionId, type AgentReadinessEvaluation, type AgentReadinessFinding, type AgentReadinessGrade } from './score.js'
export { renderAgentReadyReport, type AgentReadyReportOptions } from './report.js'
export { collectGuideItems, discoverGuideSteps } from './discover.js'

const STYLE = `
:host{all:initial;position:fixed;z-index:2147483000;right:var(--a11y-guide-right,1rem);bottom:var(--a11y-guide-bottom,1rem);left:var(--a11y-guide-left,auto);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172019;color-scheme:light}
*{box-sizing:border-box}
button{font:inherit}
.toggle{min-height:44px;padding:.75rem 1rem;border:2px solid #172019;border-radius:999px;background:#fff;color:#172019;font-weight:700;box-shadow:0 8px 30px rgba(23,32,25,.18);cursor:pointer}
.toggle:focus-visible,.close:focus-visible,.item:focus-visible{outline:3px solid #78a987;outline-offset:3px}
.panel{position:absolute;right:0;bottom:calc(100% + .75rem);width:min(25rem,calc(100vw - 2rem));max-height:min(42rem,calc(100vh - 7rem));display:flex;flex-direction:column;overflow:hidden;border:1px solid #cad5cd;border-radius:1rem;background:#fff;box-shadow:0 18px 50px rgba(23,32,25,.22)}
.panel[hidden]{display:none}
.head{display:flex;align-items:flex-start;gap:1rem;padding:1rem;border-bottom:1px solid #e5eae6}
.head-copy{min-width:0;flex:1}.title{margin:0;font-size:1.125rem;line-height:1.3}.intro{margin:.35rem 0 0;color:#4a594e;font-size:.875rem;line-height:1.45}
.close{width:44px;height:44px;flex:0 0 44px;border:0;border-radius:999px;background:#edf3ee;color:#172019;font-size:1.3rem;cursor:pointer}
.body{overflow:auto;padding:.5rem}.group-title{margin:.75rem .5rem .35rem;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:#536258}
.list{list-style:none;margin:0;padding:0}.item{width:100%;min-height:44px;display:block;padding:.7rem .75rem;border:0;border-radius:.65rem;background:transparent;color:#172019;text-align:left;cursor:pointer}.item:hover{background:#edf3ee}.item strong{display:block;font-size:.9375rem}.item span{display:block;margin-top:.2rem;color:#536258;font-size:.8125rem;line-height:1.4}
.empty{margin:.75rem;color:#536258;font-size:.875rem}
.status{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
@media (forced-colors:active){.toggle,.panel{border:2px solid CanvasText}.item:hover{outline:2px solid Highlight}}
@media print{:host{display:none!important}}
`

function ownerDocument(root: Document | HTMLElement): Document {
  const doc = root.nodeType === 9 ? root as Document : root.ownerDocument
  if (!doc) throw new Error('The guide root must belong to a document.')
  return doc
}

function focusTarget(item: ResolvedGuideStep, shouldScroll: boolean): void {
  const target = item.element
  const reduceMotion = target.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (shouldScroll) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  const hadTabindex = target.hasAttribute('tabindex')
  if (target.tabIndex < 0) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  if (!hadTabindex) target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true })
}

export function createGuide(options: GuideOptions = {}): GuideController {
  const root = options.root ?? document
  const doc = ownerDocument(root)
  const host = doc.createElement('div')
  host.dataset.a11yGuideUi = ''
  const shadow = host.attachShadow({ mode: 'open' })
  const style = doc.createElement('style')
  style.textContent = STYLE
  shadow.append(style)
  const manifest = doc.createElement('script')
  manifest.type = 'application/json'
  manifest.dataset.a11yGuideManifest = 'v1'
  if (options.exposeManifest !== false) host.append(manifest)

  const toggle = doc.createElement('button')
  toggle.className = 'toggle'
  toggle.type = 'button'
  toggle.textContent = options.label ?? 'Page guide'
  toggle.setAttribute('aria-expanded', 'false')

  const panel = doc.createElement('section')
  panel.className = 'panel'
  panel.id = `a11y-guide-panel-${Math.random().toString(36).slice(2)}`
  panel.hidden = true
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'false')
  toggle.setAttribute('aria-controls', panel.id)

  const head = doc.createElement('div')
  head.className = 'head'
  const headCopy = doc.createElement('div')
  headCopy.className = 'head-copy'
  const title = doc.createElement('h2')
  title.className = 'title'
  title.id = `a11y-guide-title-${Math.random().toString(36).slice(2)}`
  title.textContent = options.title ?? 'Guide to this page'
  panel.setAttribute('aria-labelledby', title.id)
  const intro = doc.createElement('p')
  intro.className = 'intro'
  intro.textContent = options.introduction ?? 'Jump to a section or move directly to something you can use.'
  headCopy.append(title, intro)
  const closeButton = doc.createElement('button')
  closeButton.className = 'close'
  closeButton.type = 'button'
  closeButton.setAttribute('aria-label', 'Close page guide')
  closeButton.textContent = '×'
  head.append(headCopy, closeButton)

  const body = doc.createElement('div')
  body.className = 'body'
  const status = doc.createElement('div')
  status.className = 'status'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  panel.append(head, body, status)
  shadow.append(panel, toggle)
  doc.body.append(host)

  let items: ResolvedGuideStep[] = []
  let destroyed = false
  let refreshTimer: ReturnType<typeof setTimeout> | undefined

  const hide = (restoreFocus: boolean): void => {
    if (panel.hidden) return
    panel.hidden = true
    toggle.setAttribute('aria-expanded', 'false')
    if (restoreFocus) toggle.focus()
  }

  const close = (): void => hide(true)

  const goTo = (id: string): boolean => {
    const item = items.find((candidate) => candidate.id === id)
    if (!item) return false
    if (options.closeOnNavigate !== false) hide(false)
    focusTarget(item, options.scroll !== false)
    status.textContent = [item.title, item.description, item.outcome].filter(Boolean).join('. ')
    return true
  }

  const renderGroup = (label: string, groupItems: ResolvedGuideStep[]): void => {
    if (!groupItems.length) return
    const heading = doc.createElement('h3')
    heading.className = 'group-title'
    heading.textContent = label
    const list = doc.createElement('ul')
    list.className = 'list'
    groupItems.forEach((item) => {
      const row = doc.createElement('li')
      const button = doc.createElement('button')
      button.className = 'item'
      button.type = 'button'
      const itemTitle = doc.createElement('strong')
      itemTitle.textContent = item.title
      button.append(itemTitle)
      if (item.description) {
        const description = doc.createElement('span')
        description.textContent = item.description
        button.append(description)
      }
      const details = [
        item.requirements?.length ? `Before: ${item.requirements.join('; ')}` : undefined,
        item.outcome ? `Result: ${item.outcome}` : undefined,
        item.doesNot ? `Does not: ${item.doesNot}` : undefined,
        item.completion ? `Success: ${item.completion}` : undefined,
      ].filter((value): value is string => Boolean(value))
      details.forEach((value) => {
        const detail = doc.createElement('span')
        detail.textContent = value
        button.append(detail)
      })
      button.addEventListener('click', () => goTo(item.id))
      row.append(button)
      list.append(row)
    })
    body.append(heading, list)
  }

  const refresh = (): void => {
    if (destroyed) return
    items = collectGuideItems(root, options.steps ?? [], options.autoDiscover !== false)
    manifest.textContent = JSON.stringify(buildGuideManifest(doc, items))
    body.replaceChildren()
    renderGroup('Sections', items.filter((item) => item.kind === 'section'))
    renderGroup('Actions', items.filter((item) => item.kind === 'action'))
    if (!items.length) {
      const empty = doc.createElement('p')
      empty.className = 'empty'
      empty.textContent = 'No guide items are available on this page yet.'
      body.append(empty)
    }
  }

  const open = (): void => {
    refresh()
    panel.hidden = false
    toggle.setAttribute('aria-expanded', 'true')
    closeButton.focus()
  }

  toggle.addEventListener('click', () => panel.hidden ? open() : close())
  closeButton.addEventListener('click', close)
  const handleEscape = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent
    if (keyboardEvent.key === 'Escape' && !panel.hidden) {
      keyboardEvent.preventDefault()
      close()
    }
  }
  doc.addEventListener('keydown', handleEscape)

  const Observer = doc.defaultView?.MutationObserver
  const scheduleRefresh = (): void => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(refresh, 50)
  }
  const observer = options.observe === false || !Observer ? undefined : new Observer((mutations) => {
    if (mutations.every((mutation) => (mutation.target as Element).closest?.('[data-a11y-guide-ui]'))) return
    scheduleRefresh()
  })
  observer?.observe(root.nodeType === 9 ? (root as Document).body : root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'open', 'hidden', 'inert', 'aria-hidden', 'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-selected', 'aria-disabled', 'aria-expanded', 'aria-pressed', 'disabled', 'data-a11y-guide', 'data-a11y-guide-action', 'data-a11y-guide-description', 'data-a11y-guide-outcome', 'data-a11y-guide-does-not', 'data-a11y-guide-confirmation', 'data-a11y-guide-completion', 'data-a11y-guide-requires', 'data-a11y-guide-context'] })
  if (options.observe !== false) {
    root.addEventListener('input', scheduleRefresh)
    root.addEventListener('change', scheduleRefresh)
  }
  refresh()

  return {
    open,
    close,
    refresh,
    goTo,
    getItems: () => [...items],
    getManifest: () => buildGuideManifest(doc, items),
    getAgentReadiness: () => evaluateAgentReadiness({ root, steps: options.steps, autoDiscover: options.autoDiscover }),
    destroy: () => {
      destroyed = true
      clearTimeout(refreshTimer)
      observer?.disconnect()
      root.removeEventListener('input', scheduleRefresh)
      root.removeEventListener('change', scheduleRefresh)
      doc.removeEventListener('keydown', handleEscape)
      host.remove()
    },
  }
}
