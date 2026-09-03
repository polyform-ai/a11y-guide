import type { AgentReadinessEvaluation } from './score.js'

export interface AgentReadyReportOptions {
  title?: string
  siteUrl?: string
  generatedAt?: string
  pages: AgentReadinessEvaluation[]
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

function safeHref(value: string | undefined): string {
  if (!value) return '#'
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? escapeHtml(value) : '#'
  } catch {
    return '#'
  }
}

function tone(score: number): string {
  if (score >= 90) return 'excellent'
  if (score >= 75) return 'good'
  if (score >= 50) return 'warn'
  return 'poor'
}

type ReportFinding = AgentReadinessEvaluation['findings'][number]

interface FindingGroup {
  rule: string
  impact: ReportFinding['impact']
  message: string
  recommendation: string
  selectors: string[]
  count: number
}

interface SiteFindingGroup extends Omit<FindingGroup, 'selectors'> {
  occurrences: Array<{
    pageIndex: number
    pageTitle: string
    pageUrl?: string
    selector?: string
  }>
}

function groupPageFindings(findings: ReportFinding[]): FindingGroup[] {
  const groups = new Map<string, FindingGroup>()
  findings.forEach((finding) => {
    const key = [finding.rule, finding.impact, finding.message, finding.recommendation].join('\u0000')
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      if (finding.selector && !existing.selectors.includes(finding.selector)) existing.selectors.push(finding.selector)
      return
    }
    groups.set(key, {
      rule: finding.rule,
      impact: finding.impact,
      message: finding.message,
      recommendation: finding.recommendation,
      selectors: finding.selector ? [finding.selector] : [],
      count: 1,
    })
  })
  return [...groups.values()]
}

function groupSiteFindings(pages: AgentReadinessEvaluation[]): SiteFindingGroup[] {
  const groups = new Map<string, SiteFindingGroup>()
  pages.forEach((page, pageIndex) => {
    page.findings.forEach((finding) => {
      const key = [finding.rule, finding.impact, finding.message, finding.recommendation].join('\u0000')
      const occurrence = {
        pageIndex,
        pageTitle: page.page.title || page.page.url || 'Untitled page',
        pageUrl: page.page.url,
        selector: finding.selector,
      }
      const existing = groups.get(key)
      if (existing) {
        existing.count += 1
        existing.occurrences.push(occurrence)
        return
      }
      groups.set(key, {
        rule: finding.rule,
        impact: finding.impact,
        message: finding.message,
        recommendation: finding.recommendation,
        count: 1,
        occurrences: [occurrence],
      })
    })
  })
  return [...groups.values()]
}

function remediationPrompt(options: AgentReadyReportOptions, overall: number): string {
  const site = options.siteUrl ?? options.pages[0]?.page.url ?? 'the audited site'
  const ruleGroups = new Map<string, { finding: ReportFinding; count: number; pages: Set<string> }>()
  options.pages.forEach((page) => {
    page.findings.forEach((finding) => {
      const key = [finding.rule, finding.impact, finding.recommendation].join('\u0000')
      const existing = ruleGroups.get(key)
      const pageName = page.page.url ?? (page.page.title || 'Untitled page')
      if (existing) {
        existing.count += 1
        existing.pages.add(pageName)
      } else {
        ruleGroups.set(key, { finding, count: 1, pages: new Set([pageName]) })
      }
    })
  })
  const impactRank = { critical: 0, serious: 1, moderate: 2 }
  const issues = [...ruleGroups.values()].sort((left, right) => {
    return impactRank[left.finding.impact] - impactRank[right.finding.impact] || right.count - left.count
  })
  const pageLines = options.pages.map((page) => `- ${page.page.url ?? (page.page.title || 'Untitled page')}: ${page.score}/100`)
  const issueLines = issues.map(({ finding, count, pages }) => {
    return `- [${finding.impact}] ${finding.rule}: ${count} occurrence${count === 1 ? '' : 's'} across ${pages.size} page${pages.size === 1 ? '' : 's'}. ${finding.recommendation}`
  })

  return `Task: Improve browser-agent and accessibility readiness across ${site}

Use this automated report as evidence and establish the current ${overall}/100 baseline before editing. The score is a prioritization signal, not WCAG certification or proof that every browser agent can complete a task.

Audited pages:
${pageLines.join('\n')}

Findings grouped by rule:
${issueLines.length ? issueLines.join('\n') : '- No automated findings were reported.'}

Requirements:
- Find and fix shared components or templates first; do not patch every occurrence independently.
- Prefer native HTML buttons, links, labels, headings, landmarks, and form controls. Do not add blanket ARIA or tabindex attributes.
- Give repeated actions names that distinguish their destination or effect, and expose current state, disabled reasons, outcomes, and completion feedback where relevant.
- Treat multiple rules reported for the same selector as overlapping evidence, not as separate affected controls.
- Verify each change against the rendered page, browser accessibility tree, keyboard navigation, focus behavior, and visible success or error feedback.
- Add focused regression tests and rerun the same representative pages. Report before-and-after scores, remaining limitations, and the exact validation commands used.
- Do not submit forms, publish content, make purchases, change accounts, or perform other consequential production actions while testing.`
}

/** Renders a dependency-free, standalone HTML report from one or more page evaluations. */
export function renderAgentReadyReport(options: AgentReadyReportOptions): string {
  if (!options.pages.length) throw new Error('At least one page evaluation is required.')
  const overall = Math.round(options.pages.reduce((total, page) => total + page.score, 0) / options.pages.length)
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const allFindings = options.pages.flatMap((page) => page.findings.map((finding) => ({ page, finding })))
  const issueCount = allFindings.length
  const pageGroups = options.pages.map((page) => groupPageFindings(page.findings))
  const siteGroups = groupSiteFindings(options.pages)
  const groupedIssueCount = siteGroups.length
  const prompt = remediationPrompt(options, overall)
  const pageRows = options.pages.map((page, pageIndex) => `
    <tr>
      <td><a href="#page-${pageIndex + 1}">${escapeHtml(page.page.title || page.page.url || 'Untitled page')}</a><small>${escapeHtml(page.page.url ?? '')}</small></td>
      <td><strong class="score ${tone(page.score)}">${page.score}</strong></td>
      ${page.dimensions.map((dimension) => `<td>${dimension.score}</td>`).join('')}
      <td>${pageGroups[pageIndex]!.length}<small>${page.findings.length} occurrence${page.findings.length === 1 ? '' : 's'}</small></td>
    </tr>`).join('')
  const siteFindings = siteGroups.map((group, groupIndex) => {
    const pages = new Map<number, SiteFindingGroup['occurrences']>()
    group.occurrences.forEach((occurrence) => {
      const existing = pages.get(occurrence.pageIndex) ?? []
      existing.push(occurrence)
      pages.set(occurrence.pageIndex, existing)
    })
    const locations = [...pages.values()].map((occurrences) => {
      const page = occurrences[0]!
      const selectors = [...new Set(occurrences.map((occurrence) => occurrence.selector).filter((selector): selector is string => Boolean(selector)))]
      return `<div class="location"><h4><a href="#page-${page.pageIndex + 1}">${escapeHtml(page.pageTitle)}</a><span>${occurrences.length} occurrence${occurrences.length === 1 ? '' : 's'}</span></h4>${page.pageUrl ? `<small>${escapeHtml(page.pageUrl)}</small>` : ''}${selectors.length ? `<div class="selectors">${selectors.map((selector) => `<code>${escapeHtml(selector)}</code>`).join('')}</div>` : ''}</div>`
    }).join('')
    return `<article class="finding" id="issue-${groupIndex + 1}"><div><span class="impact ${group.impact}">${escapeHtml(group.impact)}</span><code>${escapeHtml(group.rule)}</code><span class="count">${group.count} occurrence${group.count === 1 ? '' : 's'} across ${pages.size} page${pages.size === 1 ? '' : 's'}</span></div><h3>${escapeHtml(group.message)}</h3><p>${escapeHtml(group.recommendation)}</p>${locations ? `<details><summary>View affected pages and selectors</summary><div class="locations">${locations}</div></details>` : ''}</article>`
  }).join('')
  const pageSections = options.pages.map((page, pageIndex) => `
    <section class="page" id="page-${pageIndex + 1}">
      <div class="page-head"><div><p class="eyebrow">Page ${pageIndex + 1}</p><h2>${escapeHtml(page.page.title || 'Untitled page')}</h2><a href="${safeHref(page.page.url)}">${escapeHtml(page.page.url ?? 'URL unavailable')}</a></div><div class="mini-score ${tone(page.score)}"><strong>${page.score}</strong><span>/ 100</span></div></div>
      <div class="dimensions">${page.dimensions.map((dimension) => `<div class="dimension"><div><strong>${escapeHtml(dimension.label)}</strong><span>${dimension.score}</span></div><progress max="100" value="${dimension.score}" aria-label="${escapeHtml(dimension.label)} score ${dimension.score} out of 100"></progress><p>${escapeHtml(dimension.summary)}</p></div>`).join('')}</div>
      <div class="facts"><span>${page.counts.actions} actions</span><span>${page.counts.namedActions} named</span><span>${page.counts.guidedActions} with extra guidance</span><span>${page.counts.sections} sections</span></div>
    </section>`).join('')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(options.title ?? 'Agent Readiness Report')}</title>
<style>:root{color-scheme:light;--ink:#172019;--muted:#617066;--line:#dbe4dd;--paper:#f4f7f4;--green:#17663a;--amber:#9a5d00;--red:#a33131}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit}button,textarea{font:inherit}main{width:min(1120px,calc(100% - 32px));margin:auto;padding:48px 0 80px}.hero{display:grid;grid-template-columns:260px 1fr;gap:40px;align-items:center;padding:38px;border:1px solid var(--line);border-radius:24px;background:#fff}.big-score{display:grid;place-items:center;aspect-ratio:1;border:14px solid currentColor;border-radius:50%;color:var(--green)}.big-score.good{color:#387447}.big-score.warn{color:var(--amber)}.big-score.poor{color:var(--red)}.big-score strong{font-size:72px;line-height:1}.big-score span{font-weight:700}.eyebrow{margin:0 0 8px;color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}h1{margin:0;font-size:clamp(34px,5vw,64px);line-height:1.02;letter-spacing:-.04em}h2{margin:0;font-size:30px;line-height:1.15}h3{margin:28px 0 12px}.lede{max-width:720px;font-size:18px;color:var(--muted)}.meta,.facts{display:flex;flex-wrap:wrap;gap:8px}.meta span,.facts span{padding:6px 10px;border-radius:999px;background:#edf3ee}.fix-prompt,.summary,.site-findings{margin-top:32px;padding:24px;border:1px solid var(--line);border-radius:18px;background:#fff}.fix-prompt p{color:var(--muted)}.prompt-actions{display:flex;align-items:center;gap:12px;margin-top:10px}.copy{min-height:44px;padding:10px 16px;border:0;border-radius:999px;background:var(--ink);color:#fff;font-weight:800;cursor:pointer}.copy:focus-visible{outline:3px solid #78a987;outline-offset:3px}.copy-status{color:var(--green);font-weight:700}.fix-prompt textarea{display:block;width:100%;min-height:340px;margin-top:16px;padding:16px;resize:vertical;border:1px solid var(--line);border-radius:12px;background:#f8faf8;color:var(--ink);font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.summary{overflow:auto}table{width:100%;border-collapse:collapse;min-width:800px}th,td{padding:12px 10px;border-bottom:1px solid var(--line);text-align:left}th{font-size:12px;text-transform:uppercase;color:var(--muted)}td small{display:block;color:var(--muted);max-width:340px;overflow:hidden;text-overflow:ellipsis}.score{font-size:22px}.excellent{color:var(--green)}.good{color:#387447}.warn{color:var(--amber)}.poor{color:var(--red)}.page{margin-top:32px;padding:30px;border:1px solid var(--line);border-radius:22px;background:#fff}.page-head{display:flex;justify-content:space-between;gap:20px}.page-head a{color:var(--muted)}.mini-score{display:flex;align-items:baseline;gap:4px}.mini-score strong{font-size:48px;line-height:1}.dimensions{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:28px 0}.dimension{padding:14px;border:1px solid var(--line);border-radius:14px}.dimension>div{display:flex;justify-content:space-between;gap:8px}.dimension p{margin:8px 0 0;color:var(--muted);font-size:12px}progress{width:100%;height:8px;accent-color:var(--green)}.findings{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:18px}.finding{padding:18px;border:1px solid var(--line);border-radius:14px}.finding h3{margin:12px 0 6px;font-size:18px}.finding h4{margin:12px 0 6px}.finding p{margin:0;color:var(--muted)}code{font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}.impact{margin-right:8px;padding:3px 7px;border-radius:999px;font-size:11px;font-weight:800;text-transform:uppercase}.impact.critical{background:#fee2e2;color:#8b1d1d}.impact.serious{background:#ffedd5;color:#91420b}.impact.moderate{background:#fef3c7;color:#805000}.count{display:block;margin-top:8px;color:var(--muted);font-size:12px;font-weight:800}.finding details{margin-top:12px}.finding summary{cursor:pointer;font-weight:700}.locations{display:grid;gap:12px;margin-top:12px}.location{padding-top:12px;border-top:1px solid var(--line)}.location h4{display:flex;justify-content:space-between;gap:12px;margin:0}.location h4 span,.location small{color:var(--muted);font-size:12px}.selectors{display:grid;gap:6px;margin-top:8px}.selectors code{overflow-wrap:anywhere}.method{margin-top:32px;padding:24px;border-left:5px solid var(--ink);background:#fff}.empty{padding:20px;border-radius:12px;background:#edf7ef;color:var(--green)}@media(max-width:850px){.hero{grid-template-columns:1fr}.big-score{width:210px}.dimensions,.findings{grid-template-columns:1fr 1fr}}@media(max-width:560px){main{width:min(100% - 20px,1120px);padding-top:10px}.hero,.page{padding:22px}.dimensions,.findings{grid-template-columns:1fr}.page-head{display:block}.mini-score{margin-top:18px}}</style></head>
<body><main><section class="hero"><div class="big-score ${tone(overall)}"><div><strong>${overall}</strong><br><span>out of 100</span></div></div><div><p class="eyebrow">Automated agent-readiness estimate</p><h1>${escapeHtml(options.title ?? 'Agent Readiness Report')}</h1><p class="lede">How clearly the rendered interface exposes structure, actions, state, guidance, and consequential boundaries to browser agents.</p><div class="meta"><span>${options.pages.length} page${options.pages.length === 1 ? '' : 's'}</span><span>${groupedIssueCount} issue group${groupedIssueCount === 1 ? '' : 's'}</span><span>${issueCount} occurrence${issueCount === 1 ? '' : 's'}</span>${options.siteUrl ? `<span>${escapeHtml(options.siteUrl)}</span>` : ''}<span>${escapeHtml(generatedAt)}</span></div></div></section>
<section class="fix-prompt" aria-labelledby="fix-prompt-title"><p class="eyebrow">Copy and paste</p><h2 id="fix-prompt-title">Give this remediation prompt to a coding agent</h2><p>It summarizes the audited pages and groups repeated findings so the agent can fix shared components first.</p><textarea id="remediation-prompt" readonly>${escapeHtml(prompt)}</textarea><div class="prompt-actions"><button class="copy" type="button" id="copy-remediation-prompt">Copy prompt</button><span class="copy-status" id="copy-status" role="status" aria-live="polite"></span></div></section>
<section class="summary"><h2>Score by page</h2><table><thead><tr><th>Page</th><th>Score</th>${options.pages[0]!.dimensions.map((dimension) => `<th>${escapeHtml(dimension.label)}</th>`).join('')}<th>Issue groups</th></tr></thead><tbody>${pageRows}</tbody></table></section>
<section class="site-findings"><p class="eyebrow">Prioritized findings</p><h2>What needs attention across the site</h2>${siteFindings ? `<div class="findings">${siteFindings}</div>` : '<p class="empty">No findings from the automated checks on these rendered states.</p>'}</section>
${pageSections}
<section class="method"><h2>How to read this report</h2><p>The overall score is the unweighted average of page scores. Each page score weights structure 25%, actions 30%, state 15%, guidance 15%, and consequence safety 15%. Findings apply explicit deductions within their dimension. Repeated identical findings are grouped once across the site, while every occurrence keeps its page and selector attribution.</p><p><strong>This is not a WCAG score or proof that an agent can complete a task.</strong> The audit approximates accessible names from the rendered DOM. Verify the browser accessibility tree, screenshots at real viewport sizes, keyboard journeys, post-action feedback, and at least one end-to-end task with the agents you support.</p></section></main><script>document.getElementById('copy-remediation-prompt').addEventListener('click',async()=>{const field=document.getElementById('remediation-prompt');const status=document.getElementById('copy-status');try{await navigator.clipboard.writeText(field.value);status.textContent='Copied.'}catch{field.select();status.textContent=document.execCommand('copy')?'Copied.':'Select the prompt and copy it.'}})</script></body></html>`
}
