#!/usr/bin/env node

/**
 * build-zip.js — Package the extension for store submission
 *
 * Usage:
 *   node build-zip.js          → builds FishtankLiveExtended-{version}.zip
 *   node build-zip.js --dry    → lists what would be included without creating the zip
 *
 * Reads the version from manifest.json automatically.
 * Output goes to the builds/ directory.
 *
 * Works on Windows (PowerShell), macOS, and Linux.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const ROOT = __dirname;
const MANIFEST = path.join(ROOT, 'manifest.json');
const isWindows = os.platform() === 'win32';

// ── Read version from manifest ──────────────────────────────────────

if (!fs.existsSync(MANIFEST)) {
    console.error('ERROR: manifest.json not found in', ROOT);
    process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
const version = manifest.version;

if (!version) {
    console.error('ERROR: No version found in manifest.json');
    process.exit(1);
}

// ── Collect files to include ────────────────────────────────────────
// Only what the extension actually needs at runtime.

const files = [];

// Individual root files
const rootFiles = ['manifest.json', 'icon.png', 'settings.js', 'LICENSE'];
for (const f of rootFiles) {
    if (fs.existsSync(path.join(ROOT, f))) {
        files.push(f);
    } else {
        console.warn(`WARN: ${f} not found, skipping`);
    }
}

// classic/ directory (all files, no subdirectories)
const classicDir = path.join(ROOT, 'classic');
if (fs.existsSync(classicDir)) {
    for (const f of fs.readdirSync(classicDir).filter(f => !f.startsWith('.'))) {
        files.push(`classic/${f}`);
    }
}

// current/bundle.js only
if (fs.existsSync(path.join(ROOT, 'current', 'bundle.js'))) {
    files.push('current/bundle.js');
} else {
    console.error('ERROR: current/bundle.js not found — run `npm run build` in current/ first');
    process.exit(1);
}

// ── Display file list ───────────────────────────────────────────────

console.log(`\nFishtank Live Extended v${version}`);
console.log('-'.repeat(40));
console.log(`Files to include (${files.length}):\n`);
files.forEach(f => console.log(`  ${f}`));

// ── Dry run check ───────────────────────────────────────────────────

if (process.argv.includes('--dry')) {
    console.log('\n(dry run — no zip created)\n');
    process.exit(0);
}

// ── Create builds/ directory ────────────────────────────────────────

const buildsDir = path.join(ROOT, 'builds');
if (!fs.existsSync(buildsDir)) {
    fs.mkdirSync(buildsDir);
    console.log('\nCreated builds/ directory');
}

// ── Stage files to a clean temp directory ───────────────────────────
// Copy only the needed files to a temp folder, then zip that.
// This avoids path issues and works reliably cross-platform.

const tempDir = path.join(os.tmpdir(), `ftl-ext-build-${Date.now()}`);
fs.mkdirSync(tempDir, { recursive: true });

for (const f of files) {
    const src = path.join(ROOT, f);
    const dest = path.join(tempDir, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

// ── Create the zip ──────────────────────────────────────────────────

const zipName = `FishtankLiveExtended-${version}.zip`;
const zipPath = path.join(buildsDir, zipName);

// Remove existing zip if present
if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
}

try {
    if (isWindows) {
        // Build the zip entry by entry using .NET ZipFileExtensions
        // to ensure forward-slash paths (Firefox rejects backslashes).
        const psScriptPath = path.join(os.tmpdir(), `ftl-zip-${Date.now()}.ps1`);
        const lines = [
            `Add-Type -AssemblyName System.IO.Compression`,
            `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
            `$zip = [System.IO.Compression.ZipFile]::Open('${zipPath}', 'Create')`,
        ];
        for (const f of files) {
            const absPath = path.join(tempDir, f).replace(/\//g, '\\');
            const entryName = f.replace(/\\/g, '/');
            lines.push(`[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, '${absPath}', '${entryName}') | Out-Null`);
        }
        lines.push(`$zip.Dispose()`);
        fs.writeFileSync(psScriptPath, lines.join('\n'));
        try {
            execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, { stdio: 'pipe' });
        } finally {
            fs.unlinkSync(psScriptPath);
        }
    } else {
        // Use zip command on macOS/Linux
        execSync(`cd "${tempDir}" && zip -r "${zipPath}" .`, { stdio: 'pipe' });
    }

    const stats = fs.statSync(zipPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`\n✓ Created: builds/${zipName} (${sizeKB} KB)`);
    console.log(`  Ready for Chrome Web Store / Firefox Add-ons submission\n`);

} catch (err) {
    console.error('\nERROR: Could not create zip.');
    console.error(err.message);
    process.exit(1);
} finally {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
}