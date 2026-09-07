# Agent readiness report v1

`evaluateAgentReadiness()` produces a deterministic estimate of how clearly a rendered page exposes itself to browser agents. `renderAgentReadyReport()` combines one or more evaluations into a standalone HTML report.

The HTML report groups repeated identical findings once across the whole site, shows their occurrence and page counts, and keeps affected pages and selectors in a collapsed list. Its copy-ready remediation prompt aggregates findings by rule so a coding agent can fix shared components and templates before individual occurrences.

The score is intentionally explainable. Each page starts at 100 in five dimensions. Findings deduct points inside their dimension, stopping at zero:

| Dimension | Weight | What the automated audit covers |
| --- | ---: | --- |
| Structure | 25% | Document title and language, main landmark, headings, IDs, and image alternatives |
| Actions | 30% | Interactive roles, accessible names, form labels, keyboard exposure, stable targets, and distinguishable actions |
| State & feedback | 15% | Exposed state, disabled-state guidance, relationships, and valid structured context |
| Guidance | 15% | Specific action language, purpose, prerequisites, and author-supplied guidance |
| Consequence safety | 15% | Outcomes, completion signals, confirmation boundaries, and sensitive-data checks |

Critical, serious, and moderate finding patterns deduct 28, 14, and 6 points respectively. Within a page and dimension, the same rule, impact, and recommendation deduct once even when a shared component produces many messages or occurrences. Every occurrence, message, and selector remains in `findings` as evidence. Distinct rules still deduct separately. The page score is the weighted average of its dimension scores. A site report is the unweighted average of its page scores so a weak page cannot disappear behind a high-traffic weighting choice.

Grades are labels for readability only: excellent is 90–100, good is 75–89, needs work is 50–74, and poor is below 50.

## Important boundary

This report is not a WCAG audit or certification, and it does not predict every agent. It analyzes a rendered DOM and uses a pragmatic accessible-name approximation. It does not directly read Chrome's complete accessibility tree or prove visual grounding, focus order, task completion, post-action feedback, screen-reader output, authentication, bot access, or machine-readable site protocols.

Use the report as a regression signal. Pair it with a comprehensive accessibility engine, the browser Accessibility pane, real viewport screenshots, keyboard and screen-reader review, and representative end-to-end tasks in the agents you support.

## API

```ts
import { evaluateAgentReadinessWhenStable, renderAgentReadyReport } from '@polyform-ai/a11y-guide'

const page = await evaluateAgentReadinessWhenStable({
  settleTimeMs: 100,
  timeoutMs: 5000,
})
const html = renderAgentReadyReport({
  title: 'Example site agent readiness',
  siteUrl: 'https://example.com',
  pages: [page],
  sanitize: (value, { field }) => {
    if (field === 'page-url' || field === 'finding-selector') return undefined
    return value
  },
})
```

`GuideController#getAgentReadiness()` evaluates the page with the same root and authored steps used by the guide. This is convenient for Playwright, browser extensions, and other tools that already integrate `createGuide()`.

`evaluateAgentReadiness()` remains the synchronous API for a document that is already settled. `evaluateAgentReadinessWhenStable()` resets its quiet-period timer after each DOM mutation, supports an `AbortSignal`, and rejects at `timeoutMs`; it does not wait for network-idle or prove that application data is complete.

`renderAgentReadyReport()` can receive a `sanitize(value, context)` callback. It runs on report titles, site and page URLs, page titles, generated timestamps, finding messages, recommendations, and selectors before either the HTML or copyable remediation prompt is assembled. Returning `undefined` removes an optional value or replaces required finding text with a neutral redaction. The source evaluations—including their manifests—remain unchanged and must still be handled as potentially sensitive data.
