# Contributing

Thanks for helping make `@polyform-ai/a11y-guide` more useful and accessible.

## Before opening a change

- Search existing issues and pull requests first.
- Keep the package dependency-free at runtime unless a dependency has a clear accessibility or maintenance benefit.
- Prefer native HTML semantics over adding ARIA or keyboard behavior to generic elements.
- Include tests for behavior changes.
- Prompt and example pull requests should include the ambiguity they address and the human or browser-agent evidence used to evaluate them.

## Local development

The project requires Node.js 20 or newer.

```sh
npm install
npm run check
```

`npm run check` runs TypeScript validation, unit tests, the production build, and a dry-run package inspection.

## Pull requests

Explain the user-facing accessibility outcome, the browsers or assistive technologies you exercised when relevant, and any limits that remain. Automated checks are useful evidence, but they do not replace keyboard and assistive-technology testing.

The manifest is a public interoperability surface. Propose contract changes in an issue before changing field meaning or removing a field.

By contributing, you agree that your contributions will be licensed under the MIT License.
