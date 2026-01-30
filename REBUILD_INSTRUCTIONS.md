# Rebuild Instructions

**Source of truth: `src/`**. Running `pnpm run build` produces the full extension in `dist/`. Edit only files in `src/`; do not hand-edit anything in `dist/`—it is fully overwritten by the build.

## Rebuild from source

```bash
pnpm install
pnpm run build
```

This will:

1. Ensure `dist/` exists
2. Copy all static assets from `src/` to `dist/`: `index.css`, `popup.html`, `popup.js`, `options.html`, `options.js`, `options.css`, `newtab.html`, `newtab.js`, `sidebar.css`, `content.js`
3. Write `dist/sidepanel.html` (generated; paths for extension)
4. Build `src/background.ts` → `dist/background.js` (includes `src/storage.ts`)
5. Build `src/sidepanel.ts` → `dist/sidepanel.js` (includes `src/storage.ts`, `src/icons.ts`)

After a successful build, reload the extension in `chrome://extensions`.

## Watch mode

```bash
pnpm run build:watch
```

Rebuilds `background.js` and `sidepanel.js` when `src/*.ts` changes. Run `pnpm run build` again if you change any static asset in `src/` (HTML, CSS, JS) or need to refresh `sidepanel.html`.

## Store package

To create a ZIP for Chrome Web Store submission (manifest + dist + icons only), run:

```bash
node create-store-package.js
```

Then upload the generated ZIP from the project root. See `STORE_SUBMISSION.md` for full submission steps.

## After rebuilding

1. Open `chrome://extensions/`
2. Click **Reload** on Sidebarzz
3. Test the injected sidebar and (if used) the native side panel
