import { collectGuideItems } from './discover.js'
import type { GuideItemKind, GuideStep } from './types.js'

export interface InspectorOptions {
  root?: Document | HTMLElement
  steps?: GuideStep[]
  /** Include structural sections as well as actions. Defaults to true. */
  includeSections?: boolean
}

export interface InspectorController {
  refresh(): void
  destroy(): void
}

const STYLE = `
:host{all:initial;position:fixed;inset:0;z-index:2147482999;pointer-events:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.box{position:fixed;border:2px solid #6d28d9;background:rgba(109,40,217,.07);border-radius:4px}
.box[data-kind="section"]{border-color:#047857;background:rgba(4,120,87,.06)}
.label{position:absolute;left:-2px;bottom:100%;max-width:min(28rem,80vw);padding:3px 6px;background:#171717;color:#fff;font:600 11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:normal}
.legend{position:fixed;top:12px;right:12px;max-width:22rem;padding:9px 11px;border:1px solid #737373;border-radius:7px;background:#fff;color:#171717;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 4px 18px rgba(0,0,0,.18)}
@media (forced-colors:active){.box{border-color:Highlight}.label,.legend{border:1px solid CanvasText}}
`

function documentFor(root: Document | HTMLElement): Document {
  const doc = root.nodeType === 9 ? root as Document : root.ownerDocument
  if (!doc) throw new Error('The inspector root must belong to a document.')
  return doc
}

function labelFor(index: number, kind: GuideItemKind, title: string, action?: string, outcome?: string, confirmation?: string, disabled?: boolean): string {
  const parts = [`${kind === 'action' ? 'A' : 'S'}${index + 1}`, title]
  if (action) parts.push(action)
  if (disabled) parts.push('disabled')
  if (confirmation) parts.push(`confirmation: ${confirmation}`)
  if (outcome) parts.push(`outcome: ${outcome}`)
  return parts.join(' · ')
}

/**
 * Draws a temporary visual map of the semantic targets available to the guide.
 * This is a debugging aid, not an exact rendering of any browser's accessibility tree.
 */
export function showGuideOverlay(options: InspectorOptions = {}): InspectorController {
  const root = options.root ?? document
  const doc = documentFor(root)
  const host = doc.createElement('div')
  host.dataset.a11yGuideInspector = ''
  const shadow = host.attachShadow({ mode: 'open' })
  const style = doc.createElement('style')
  style.textContent = STYLE
  const layer = doc.createElement('div')
  const legend = doc.createElement('div')
  legend.className = 'legend'
  legend.textContent = 'Agent-view preview · actions are purple, sections are green. Approximation only; verify the browser accessibility tree and test with assistive technology.'
  shadow.append(style, layer, legend)
  doc.body.append(host)

  let destroyed = false
  const refresh = (): void => {
    if (destroyed) return
    const items = collectGuideItems(root, options.steps ?? []).filter((item) => options.includeSections !== false || item.kind === 'action')
    layer.replaceChildren()
    items.forEach((item, index) => {
      const rect = item.element.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const box = doc.createElement('div')
      box.className = 'box'
      box.dataset.kind = item.kind
      Object.assign(box.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      })
      const label = doc.createElement('span')
      label.className = 'label'
      label.textContent = labelFor(
        index,
        item.kind,
        item.title,
        item.action,
        item.outcome,
        item.confirmation,
        item.element.matches(':disabled, [aria-disabled="true"]'),
      )
      box.append(label)
      layer.append(box)
    })
  }

  const view = doc.defaultView
  const update = (): void => refresh()
  view?.addEventListener('resize', update)
  view?.addEventListener('scroll', update, true)
  refresh()

  return {
    refresh,
    destroy: () => {
      destroyed = true
      view?.removeEventListener('resize', update)
      view?.removeEventListener('scroll', update, true)
      host.remove()
    },
  }
}
