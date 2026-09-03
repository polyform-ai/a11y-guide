export type SiteLinkContext = 'navigation' | 'header' | 'main' | 'article' | 'footer' | 'unknown'

export interface SiteLinkCandidate {
  href: string
  text?: string
  context?: SiteLinkContext
}

export interface RepresentativeSitePlanOptions {
  startUrl: string
  links: SiteLinkCandidate[]
  /** Total pages, including the start page. Defaults to 12. */
  maxPages?: number
  /** Representative article/detail pages allowed after section pages. Defaults to 2. */
  maxDetailPages?: number
  /** Exact same-site paths that should be considered before discovered routes. */
  preferredPaths?: string[]
}

export interface RepresentativeSiteRoute {
  url: string
  kind: 'home' | 'section' | 'detail'
  label?: string
  context?: SiteLinkContext
}

export interface RepresentativeSitePlan {
  routes: RepresentativeSiteRoute[]
  considered: number
  excluded: {
    external: number
    asset: number
    utility: number
    duplicate: number
    detailLimit: number
    pageLimit: number
  }
}

const ASSET_PATH = /\.(?:avif|css|csv|docx?|gif|ico|jpe?g|js|json|mp3|mp4|pdf|png|pptx?|rss|svg|txt|webm|webp|xlsx?|xml|zip)$/i
const UTILITY_PATH = /(?:^|\/)(?:account|download|downloads|export|exports|feed|login|logout|search|signin|signup|wp-admin|wp-json)(?:\/|$)/i
const PAGINATION_PATH = /(?:^|\/)page\/\d+(?:\/|$)/i
const DATE_PATH = /(?:^|\/)20\d{2}\/(?:0?[1-9]|1[0-2])(?:\/|$)/
const DETAIL_ROOT = new Set(['article', 'articles', 'post', 'posts', 'story', 'stories'])

function hostKey(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function normalizedPath(pathname: string): string {
  const clean = pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '')
  return clean || '/'
}

function decodedPath(pathname: string): string | undefined {
  let decoded = pathname
  for (let pass = 0; pass < 16; pass += 1) {
    let next: string
    try {
      next = decodeURIComponent(decoded)
    } catch {
      return undefined
    }
    if (next === decoded) return normalizedPath(decoded.replace(/\\/g, '/'))
    decoded = next
  }
  // Reject unusually deep encoding instead of auditing a route whose final
  // meaning remains hidden beyond the safety boundary.
  return undefined
}

function absoluteRouteUrl(start: URL, pathname: string): string {
  const url = new URL(start.origin)
  url.pathname = pathname
  return url.href
}

function pathSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean)
}

function looksLikeDetail(pathname: string, context: SiteLinkContext): boolean {
  const segments = pathSegments(pathname)
  if (context === 'navigation' || context === 'header') return false
  if (DATE_PATH.test(pathname) || context === 'article' || segments.length >= 3) return true
  if (segments.length >= 2 && DETAIL_ROOT.has(segments[0]!.toLowerCase())) return true
  const finalSegment = segments.at(-1) ?? ''
  const slugWords = finalSegment.split('-').filter(Boolean).length
  return finalSegment.length > 48 || slugWords >= (segments.length === 1 ? 3 : 5)
}

function contextRank(context: SiteLinkContext): number {
  return { navigation: 0, header: 1, main: 2, footer: 3, article: 4, unknown: 5 }[context]
}

function sectionFamily(pathname: string): string {
  const segments = pathSegments(pathname)
  if (!segments.length) return '/'
  if (['category', 'section', 'topic', 'topics'].includes(segments[0]!.toLowerCase()) && segments[1]) {
    return `/${segments[0]}/${segments[1]}`
  }
  return `/${segments[0]}`
}

function finiteLimit(value: number | undefined, fallback: number, minimum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.max(minimum, Math.floor(value))
}

/**
 * Selects a bounded, representative same-site audit plan from rendered links.
 * It never recursively crawls selected pages, strips query/hash variants, and
 * caps article-like routes separately so a large publication cannot explode
 * into an unbounded crawl.
 */
export function selectRepresentativeSiteRoutes(options: RepresentativeSitePlanOptions): RepresentativeSitePlan {
  const start = new URL(options.startUrl)
  const startPath = decodedPath(start.pathname) ?? normalizedPath(start.pathname)
  const maxPages = finiteLimit(options.maxPages, 12, 1)
  const maxDetailPages = finiteLimit(options.maxDetailPages, 2, 0)
  const excluded = { external: 0, asset: 0, utility: 0, duplicate: 0, detailLimit: 0, pageLimit: 0 }
  const candidates: Array<RepresentativeSiteRoute & { index: number; pathname: string; preferred: boolean; preferredRank: number }> = []
  const seen = new Set<string>([startPath])
  const preferredRanks = new Map<string, number>()

  options.preferredPaths?.forEach((href, index) => {
    try {
      const url = new URL(href, start)
      if (['http:', 'https:'].includes(url.protocol) && hostKey(url.hostname) === hostKey(start.hostname)) {
        const pathname = decodedPath(url.pathname)
        if (!pathname) return
        if (!preferredRanks.has(pathname)) preferredRanks.set(pathname, index)
      }
    } catch {
      // Invalid preferred paths cannot match a supplied link.
    }
  })

  options.links.forEach((link, index) => {
    let url: URL
    try {
      url = new URL(link.href, start)
    } catch {
      excluded.utility += 1
      return
    }
    if (!['http:', 'https:'].includes(url.protocol) || hostKey(url.hostname) !== hostKey(start.hostname)) {
      excluded.external += 1
      return
    }
    const pathname = decodedPath(url.pathname)
    if (!pathname) {
      excluded.utility += 1
      return
    }
    if (ASSET_PATH.test(pathname)) {
      excluded.asset += 1
      return
    }
    if (UTILITY_PATH.test(pathname) || PAGINATION_PATH.test(pathname)) {
      excluded.utility += 1
      return
    }
    if (seen.has(pathname)) {
      excluded.duplicate += 1
      return
    }
    seen.add(pathname)
    const preferredRank = preferredRanks.get(pathname)
    const preferred = preferredRank !== undefined
    const context = link.context ?? 'unknown'
    candidates.push({
      url: absoluteRouteUrl(start, pathname),
      pathname,
      kind: looksLikeDetail(pathname, context) ? 'detail' : 'section',
      label: link.text?.replace(/\s+/g, ' ').trim() || undefined,
      context,
      index,
      preferred,
      preferredRank: preferredRank ?? Number.MAX_SAFE_INTEGER,
    })
  })

  const sections = candidates.filter((route) => route.kind === 'section').sort((left, right) => {
    const preferred = left.preferredRank - right.preferredRank
    if (preferred) return preferred
    const rank = contextRank(left.context ?? 'unknown') - contextRank(right.context ?? 'unknown')
    if (rank) return rank
    const depth = pathSegments(left.pathname).length - pathSegments(right.pathname).length
    return depth || left.index - right.index
  })
  const details = candidates.filter((route) => route.kind === 'detail').sort((left, right) => {
    const rank = contextRank(left.context ?? 'unknown') - contextRank(right.context ?? 'unknown')
    return rank || left.index - right.index
  })

  const selected: RepresentativeSiteRoute[] = [{
    url: absoluteRouteUrl(start, startPath),
    kind: 'home',
    label: 'Home',
  }]
  const selectedUrls = new Set(selected.map((route) => route.url))
  const families = new Set<string>()

  for (const route of sections.filter((candidate) => candidate.preferred)) {
    if (selected.length >= maxPages) break
    selected.push(route)
    selectedUrls.add(route.url)
    families.add(sectionFamily(route.pathname))
  }
  for (const route of sections) {
    if (selected.length >= maxPages) break
    if (selectedUrls.has(route.url)) continue
    const family = sectionFamily(route.pathname)
    if (families.has(family)) continue
    selected.push(route)
    selectedUrls.add(route.url)
    families.add(family)
  }
  for (const route of sections) {
    if (selected.length >= maxPages) break
    if (selectedUrls.has(route.url)) continue
    selected.push(route)
    selectedUrls.add(route.url)
  }

  let detailCount = 0
  for (const route of details) {
    if (detailCount >= maxDetailPages) {
      excluded.detailLimit += 1
      continue
    }
    if (selected.length >= maxPages) {
      excluded.pageLimit += 1
      continue
    }
    selected.push(route)
    selectedUrls.add(route.url)
    detailCount += 1
  }

  excluded.pageLimit += sections.filter((route) => !selectedUrls.has(route.url)).length

  return {
    routes: selected.map(({ url, kind, label, context }) => ({ url, kind, label, context })),
    considered: options.links.length,
    excluded,
  }
}
