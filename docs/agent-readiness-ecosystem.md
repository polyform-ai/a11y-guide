# Agent-readiness ecosystem

There are two related layers of agent readiness, and a useful audit should not collapse them into one score.

## 1. Can an agent discover and fetch the site?

[Cloudflare's Agent Readiness scanner](https://isitagentready.com/) checks host-level protocols such as robots.txt, sitemaps, Markdown content negotiation, bot controls, OAuth discovery, API catalogs, MCP server cards, Agent Skills, WebMCP, and commerce protocols. These checks help an agent find content or call a published capability without operating the visual interface.

`llms.txt` is an emerging convention for publishing a concise, model-readable map of important content. It can help content-heavy sites, but it does not make buttons, forms, state, or confirmations usable. Cloudflare does not include it in the default score, though its scanner can optionally check it.

There is no broadly adopted `agents.txt` web-interface standard that replaces semantic HTML or these protocols. `AGENTS.md` is commonly used to give coding agents repository instructions; it is not a contract for browser users. Avoid inventing a public instruction file that could become stale or conflict with the real interface.

## 2. Can an agent understand and operate the rendered page?

`@polyform-ai/a11y-guide` scores this layer: structure, named actions, exposed state, guidance, and consequence boundaries in the rendered DOM. It is informed by systems that combine browser data with visual perception:

- [Browser Use](https://github.com/browser-use/browser-use) builds a model-facing representation from DOM snapshots, accessibility data, interactive targets, attributes, and optionally screenshots.
- [UI-TARS](https://github.com/bytedance/UI-TARS) and [UI-TARS Desktop](https://github.com/bytedance/UI-TARS-desktop) are screenshot-grounded GUI systems that predict mouse and keyboard actions from visual state.
- [Agent TARS](https://github.com/bytedance/agent-tars) combines browser and multimodal tools, including screenshot-based GUI control.
- [Chrome DevTools Accessibility](https://developer.chrome.com/docs/devtools/accessibility/reference) exposes the computed role, accessible name, properties, and accessibility-tree position of an element.
- [Playwright locators](https://playwright.dev/docs/locators) recommend user-facing roles and accessible names, which makes them a practical regression interface for the same semantics agents often consume.

A strong site should pass both layers. Host protocols cannot repair an unnamed checkout button. Perfect semantic HTML does not publish an API catalog or grant an agent safe OAuth access.

## Recommended evaluation stack

1. Run Cloudflare's scanner for discovery, fetch formats, bot policy, and protocol exposure.
2. Run `evaluateAgentReadiness()` across representative rendered routes.
3. Run axe-core and keyboard tests for accessibility regressions.
4. Inspect important controls in the browser accessibility tree.
5. Review desktop and mobile screenshots for visual salience, overlap, and grounding.
6. Give a DOM-oriented browser agent and a screenshot-oriented agent the same realistic task.
7. Record completion, wrong turns, retries, and unsafe near-misses separately from static scores.

The final task run is the strongest evidence. Static scores tell you where to look and whether a change regressed the signals those agents rely on.
