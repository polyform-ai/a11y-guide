import { accessibleName, exposedState, implicitRole, isDisabled, visibleText } from './dom.js'
import type { GuideManifest, ResolvedGuideStep } from './types.js'

export function buildGuideManifest(doc: Document, items: ResolvedGuideStep[]): GuideManifest {
  return {
    schema: 'https://github.com/polyform-ai/a11y-guide/blob/main/docs/manifest-v1.md',
    version: 1,
    page: {
      title: doc.title,
      language: doc.documentElement.lang || undefined,
      url: doc.location?.href || undefined,
    },
    items: items.map(({ element, ...item }) => ({
      ...item,
      element: {
        tagName: element.tagName.toLowerCase(),
        role: implicitRole(element),
        accessibleName: accessibleName(element),
        visibleText: item.kind === 'action' ? visibleText(element) || undefined : undefined,
        disabled: isDisabled(element),
        state: exposedState(element),
      },
    })),
  }
}
