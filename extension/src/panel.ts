import { renderAgentReadyReport } from '../../src/report.js'
import type { AgentReadinessEvaluation } from '../../src/score.js'

declare const chrome: {
  runtime: { getURL(path: string): string }
  devtools: { inspectedWindow: { eval(expression: string, callback: (result: unknown, exception?: { value?: string; description?: string }) => void): void } }
}

const status = document.querySelector<HTMLElement>('#status')!
const results = document.querySelector<HTMLElement>('#results')!
const refreshButton = document.querySelector<HTMLButtonElement>('#refresh')!
const overlayButton = document.querySelector<HTMLButtonElement>('#overlay')!
const exportButton = document.querySelector<HTMLButtonElement>('#export')!
let latest: AgentReadinessEvaluation | undefined
let overlayVisible = false

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

function pageEval<T>(expression: string): Promise<T> {
  return new Promise((resolve, reject) => chrome.devtools.inspectedWindow.eval(expression, (result, exception) => {
    if (exception) reject(new Error(exception.description ?? exception.value ?? 'The inspected page rejected the scan.'))
    else resolve(result as T)
  }))
}

function scoreTone(score: number): string {
  if (score < 50) return 'poor'
  if (score < 75) return 'warn'
  return ''
}

function render(evaluation: AgentReadinessEvaluation): void {
  latest = evaluation
  const title = evaluation.page.title || evaluation.page.url || 'Untitled page'
  results.innerHTML = `<div class="overview"><div class="score ${scoreTone(evaluation.score)}"><div><strong>${evaluation.score}</strong><span>out of 100</span></div></div><div><p class="eyebrow">Automated readiness estimate</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(evaluation.page.url ?? '')}</p><div class="facts"><span>${evaluation.counts.actions} actions</span><span>${evaluation.counts.namedActions} named</span><span>${evaluation.counts.guidedActions} guided</span><span>${evaluation.counts.sections} sections</span></div></div></div>
  <div class="dimensions">${evaluation.dimensions.map((dimension) => `<article class="dimension"><div><strong>${escapeHtml(dimension.label)}</strong><span>${dimension.score}</span></div><progress max="100" value="${dimension.score}"></progress><p>${escapeHtml(dimension.summary)}</p></article>`).join('')}</div>
  <h2>Findings</h2>${evaluation.findings.length ? evaluation.findings.map((finding) => `<article class="finding"><div><span class="impact ${finding.impact}">${escapeHtml(finding.impact)}</span><h3>${escapeHtml(finding.message)}</h3><p>${escapeHtml(finding.recommendation)}</p>${finding.selector ? `<code>${escapeHtml(finding.selector)}</code>` : ''}</div>${finding.selector ? `<button type="button" data-inspect="${escapeHtml(finding.selector)}">Inspect</button>` : ''}</article>`).join('') : '<p>No findings from the automated checks on this rendered state.</p>'}
  <p class="boundary"><strong>Boundary:</strong> this approximates semantics from the rendered DOM. Compare it with Chrome’s Accessibility pane and a real screenshot-driven task before treating a page as agent-ready.</p>`
  results.hidden = false
  status.hidden = true
  results.querySelectorAll<HTMLButtonElement>('[data-inspect]').forEach((button) => button.addEventListener('click', () => {
    const selector = button.dataset.inspect
    if (selector) void pageEval(`inspect(document.querySelector(${JSON.stringify(selector)}))`)
  }))
}

async function scan(): Promise<void> {
  status.hidden = false
  status.textContent = 'Scanning the rendered page…'
  results.hidden = true
  try {
    const source = await fetch(chrome.runtime.getURL('page-scan.js')).then((response) => response.text())
    await pageEval(`${source}\ntrue`)
    const evaluation = await pageEval<AgentReadinessEvaluation>('window.__polyformAgentReadinessScan()')
    render(evaluation)
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'The page could not be scanned.'
  }
}

const overlayExpression = `(() => {
  const existing = document.querySelector('[data-polyform-agent-overlay]');
  if (existing) { existing.remove(); return false; }
  const host = document.createElement('div'); host.dataset.polyformAgentOverlay = '';
  const root = host.attachShadow({mode:'open'}); const layer = document.createElement('div');
  const style = document.createElement('style'); style.textContent = ':host{position:fixed;inset:0;z-index:2147483646;pointer-events:none}.box{position:fixed;border:2px solid #7c3aed;background:#7c3aed12}.box.section{border-color:#059669;background:#05966910}.tag{position:absolute;left:-2px;bottom:100%;max-width:260px;padding:2px 5px;background:#171717;color:#fff;font:600 10px/1.3 ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  root.append(style,layer); document.body.append(host);
  const selector = 'main,nav,aside,h1,h2,h3,a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=checkbox],[role=switch],[role=tab]';
  [...document.querySelectorAll(selector)].filter(el => { const r=el.getBoundingClientRect(); const s=getComputedStyle(el); return r.width&&r.height&&s.display!=='none'&&s.visibility!=='hidden'&&!el.closest('[hidden],[aria-hidden=true],[inert]'); }).forEach((el,index) => { const r=el.getBoundingClientRect(); const box=document.createElement('div'); const section=el.matches('main,nav,aside,h1,h2,h3'); box.className='box'+(section?' section':''); Object.assign(box.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'}); const tag=document.createElement('span'); tag.className='tag'; const name=el.getAttribute('aria-label')||el.innerText||el.getAttribute('alt')||el.getAttribute('title')||el.tagName.toLowerCase(); tag.textContent=(section?'S':'A')+(index+1)+' · '+name.trim().replace(/\\s+/g,' ').slice(0,80); box.append(tag); layer.append(box); });
  return true;
})()`

refreshButton.addEventListener('click', () => void scan())
overlayButton.addEventListener('click', async () => {
  overlayVisible = await pageEval<boolean>(overlayExpression)
  overlayButton.textContent = overlayVisible ? 'Hide overlay' : 'Show overlay'
})
exportButton.addEventListener('click', () => {
  if (!latest) return
  const html = renderAgentReadyReport({ title: `${latest.page.title || 'Page'} agent readiness`, siteUrl: latest.page.url, pages: [latest] })
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'agent-readiness-report.html'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
})

void scan()
