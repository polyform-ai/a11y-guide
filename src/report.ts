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

/** Renders a dependency-free, standalone HTML report from one or more page evaluations. */
export function renderAgentReadyReport(options: AgentReadyReportOptions): string {
  if (!options.pages.length) throw new Error('At least one page evaluation is required.')
  const overall = Math.round(options.pages.reduce((total, page) => total + page.score, 0) / options.pages.length)
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const allFindings = options.pages.flatMap((page) => page.findings.map((finding) => ({ page, finding })))
  const issueCount = allFindings.length
  const pageRows = options.pages.map((page, pageIndex) => `
    <tr>
      <td><a href="#page-${pageIndex + 1}">${escapeHtml(page.page.title || page.page.url || 'Untitled page')}</a><small>${escapeHtml(page.page.url ?? '')}</small></td>
      <td><strong class="score ${tone(page.score)}">${page.score}</strong></td>
      ${page.dimensions.map((dimension) => `<td>${dimension.score}</td>`).join('')}
      <td>${page.findings.length}</td>
    </tr>`).join('')
  const pageSections = options.pages.map((page, pageIndex) => `
    <section class="page" id="page-${pageIndex + 1}">
      <div class="page-head"><div><p class="eyebrow">Page ${pageIndex + 1}</p><h2>${escapeHtml(page.page.title || 'Untitled page')}</h2><a href="${safeHref(page.page.url)}">${escapeHtml(page.page.url ?? 'URL unavailable')}</a></div><div class="mini-score ${tone(page.score)}"><strong>${page.score}</strong><span>/ 100</span></div></div>
      <div class="dimensions">${page.dimensions.map((dimension) => `<div class="dimension"><div><strong>${escapeHtml(dimension.label)}</strong><span>${dimension.score}</span></div><progress max="100" value="${dimension.score}" aria-label="${escapeHtml(dimension.label)} score ${dimension.score} out of 100"></progress><p>${escapeHtml(dimension.summary)}</p></div>`).join('')}</div>
      <div class="facts"><span>${page.counts.actions} actions</span><span>${page.counts.namedActions} named</span><span>${page.counts.guidedActions} with extra guidance</span><span>${page.counts.sections} sections</span></div>
      <h3>What needs attention</h3>
      ${page.findings.length ? `<div class="findings">${page.findings.map((finding) => `<article class="finding"><div><span class="impact ${finding.impact}">${escapeHtml(finding.impact)}</span><code>${escapeHtml(finding.rule)}</code></div><h4>${escapeHtml(finding.message)}</h4><p>${escapeHtml(finding.recommendation)}</p>${finding.selector ? `<code class="selector">${escapeHtml(finding.selector)}</code>` : ''}</article>`).join('')}</div>` : '<p class="empty">No findings from the automated checks on this rendered state.</p>'}
    </section>`).join('')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(options.title ?? 'Agent Readiness Report')}</title>
<style>:root{color-scheme:light;--ink:#172019;--muted:#617066;--line:#dbe4dd;--paper:#f4f7f4;--green:#17663a;--amber:#9a5d00;--red:#a33131}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit}main{width:min(1120px,calc(100% - 32px));margin:auto;padding:48px 0 80px}.hero{display:grid;grid-template-columns:260px 1fr;gap:40px;align-items:center;padding:38px;border:1px solid var(--line);border-radius:24px;background:#fff}.big-score{display:grid;place-items:center;aspect-ratio:1;border:14px solid currentColor;border-radius:50%;color:var(--green)}.big-score.good{color:#387447}.big-score.warn{color:var(--amber)}.big-score.poor{color:var(--red)}.big-score strong{font-size:72px;line-height:1}.big-score span{font-weight:700}.eyebrow{margin:0 0 8px;color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}h1{margin:0;font-size:clamp(34px,5vw,64px);line-height:1.02;letter-spacing:-.04em}h2{margin:0;font-size:30px;line-height:1.15}h3{margin:28px 0 12px}.lede{max-width:720px;font-size:18px;color:var(--muted)}.meta,.facts{display:flex;flex-wrap:wrap;gap:8px}.meta span,.facts span{padding:6px 10px;border-radius:999px;background:#edf3ee}.summary{margin-top:32px;padding:24px;overflow:auto;border:1px solid var(--line);border-radius:18px;background:#fff}table{width:100%;border-collapse:collapse;min-width:800px}th,td{padding:12px 10px;border-bottom:1px solid var(--line);text-align:left}th{font-size:12px;text-transform:uppercase;color:var(--muted)}td small{display:block;color:var(--muted);max-width:340px;overflow:hidden;text-overflow:ellipsis}.score{font-size:22px}.excellent{color:var(--green)}.good{color:#387447}.warn{color:var(--amber)}.poor{color:var(--red)}.page{margin-top:32px;padding:30px;border:1px solid var(--line);border-radius:22px;background:#fff}.page-head{display:flex;justify-content:space-between;gap:20px}.page-head a{color:var(--muted)}.mini-score{display:flex;align-items:baseline;gap:4px}.mini-score strong{font-size:48px;line-height:1}.dimensions{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:28px 0}.dimension{padding:14px;border:1px solid var(--line);border-radius:14px}.dimension>div{display:flex;justify-content:space-between;gap:8px}.dimension p{margin:8px 0 0;color:var(--muted);font-size:12px}progress{width:100%;height:8px;accent-color:var(--green)}.findings{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.finding{padding:18px;border:1px solid var(--line);border-radius:14px}.finding h4{margin:12px 0 6px}.finding p{margin:0;color:var(--muted)}code{font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}.impact{margin-right:8px;padding:3px 7px;border-radius:999px;font-size:11px;font-weight:800;text-transform:uppercase}.impact.critical{background:#fee2e2;color:#8b1d1d}.impact.serious{background:#ffedd5;color:#91420b}.impact.moderate{background:#fef3c7;color:#805000}.selector{display:block;margin-top:12px;overflow-wrap:anywhere}.method{margin-top:32px;padding:24px;border-left:5px solid var(--ink);background:#fff}.empty{padding:20px;border-radius:12px;background:#edf7ef;color:var(--green)}@media(max-width:850px){.hero{grid-template-columns:1fr}.big-score{width:210px}.dimensions,.findings{grid-template-columns:1fr 1fr}}@media(max-width:560px){main{width:min(100% - 20px,1120px);padding-top:10px}.hero,.page{padding:22px}.dimensions,.findings{grid-template-columns:1fr}.page-head{display:block}.mini-score{margin-top:18px}}</style></head>
<body><main><section class="hero"><div class="big-score ${tone(overall)}"><div><strong>${overall}</strong><br><span>out of 100</span></div></div><div><p class="eyebrow">Automated agent-readiness estimate</p><h1>${escapeHtml(options.title ?? 'Agent Readiness Report')}</h1><p class="lede">How clearly the rendered interface exposes structure, actions, state, guidance, and consequential boundaries to browser agents.</p><div class="meta"><span>${options.pages.length} page${options.pages.length === 1 ? '' : 's'}</span><span>${issueCount} finding${issueCount === 1 ? '' : 's'}</span>${options.siteUrl ? `<span>${escapeHtml(options.siteUrl)}</span>` : ''}<span>${escapeHtml(generatedAt)}</span></div></div></section>
<section class="summary"><h2>Score by page</h2><table><thead><tr><th>Page</th><th>Score</th>${options.pages[0]!.dimensions.map((dimension) => `<th>${escapeHtml(dimension.label)}</th>`).join('')}<th>Findings</th></tr></thead><tbody>${pageRows}</tbody></table></section>
${pageSections}
<section class="method"><h2>How to read this report</h2><p>The overall score is the unweighted average of page scores. Each page score weights structure 25%, actions 30%, state 15%, guidance 15%, and consequence safety 15%. Findings apply explicit deductions within their dimension. This makes the score deterministic and useful for regression tracking.</p><p><strong>This is not a WCAG score or proof that an agent can complete a task.</strong> The audit approximates accessible names from the rendered DOM. Verify the browser accessibility tree, screenshots at real viewport sizes, keyboard journeys, post-action feedback, and at least one end-to-end task with the agents you support.</p></section></main></body></html>`
}
