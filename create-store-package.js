#!/usr/bin/env node

/**
 * Script to create a Chrome Web Store submission package
 * This creates a ZIP file with only the necessary files for store submission
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');
const iconsDir = path.join(rootDir, 'icons');
const outputZip = path.join(rootDir, 'sidebarzz-store.zip');

console.log('📦 Creating Chrome Web Store submission package (Sidebarzz)...\n');

// Check if dist folder exists
if (!fs.existsSync(distDir)) {
  console.error('❌ Error: dist/ folder not found. Run "pnpm run build" first.');
  process.exit(1);
}

// Check if manifest.json exists
const manifestPath = path.join(rootDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('❌ Error: manifest.json not found.');
  process.exit(1);
}

// Create temp directory for packaging
const tempDir = path.join(rootDir, '.store-package');
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

console.log('📋 Copying files...');

// Copy manifest.json
fs.copyFileSync(manifestPath, path.join(tempDir, 'manifest.json'));
console.log('  ✓ manifest.json');

// Copy dist folder
const tempDistDir = path.join(tempDir, 'dist');
fs.mkdirSync(tempDistDir, { recursive: true });
copyDir(distDir, tempDistDir);
console.log('  ✓ dist/');

// Copy icons folder if it exists
if (fs.existsSync(iconsDir)) {
  const tempIconsDir = path.join(tempDir, 'icons');
  fs.mkdirSync(tempIconsDir, { recursive: true });
  copyDir(iconsDir, tempIconsDir);
  console.log('  ✓ icons/');
} else {
  console.log('  ⚠ icons/ folder not found - you may need to add icons before submission');
}

// Create ZIP file
console.log('\n🗜️  Creating ZIP file...');
try {
  // Remove old ZIP if exists
  if (fs.existsSync(outputZip)) {
    fs.unlinkSync(outputZip);
  }

  // Create ZIP (using PowerShell on Windows, zip on Mac/Linux)
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    // PowerShell Compress-Archive
    execSync(
      `powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${outputZip}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    // Unix zip command
    execSync(
      `cd "${tempDir}" && zip -r "${outputZip}" .`,
      { stdio: 'inherit' }
    );
  }

  console.log(`\n✅ Package created: ${outputZip}`);
  console.log(`\n📤 Ready to upload to Chrome Web Store!`);
  console.log(`\nNext steps:`);
  console.log(`  1. Go to https://chrome.google.com/webstore/devconsole`);
  console.log(`  2. Click "New Item"`);
  console.log(`  3. Upload: ${path.basename(outputZip)}`);
  console.log(`  4. Complete store listing information`);
  console.log(`  5. Submit for review\n`);

} catch (error) {
  console.error('❌ Error creating ZIP file:', error.message);
  console.error('\n💡 Tip: You can manually create a ZIP file containing:');
  console.error('  - manifest.json');
  console.error('  - dist/');
  console.error('  - icons/ (if exists)');
  process.exit(1);
} finally {
  // Cleanup temp directory
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function copyDir(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
