const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');
const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');

// Background service worker - needs IIFE format for Chrome
const backgroundOptions = {
  entryPoints: [path.join(rootDir, 'src/background.ts')],
  bundle: true,
  outfile: path.join(distDir, 'background.js'),
  platform: 'browser',
  target: 'es2020',
  sourcemap: 'external',
  logLevel: 'info',
  format: 'iife'
};

// Sidepanel - can use ESM
const sidepanelOptions = {
  entryPoints: [path.join(rootDir, 'src/sidepanel.ts')],
  bundle: true,
  outfile: path.join(distDir, 'sidepanel.js'),
  platform: 'browser',
  target: 'es2020',
  sourcemap: 'external',
  logLevel: 'info',
  format: 'esm'
};

// Ensure dist exists and copy/write assets that have source outside dist
function syncDistAssets() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  // Copy side panel CSS (loaded by dist/sidepanel.html)
  const indexCssSrc = path.join(rootDir, 'src/index.css');
  if (fs.existsSync(indexCssSrc)) {
    fs.copyFileSync(indexCssSrc, path.join(distDir, 'index.css'));
  }
  // Emit sidepanel.html so paths stay correct (extension loads dist/sidepanel.html)
  const sidepanelHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sidebarzz</title>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <div id="sidepanel"></div>
  <script src="sidepanel.js"></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(distDir, 'sidepanel.html'), sidepanelHtml);
}

async function build() {
  try {
    syncDistAssets();
    await Promise.all([
      esbuild.build(backgroundOptions),
      esbuild.build(sidepanelOptions)
    ]);
    console.log('Build completed successfully');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

if (isWatch) {
  Promise.all([
    esbuild.context(backgroundOptions),
    esbuild.context(sidepanelOptions)
  ]).then(([bgCtx, spCtx]) => {
    bgCtx.watch();
    spCtx.watch();
    console.log('Watching for changes...');
  });
} else {
  build();
}
