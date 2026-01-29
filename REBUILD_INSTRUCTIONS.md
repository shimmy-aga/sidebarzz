# Rebuild Instructions

**Source of truth: `src/`**. Running `pnpm run build` produces the working extension in `dist/`. This is the normal setup: you edit `src/`, build, and `dist/` is generated. Do not hand-edit `dist/background.js`, `dist/sidepanel.js`, or `dist/index.css`—they are overwritten by the build.

## Rebuild from source

```bash
pnpm install
pnpm run build
```

This will:

1. Ensure `dist/` exists
2. Copy `src/index.css` → `dist/index.css`
3. Write `dist/sidepanel.html` (correct paths for extension)
4. Build `src/background.ts` → `dist/background.js` (includes `src/storage.ts`)
5. Build `src/sidepanel.ts` → `dist/sidepanel.js` (includes `src/storage.ts`, `src/icons.ts`)

After a successful build, reload the extension in `chrome://extensions`. The built files above are always generated from `src/`; the rest of `dist/` is left as-is.

Files in **dist** that are **not** overwritten by the build (edit directly in dist if needed):

- `content.js`, `sidebar.css` (injected sidebar – primary UI)
- `newtab.html`, `newtab.js`
- `popup.html`, `popup.js`
- `options.html`, `options.js`, `options.css`

## Watch mode

```bash
pnpm run build:watch
```

Rebuilds `background.js` and `sidepanel.js` when `src/*.ts` changes. Run `pnpm run build` again if you change `src/index.css` or need to refresh `sidepanel.html`.

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
