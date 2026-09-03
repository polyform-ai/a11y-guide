# Agent readiness report v1

`evaluateAgentReadiness()` produces a deterministic estimate of how clearly a rendered page exposes itself to browser agents. `renderAgentReadyReport()` combines one or more evaluations into a standalone HTML report.

The score is intentionally explainable. Each page starts at 100 in five dimensions. Findings deduct points inside their dimension, stopping at zero:

| Dimension | Weight | What the automated audit covers |
| --- | ---: | --- |
| Structure | 25% | Document title and language, main landmark, headings, IDs, and image alternatives |
| Actions | 30% | Interactive roles, accessible names, form labels, keyboard exposure, stable targets, and distinguishable actions |
| State & feedback | 15% | Exposed state, disabled-state guidance, relationships, and valid structured context |
| Guidance | 15% | Specific action language, purpose, prerequisites, and author-supplied guidance |
| Consequence safety | 15% | Outcomes, completion signals, confirmation boundaries, and sensitive-data checks |

Critical, serious, and moderate findings deduct 28, 14, and 6 points respectively. The page score is the weighted average of its dimension scores. A site report is the unweighted average of its page scores so a weak page cannot disappear behind a high-traffic weighting choice.

Grades are labels for readability only: excellent is 90–100, good is 75–89, needs work is 50–74, and poor is below 50.

## Important boundary

This report is not a WCAG audit or certification, and it does not predict every agent. It analyzes a rendered DOM and uses a pragmatic accessible-name approximation. It does not directly read Chrome's complete accessibility tree or prove visual grounding, focus order, task completion, post-action feedback, screen-reader output, authentication, bot access, or machine-readable site protocols.

Use the report as a regression signal. Pair it with a comprehensive accessibility engine, the browser Accessibility pane, real viewport screenshots, keyboard and screen-reader review, and representative end-to-end tasks in the agents you support.

## API

```ts
import { evaluateAgentReadiness, renderAgentReadyReport } from '@polyform-ai/a11y-guide'

const page = evaluateAgentReadiness()
const html = renderAgentReadyReport({
  title: 'Example site agent readiness',
  siteUrl: 'https://example.com',
  pages: [page],
})
```

`GuideController#getAgentReadiness()` evaluates the page with the same root and authored steps used by the guide. This is convenient for Playwright, browser extensions, and other tools that already integrate `createGuide()`.
