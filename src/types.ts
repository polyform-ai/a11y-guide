export type GuideItemKind = 'section' | 'action'
export type GuideContextValue = string | number | boolean
export type GuideContext = Record<string, GuideContextValue>
export type GuideConfirmation = 'none' | 'review' | 'explicit'
export type GuideActionType = 'navigate' | 'select' | 'toggle' | 'submit' | 'add-to-cart' | 'purchase' | 'delete' | 'download' | 'upload' | 'custom'

export interface GuideStep {
  /** A stable identifier used for rendering and test output. */
  id: string
  /** A selector resolved inside the configured root. */
  selector: string
  /** Short text shown in the guide and announced when the target is reached. */
  title: string
  /** Optional explanation of what the region or control lets a visitor do. */
  description?: string
  /** What will change after the action succeeds. */
  outcome?: string
  /** A machine-readable description of the operation. */
  action?: GuideActionType
  /** A useful boundary that states what activating the control will not do. */
  doesNot?: string
  /** Whether the interface provides a review or requires explicit confirmation. */
  confirmation?: GuideConfirmation
  /** The visible or announced state that proves the action succeeded. */
  completion?: string
  /** Conditions that must already be true before the action can succeed. */
  requirements?: string[]
  /** Small, non-sensitive facts useful to people and browser agents. */
  context?: GuideContext
  /** Sections explain the page; actions identify things a visitor can operate. */
  kind?: GuideItemKind
}

export interface ResolvedGuideStep extends GuideStep {
  element: HTMLElement
  kind: GuideItemKind
}

export interface GuideOptions {
  root?: Document | HTMLElement
  steps?: GuideStep[]
  /** Discover headings, landmarks, links, buttons, and form controls. Defaults to true. */
  autoDiscover?: boolean
  /** Keep the guide synchronized with client-rendered page changes. Defaults to true. */
  observe?: boolean
  label?: string
  title?: string
  introduction?: string
  /** Set false when the host application manages scrolling itself. */
  scroll?: boolean
  /** Close the guide after moving to a target. Defaults to true. */
  closeOnNavigate?: boolean
  /** Publish a JSON snapshot in the DOM for browser agents. Defaults to true. */
  exposeManifest?: boolean
}

export interface GuideController {
  open(): void
  close(): void
  refresh(): void
  destroy(): void
  getItems(): ResolvedGuideStep[]
  getManifest(): GuideManifest
  /** Score the currently rendered page using the same model as the report API. */
  getAgentReadiness(): import('./score.js').AgentReadinessEvaluation
  goTo(id: string): boolean
}

export interface GuideManifestItem extends Omit<GuideStep, 'kind'> {
  kind: GuideItemKind
  element: {
    tagName: string
    role?: string
    accessibleName: string
    visibleText?: string
    disabled: boolean
    state?: GuideContext
  }
}

export interface GuideManifest {
  schema: 'https://github.com/polyform-ai/a11y-guide/blob/main/docs/manifest-v1.md'
  version: 1
  page: {
    title: string
    language?: string
    url?: string
  }
  items: GuideManifestItem[]
}
