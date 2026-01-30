<p align="center">
  <img src="icons/logo.png" alt="Sidebarzz Logo" width="250" />
</p>

<h1 align="center">Sidebarzz</h1>

<p align="center">
  Workspace-based browsing via a <strong>custom injected sidebar</strong>.
</p>

<p align="center">
  <em>Sidebarzz does not use Chrome’s built-in side panel.</em>
</p>

---

## Overview

**Sidebarzz** is a Chrome extension for managing **workspaces, bookmarks, and tabs** using a sidebar injected directly into web pages. Each workspace is isolated, making it easy to separate work, personal, and project contexts.

The injected sidebar is the primary UI. Chrome’s native side panel is intentionally not used.

---

## Project Structure

```
├── dist/                # Runtime output
│   ├── background.js    # Built from src/
│   ├── sidepanel.js     # Built from src/
│   ├── index.css        # Built from src/
│   ├── sidepanel.html   # Generated during build
│   ├── content.js       # Injected sidebar logic
│   └── sidebar.css      # Injected sidebar styles
│
├── src/                 # TypeScript / CSS sources
│   ├── background.ts
│   ├── sidepanel.ts
│   ├── storage.ts
│   └── icons.ts
│
├── build.js
├── manifest.json
└── package.json
```

---

## Setup

```bash
pnpm install
pnpm run build
```

Load unpacked via `chrome://extensions` (Developer Mode enabled).

---

## Features

- Workspace-specific bookmarks and tabs
- Automatic tab restoration per workspace
- Adjustable sidebar width, margins, and mode
- Fixed or floating (hover) sidebar
- Collapsible panel
- Drag-and-drop bookmark ordering
- Per-workspace behavior and appearance settings

---

## Development

- **TypeScript** (strict)
- **esbuild** bundling
- **Manifest V3**
- **Storage:** `chrome.storage.local`
- **Primary UI:** injected content script

---

## Privacy

Sidebarzz does **not** collect or transmit data.

All data stays on your device:

- Workspace names and IDs
- Bookmarks (URLs, titles)
- Tabs for restoration
- Sidebar settings

---

## Known Issues

- Switching workspaces across multiple Chrome windows may clear tabs for that workspace.

---

## Future Roadmap

- Workspace-scoped history, passwords, and autofill
- Multiple sidebars per workspace
- Bottom-docked sidebar support
- Improved multi-window handling

