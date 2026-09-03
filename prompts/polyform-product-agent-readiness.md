# Task: Make the Polyform product agent-ready

Integrate the published `@polyform-ai/a11y-guide` package into the Polyform product, audit representative authenticated product workflows, generate a page-by-page HTML report, and fix the highest-value semantic and workflow issues.

## Known architecture

The web app uses Node 24, pnpm 10, React 19, React Router 8 with SSR and client hydration, Vite 7, TypeScript 5.9, Tailwind 4, Radix/shadcn components, Storybook accessibility testing, Vitest, and Playwright.

The authenticated application shell is owned through:

- `client/apps/web/app/layouts/app.tsx`
- `client/apps/web/app/components/AppLayout.tsx`
- `client/apps/web/app/root.tsx`

Version `0.2.2` of the package has been compatibility-tested against this stack.

## Safety and repository handling

1. Read every applicable `AGENTS.md`.
2. Inspect the current Git state before editing.
3. Preserve unrelated work completely. Use a clean branch or worktree and never delete, overwrite, stage, or commit unrelated files.
4. Do not merge or deploy the resulting PR without explicit approval.
5. Do not perform consequential operations against production customer data while testing.

## Install the package

From `client/`, run:

```bash
pnpm --filter @client/web add @polyform-ai/a11y-guide@^0.2.2
```

Keep the dependency scoped to `@client/web`.

## Integrate it safely

Create a small typed React integration component and mount it once inside the authenticated application shell.

- Call `createGuide()` only inside `useEffect`; never during server rendering.
- Clean up with `controller.destroy()` so React Strict Mode does not leave duplicate guides or observers.
- Use `useLocation()` and call `controller.refresh()` after pathname or search changes.
- Let the built-in observer handle ordinary client-rendered DOM changes.
- Start with `exposeManifest: false`. This is an authenticated product, so do not publish a DOM manifest containing product or customer context.
- Make the visible guide development-only or protect it with an existing internal feature flag.
- If Playwright needs a scoring hook, expose it only in development or test builds and remove it during cleanup.
- Do not add accessibility attributes or `tabindex` to every `div`. Prefer native buttons, links, headings, labels, landmarks, tables, and dialog semantics.

Use a title such as “Guide to Polyform.” Explain that the guide identifies page regions, available actions, requirements, and expected outcomes.

## Add guidance where it matters

Prioritize consequential and ambiguous product actions rather than decorating every control:

- creating, editing, running, publishing, and deleting datasets or activities;
- creating and editing reports;
- starting and inspecting agent tasks;
- asking Poly and continuing conversations;
- running workflows and inspecting runs;
- connection, warehouse, secret, team, and permission settings; and
- dialogs, menus, comboboxes, data grids, drag-and-drop controls, virtualized lists, and their loading, empty, error, disabled, selected, expanded, success, and permission-denied states.

Use native semantics first. Add package guidance only when it supplies information the accessible name cannot:

```html
data-a11y-guide-action="submit"
data-a11y-guide-outcome="What changes if this succeeds"
data-a11y-guide-does-not="What this action will not change"
data-a11y-guide-confirmation="explicit"
data-a11y-guide-completion="The visible or announced success state"
data-a11y-guide-requires="Required condition one | Required condition two"
```

Never place customer names, emails, IDs, SQL, secrets, credentials, permissions, or other sensitive data in guidance attributes.

## Build an authenticated readiness report

Use the existing Playwright authentication and fixture infrastructure. Collect `controller.getAgentReadiness()` results from representative, fully rendered states and pass them to `renderAgentReadyReport()`.

Generate an ignored artifact at `.work/agent-readiness/index.html` with a large overall score, scores by page, dimension scores, findings, selectors, and recommendations.

Cover at least:

- product home;
- reports index, report view, and report authoring;
- datasets index, dataset view, SQL view, and editing;
- activities and publishing;
- metrics;
- Agent Tasks index, new task, and task detail;
- Poly index and an active conversation;
- Knowledge;
- workflows and workflow runs;
- consequential settings; and
- representative loading, empty, error, permission, modal, and success states.

Use fixture IDs created by the existing test setup. Do not hardcode production object IDs. Establish the initial baseline before fixing findings; do not game the report or require an arbitrary 100/100 score. After review, add regression protection for score decreases and new serious findings.

## Verify what agents actually receive

The package score is only one signal. Also verify:

- Playwright ARIA snapshots for important states;
- browser accessibility-tree names, roles, descriptions, and state;
- keyboard-only completion of primary workflows;
- focus placement and restoration for dialogs and route changes;
- visible completion and error feedback after actions;
- mobile and zoomed layouts;
- visual salience where controls have similar names;
- virtualized content without pretending off-screen rows are visible; and
- at least one end-to-end browser-agent task that stops before any production consequence.

Document that the score is not WCAG certification and does not guarantee that every agent can complete every workflow.

## Validate and deliver

Run the relevant repository checks, including:

```bash
cd client
pnpm check
pnpm test
pnpm test:browser
pnpm --filter @client/web typecheck
pnpm --filter @client/web test:e2e
```

Add focused functional tests for every changed consequential workflow and Storybook accessibility coverage where shared components change.

Open a reviewable PR containing the scoped package installation, SSR-safe authenticated-shell integration, an automated page/state collector, a standalone HTML report, high-confidence semantic and guidance fixes, and tests for route refresh, cleanup, sensitive-data exclusion, keyboard behavior, and consequential-action boundaries. Include the baseline, resulting scores, remaining limitations, and exact validation results. Do not merge or deploy the PR.
