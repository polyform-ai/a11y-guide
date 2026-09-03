import { describe, expect, it } from 'vitest'
import { selectRepresentativeSiteRoutes } from '../src/index.js'

describe('selectRepresentativeSiteRoutes', () => {
  it('keeps a large publication audit bounded to high-level sections', () => {
    const articleLinks = Array.from({ length: 500 }, (_, index) => ({
      href: `/brand-marketing/article-number-${index}-with-a-long-headline`,
      text: `Article ${index}`,
      context: 'article' as const,
    }))
    const plan = selectRepresentativeSiteRoutes({
      startUrl: 'https://www.adweek.com/',
      maxPages: 8,
      maxDetailPages: 1,
      links: [
        { href: '/brand-marketing/', text: 'Brand Marketing', context: 'navigation' },
        { href: '/media/', text: 'Media', context: 'navigation' },
        { href: '/commerce/', text: 'Commerce', context: 'navigation' },
        { href: '/category/technology/', text: 'Technology', context: 'navigation' },
        { href: '/page/2/', text: 'Next page', context: 'main' },
        { href: '/search?q=agents', text: 'Search', context: 'main' },
        { href: 'https://example.com/story', text: 'External story', context: 'article' },
        ...articleLinks,
      ],
    })

    expect(plan.routes).toHaveLength(6)
    expect(plan.routes.filter((route) => route.kind === 'detail')).toHaveLength(1)
    expect(plan.routes.slice(0, 5).map((route) => new URL(route.url).pathname)).toEqual([
      '/', '/brand-marketing', '/media', '/commerce', '/category/technology',
    ])
    expect(plan.excluded.detailLimit).toBe(499)
    expect(plan.excluded.utility).toBe(2)
    expect(plan.excluded.external).toBe(1)
  })

  it('normalizes same-site variants, assets, fragments, and duplicate URLs', () => {
    const plan = selectRepresentativeSiteRoutes({
      startUrl: 'https://www.flybridge.com/',
      maxPages: 5,
      maxDetailPages: 0,
      links: [
        { href: 'https://flybridge.com/team?ref=nav#people', text: 'Team', context: 'navigation' },
        { href: '/team/', text: 'Meet the team', context: 'footer' },
        { href: '/portfolio#ai', text: 'Portfolio', context: 'navigation' },
        { href: '/logo.svg', text: 'Logo', context: 'unknown' },
      ],
    })

    expect(plan.routes.map((route) => route.url)).toEqual([
      'https://www.flybridge.com/',
      'https://www.flybridge.com/team',
      'https://www.flybridge.com/portfolio',
    ])
    expect(plan.excluded.duplicate).toBe(1)
    expect(plan.excluded.asset).toBe(1)
  })

  it('decodes paths before excluding utility and asset routes', () => {
    const plan = selectRepresentativeSiteRoutes({
      startUrl: 'https://example.com/',
      links: [
        { href: '/%6Cogout', context: 'navigation' },
        { href: '/%256Cogout', context: 'navigation' },
        { href: '/%2525256Cogout', context: 'navigation' },
        { href: '/brochure%2Epdf', context: 'main' },
        { href: '/reports%2Fquarterly', context: 'navigation' },
        { href: '/bad%E0%A4%A', context: 'main' },
      ],
    })

    expect(plan.routes.map((route) => new URL(route.url).pathname)).toEqual(['/', '/reports/quarterly'])
    expect(plan.excluded.utility).toBe(4)
    expect(plan.excluded.asset).toBe(1)
  })

  it('excludes extensionless download and export endpoints', () => {
    const plan = selectRepresentativeSiteRoutes({
      startUrl: 'https://example.com/',
      links: [
        { href: '/download/report?id=123', context: 'navigation' },
        { href: '/export', context: 'main' },
        { href: '/reports', context: 'navigation' },
      ],
    })

    expect(plan.routes.map((route) => new URL(route.url).pathname)).toEqual(['/', '/reports'])
    expect(plan.excluded.utility).toBe(2)
  })

  it('keeps explicitly preferred section paths ahead of shallower footer routes', () => {
    const plan = selectRepresentativeSiteRoutes({
      startUrl: 'https://www.adweek.com/',
      maxPages: 4,
      maxDetailPages: 0,
      preferredPaths: ['/vertical/agencies/', '/vertical/media/'],
      links: [
        { href: '/vertical/media/', text: 'Media', context: 'main' },
        { href: '/about/', text: 'About', context: 'navigation' },
        { href: '/vertical/agencies/', text: 'Agencies', context: 'main' },
        { href: '/contact/', text: 'Contact', context: 'navigation' },
      ],
    })

    expect(plan.routes.map((route) => new URL(route.url).pathname)).toEqual([
      '/', '/vertical/agencies', '/vertical/media', '/about',
    ])
  })

  it('does not visit a preferred path that was not linked from the start page', () => {
    const plan = selectRepresentativeSiteRoutes({
      startUrl: 'https://example.com/',
      preferredPaths: ['/unlinked-section/'],
      links: [{ href: '/linked-section/', context: 'navigation' }],
    })

    expect(plan.routes.map((route) => new URL(route.url).pathname)).toEqual(['/', '/linked-section'])
  })

  it('counts root-level article slugs against the detail cap', () => {
    const plan = selectRepresentativeSiteRoutes({
      startUrl: 'https://example.com/',
      maxDetailPages: 0,
      links: [{ href: '/breaking-news-headline-with-many-words', context: 'main' }],
    })

    expect(plan.routes).toHaveLength(1)
    expect(plan.excluded.detailLimit).toBe(1)
  })

  it('treats short root-level headline slugs as details outside navigation', () => {
    const plan = selectRepresentativeSiteRoutes({
      startUrl: 'https://example.com/',
      maxDetailPages: 0,
      links: [
        { href: '/fed-cuts-interest-rates', context: 'main' },
        { href: '/brand-marketing', context: 'navigation' },
      ],
    })

    expect(plan.routes.map((route) => new URL(route.url).pathname)).toEqual(['/', '/brand-marketing'])
    expect(plan.excluded.detailLimit).toBe(1)
  })

  it('preserves deep navigation routes as sections', () => {
    const plan = selectRepresentativeSiteRoutes({
      startUrl: 'https://example.com/',
      maxDetailPages: 0,
      links: [{ href: '/topics/industry/artificial-intelligence', context: 'navigation' }],
    })

    expect(plan.routes[1]).toMatchObject({ kind: 'section', url: 'https://example.com/topics/industry/artificial-intelligence' })
  })

  it('falls back to safe defaults for non-finite page and detail limits', () => {
    const sections = Array.from({ length: 20 }, (_, index) => ({ href: `/section-${index}`, context: 'navigation' as const }))
    const details = Array.from({ length: 10 }, (_, index) => ({ href: `/story-${index}`, context: 'article' as const }))

    const pagePlan = selectRepresentativeSiteRoutes({
      startUrl: 'https://example.com/',
      maxPages: Number.POSITIVE_INFINITY,
      maxDetailPages: 0,
      links: sections,
    })
    const detailPlan = selectRepresentativeSiteRoutes({
      startUrl: 'https://example.com/',
      maxPages: 20,
      maxDetailPages: Number.NaN,
      links: details,
    })

    expect(pagePlan.routes).toHaveLength(12)
    expect(detailPlan.routes.filter((route) => route.kind === 'detail')).toHaveLength(2)
  })
})
