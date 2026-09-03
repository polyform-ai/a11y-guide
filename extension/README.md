# Polyform Agent View DevTools extension

The extension adds an **Agent View** panel to Chromium DevTools. It scans the currently rendered page with the package's scoring engine, shows a large readiness score and explainable findings, outlines discoverable sections and actions, opens problem elements in the Elements panel, and exports a standalone HTML report.

## Try it locally

1. Run `npm install` and `npm run build:extension` in this repository.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select `extension/dist`.
4. Open DevTools on any page and select **Agent View**.

The extension reads the rendered DOM through the DevTools inspected-window API. It does not collect or transmit page content.

## What the panel represents

Agent View uses the same DOM and accessible-name approximation as `evaluateAgentReadiness()`. The overlay shows likely agent targets, not Chrome's exact accessibility tree. Use Chrome's built-in Accessibility pane to inspect the computed role, name, properties, and tree position of a selected element. Screenshot-driven agents also need a separate visual task test.

An opt-in Chrome DevTools Protocol accessibility-tree viewer is a possible future addition, but it would require broader debugging permissions and should not be silently enabled.
