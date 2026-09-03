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
const UTILITY_PATH = /(?:^|\/)(?:account|feed|login|logout|search|signin|signup|wp-admin|wp-json)(?:\/|$)/i
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

function pathSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean)
}

function looksLikeDetail(pathname: string, context: SiteLinkContext): boolean {
  const segments = pathSegments(pathname)
  if (DATE_PATH.test(pathname) || context === 'article' || segments.length >= 3) return true
  if (segments.length >= 2 && DETAIL_ROOT.has(segments[0]!.toLowerCase())) return true
  const finalSegment = segments.at(-1) ?? ''
  return segments.length >= 2 && (finalSegment.length > 48 || finalSegment.split('-').length >= 5)
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

/**
 * Selects a bounded, representative same-site audit plan from rendered links.
 * It never recursively crawls selected pages, strips query/hash variants, and
 * caps article-like routes separately so a large publication cannot explode
 * into an unbounded crawl.
 */
export function selectRepresentativeSiteRoutes(options: RepresentativeSitePlanOptions): RepresentativeSitePlan {
  const start = new URL(options.startUrl)
  const startPath = normalizedPath(start.pathname)
  const maxPages = Math.max(1, Math.floor(options.maxPages ?? 12))
  const maxDetailPages = Math.max(0, Math.floor(options.maxDetailPages ?? 2))
  const excluded = { external: 0, asset: 0, utility: 0, duplicate: 0, detailLimit: 0, pageLimit: 0 }
  const candidates: Array<RepresentativeSiteRoute & { index: number; pathname: string; preferred: boolean }> = []
  const seen = new Set<string>([startPath])

  const preferredCount = options.preferredPaths?.length ?? 0

  const supplied: SiteLinkCandidate[] = [
    ...(options.preferredPaths ?? []).map((href) => ({ href, context: 'navigation' as const })),
    ...options.links,
  ]

  supplied.forEach((link, index) => {
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
    const pathname = normalizedPath(url.pathname)
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
    const context = link.context ?? 'unknown'
    candidates.push({
      url: `${start.protocol}//${start.host}${pathname}`,
      pathname,
      kind: looksLikeDetail(pathname, context) ? 'detail' : 'section',
      label: link.text?.replace(/\s+/g, ' ').trim() || undefined,
      context,
      index,
      preferred: index < preferredCount,
    })
  })

  const sections = candidates.filter((route) => route.kind === 'section').sort((left, right) => {
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
    url: `${start.protocol}//${start.host}${startPath}`,
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
