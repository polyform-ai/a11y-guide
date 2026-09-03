import { auditGuidance, auditPage, type AuditFinding, type AuditImpact, type AuditOptions } from './audit.js'
import { collectGuideItems } from './discover.js'
import { accessibleName, isDisabled, visibleText } from './dom.js'
import { buildGuideManifest } from './manifest.js'
import type { GuideManifest } from './types.js'

export type AgentReadinessDimensionId = 'structure' | 'actions' | 'state' | 'guidance' | 'safety'
export type AgentReadinessGrade = 'excellent' | 'good' | 'needs-work' | 'poor'

export interface AgentReadinessDimension {
  id: AgentReadinessDimensionId
  label: string
  score: number
  weight: number
  summary: string
}

export interface AgentReadinessFinding {
  rule: string
  impact: AuditImpact
  dimension: AgentReadinessDimensionId
  message: string
  recommendation: string
  selector?: string
  deduction: number
}

export interface AgentReadinessEvaluation {
  schema: 'https://github.com/polyform-ai/a11y-guide/blob/main/docs/agent-readiness-report-v1.md'
  version: 1
  page: {
    title: string
    url?: string
    language?: string
  }
  score: number
  grade: AgentReadinessGrade
  dimensions: AgentReadinessDimension[]
  findings: AgentReadinessFinding[]
  counts: {
    actions: number
    sections: number
    namedActions: number
    guidedActions: number
    disabledActions: number
  }
  coverage: {
    checked: string[]
    notChecked: string[]
  }
  manifest: GuideManifest
}

const DIMENSIONS: Record<AgentReadinessDimensionId, Omit<AgentReadinessDimension, 'score'>> = {
  structure: { id: 'structure', label: 'Structure', weight: 25, summary: 'Page title, language, landmarks, headings, and stable document structure.' },
  actions: { id: 'actions', label: 'Actions', weight: 30, summary: 'Discoverable controls with clear roles, names, labels, and keyboard behavior.' },
  state: { id: 'state', label: 'State & feedback', weight: 15, summary: 'Current values, disabled state, relationships, and change feedback exposed to agents.' },
  guidance: { id: 'guidance', label: 'Guidance', weight: 15, summary: 'Plain-language purpose, prerequisites, outcomes, and completion signals.' },
  safety: { id: 'safety', label: 'Consequence safety', weight: 15, summary: 'Clear boundaries and confirmation for financial, destructive, or external effects.' },
}

const RULE_DIMENSION: Record<string, AgentReadinessDimensionId> = {
  'document-title': 'structure',
  'html-lang': 'structure',
  'main-landmark': 'structure',
  'duplicate-id': 'structure',
  'heading-order': 'structure',
  'image-alt': 'structure',
  'accessible-name': 'actions',
  'form-label': 'actions',
  'positive-tabindex': 'actions',
  'custom-control-keyboard': 'actions',
  'custom-control-native-html': 'actions',
  'duplicate-action-name': 'actions',
  'guide-target': 'actions',
  'guide-selector': 'actions',
  'guide-label-in-name': 'actions',
  'guide-action-name': 'actions',
  'aria-controls-target': 'state',
  'guide-disabled-reason': 'state',
  'guide-context-json': 'state',
  'guide-ambiguous-action': 'guidance',
  'guide-consequence': 'safety',
  'guide-completion': 'safety',
  'guide-confirmation': 'safety',
  'guide-sensitive-context': 'safety',
  'inferred-consequence-guidance': 'safety',
}

const RECOMMENDATIONS: Record<string, string> = {
  'document-title': 'Add a concise title that distinguishes this page from the rest of the site.',
  'html-lang': 'Set the document language on the html element.',
  'main-landmark': 'Expose exactly one main landmark for the primary page content.',
  'duplicate-id': 'Give every element a unique id so labels and relationships resolve reliably.',
  'heading-order': 'Use a logical heading outline without skipping levels.',
  'image-alt': 'Add truthful alternative text, or alt="" when the image is decorative.',
  'accessible-name': 'Use a native control with a concise accessible name that matches its visible label.',
  'form-label': 'Associate a visible label with the form control; do not rely on placeholder text.',
  'positive-tabindex': 'Keep DOM order logical and use tabindex="0" only when a custom control is unavoidable.',
  'custom-control-keyboard': 'Replace the custom clickable element with a native button or link.',
  'custom-control-native-html': 'Prefer a native button or link and verify Enter, Space, and focus behavior.',
  'duplicate-action-name': 'Make each repeated action name specific enough to distinguish its destination or effect.',
  'guide-target': 'Update or remove the stale guide selector.',
  'guide-selector': 'Replace the invalid selector with a stable id or data-a11y-guide-id.',
  'guide-label-in-name': 'Keep the visible label inside the accessible name, ideally with identical leading words.',
  'guide-action-name': 'Give the action a truthful accessible name.',
  'aria-controls-target': 'Point aria-controls to an existing, stable element id.',
  'guide-disabled-reason': 'Explain what is required to enable the action and keep that explanation current.',
  'guide-context-json': 'Use a valid JSON object containing only non-sensitive primitive values.',
  'guide-ambiguous-action': 'Name the object and expected result, such as “Continue to shipping”.',
  'guide-consequence': 'Describe exactly what changes if this action succeeds.',
  'guide-completion': 'Expose a visible or announced signal that proves the action finished.',
  'guide-confirmation': 'Add a review step or explicit confirmation before committing the action.',
  'guide-sensitive-context': 'Remove personal data and secrets from public guidance metadata.',
  'inferred-consequence-guidance': 'Annotate the action type, outcome, completion signal, and confirmation boundary.',
}

const IMPACT_DEDUCTION: Record<AuditImpact, number> = { critical: 28, serious: 14, moderate: 6 }
const CONSEQUENCE_TEXT = /\b(buy|purchase|pay|place order|checkout|delete|remove account|cancel subscription|send|publish|transfer|book)\b/i

function ownerDocument(root: Document | HTMLElement): Document {
  const doc = root.nodeType === 9 ? root as Document : root.ownerDocument
  if (!doc) throw new Error('The evaluation root must belong to a document.')
  return doc
}

function serializedFinding(item: AuditFinding): AgentReadinessFinding {
  const dimension = RULE_DIMENSION[item.rule] ?? 'actions'
  return {
    rule: item.rule,
    impact: item.impact,
    dimension,
    message: item.message,
    recommendation: RECOMMENDATIONS[item.rule] ?? 'Inspect the element and make its purpose, state, and behavior unambiguous.',
    selector: item.selector,
    deduction: IMPACT_DEDUCTION[item.impact],
  }
}

function gradeFor(score: number): AgentReadinessGrade {
  if (score >= 90) return 'excellent'
  if (score >= 75) return 'good'
  if (score >= 50) return 'needs-work'
  return 'poor'
}

/** Produces a deterministic, explainable estimate of how legible the rendered page is to browser agents. */
export function evaluateAgentReadiness(options: AuditOptions = {}): AgentReadinessEvaluation {
  const root = options.root ?? document
  const doc = ownerDocument(root)
  const items = collectGuideItems(root, options.steps ?? [], options.autoDiscover !== false, { readOnly: options.readOnly })
  const actions = items.filter((item) => item.kind === 'action')
  const findings = [...auditPage(options), ...auditGuidance(options)].map(serializedFinding)

  actions.forEach((item) => {
    const text = [item.title, visibleText(item.element)].join(' ')
    if (!item.element.matches('button, input[type="button"], input[type="submit"], [role="button"]') || !CONSEQUENCE_TEXT.test(text) || item.action === 'purchase' || item.action === 'delete') return
    findings.push({
      rule: 'inferred-consequence-guidance',
      impact: 'moderate',
      dimension: 'safety',
      message: `“${item.title}” may create a consequential effect, but its boundary is not described.`,
      recommendation: RECOMMENDATIONS['inferred-consequence-guidance'],
      selector: item.selector,
      deduction: IMPACT_DEDUCTION.moderate,
    })
  })

  const dimensions = Object.values(DIMENSIONS).map((dimension) => {
    const deduction = findings.filter((item) => item.dimension === dimension.id).reduce((total, item) => total + item.deduction, 0)
    return { ...dimension, score: Math.max(0, 100 - deduction) }
  })
  const score = Math.round(dimensions.reduce((total, dimension) => total + dimension.score * dimension.weight, 0) / 100)

  return {
    schema: 'https://github.com/polyform-ai/a11y-guide/blob/main/docs/agent-readiness-report-v1.md',
    version: 1,
    page: { title: doc.title, url: doc.location?.href || undefined, language: doc.documentElement.lang || undefined },
    score,
    grade: gradeFor(score),
    dimensions,
    findings: findings.sort((left, right) => IMPACT_DEDUCTION[right.impact] - IMPACT_DEDUCTION[left.impact]),
    counts: {
      actions: actions.length,
      sections: items.length - actions.length,
      namedActions: actions.filter((item) => accessibleName(item.element)).length,
      guidedActions: actions.filter((item) => item.description || item.outcome || item.requirements?.length || item.completion).length,
      disabledActions: actions.filter((item) => isDisabled(item.element)).length,
    },
    coverage: {
      checked: ['Rendered DOM structure', 'Accessible-name approximation', 'Visible interactive controls', 'Exposed control state', 'Authored Page Guide metadata'],
      notChecked: ['Exact browser accessibility tree', 'Screenshot grounding and visual salience', 'Keyboard journey completion', 'Post-action behavior', 'Screen-reader output', 'WCAG conformance'],
    },
    manifest: buildGuideManifest(doc, items),
  }
}
