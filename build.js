const fs = require('fs');
const path = require('path');

// Builds the distributable single-file index.html from src/, same model as
// contents/gym-tracker: never edit the top-level index.html directly — edit
// src/ and rerun `node build.js`. Unlike the gym app there is no login-gated
// base64 payload: the PIN lock screen is part of the app markup itself, so
// the sources are simply inlined (the pattern of the gym admin build).

const srcDir = path.join(__dirname, 'src');

const indexHtml = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(srcDir, 'style.css'), 'utf8');
const firebaseSyncJs = fs.readFileSync(path.join(srcDir, 'firebase-sync.js'), 'utf8');
const appJs = fs.readFileSync(path.join(srcDir, 'app.js'), 'utf8');

if (!/API_KEY='[^']+'/.test(firebaseSyncJs) || !/RTDB_URL='https:[^']+'/.test(firebaseSyncJs)) {
  console.warn('\x1b[33m%s\x1b[0m', 'WARNING: API_KEY / RTDB_URL are empty in src/firebase-sync.js — cloud sync will not work in the built app.');
}

const headMatch = indexHtml.match(/<head>([\s\S]*?)<\/head>/);
if (!headMatch) throw new Error('Could not find <head> tag in src/index.html');
// Drop the dev-time stylesheet link — style.css is inlined below.
const headContent = headMatch[1].replace(/<link[^>]*href=["']style\.css[^"']*["'][^>]*>\n?/i, '').trim();

const bodyMatch = indexHtml.match(/<body>([\s\S]*?)<\/body>/);
if (!bodyMatch) throw new Error('Could not find <body> tag in src/index.html');
// Strip the dev-time <script src> tags — the code is inlined below.
const bodyContent = bodyMatch[1].replace(/<script[^>]*src=[\s\S]*?<\/script>\n?/gi, '').trim();

const distHtml = `<!doctype html>
<html lang="en">
<head>
${headContent}
<style>
${styleCss}</style>
</head>
<body>
${bodyContent}
<script>
${firebaseSyncJs}</script>
<script>
${appJs}</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'index.html'), distHtml, 'utf8');
console.log('Successfully compiled index.html (PIN-locked, Firebase cloud sync)!');
