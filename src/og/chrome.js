// Screenshots an HTML file with headless Chrome. Used for link-preview images,
// so the cards are drawn with the same CSS and fonts as the site.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ],
  linux: ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

function onPath(name) {
  if (path.isAbsolute(name)) return fs.existsSync(name) ? name : null;
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

let cached;
export function findChrome() {
  if (cached !== undefined) return cached;
  const fromEnv = process.env.CHROME_PATH || process.env.CHROME_BIN;
  if (fromEnv && fs.existsSync(fromEnv)) return (cached = fromEnv);
  for (const c of CANDIDATES[process.platform] || []) {
    const found = onPath(c);
    if (found) return (cached = found);
  }
  return (cached = null);
}

// Resolves once the PNG is written. Chrome on macOS keeps running after a
// --screenshot, so we stop it ourselves when the file stops growing.
export function screenshot(chrome, htmlFile, pngFile, { width, height, timeout = 30000 }) {
  return new Promise((resolve, reject) => {
    fs.rmSync(pngFile, { force: true });
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'broadsheet-chrome-'));
    const args = [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${width},${height}`,
      '--virtual-time-budget=2000', `--user-data-dir=${profile}`, `--screenshot=${pngFile}`,
    ];
    // Ubuntu runners block Chrome's sandbox; we only ever load our own generated file.
    if (process.platform === 'linux') args.push('--no-sandbox');
    args.push('file://' + htmlFile);

    const child = spawn(chrome, args, { stdio: 'ignore', detached: process.platform !== 'win32' });
    let done = false, lastSize = -1;
    const stop = () => {
      try { process.platform === 'win32' ? child.kill('SIGKILL') : process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
    };
    const finish = err => {
      if (done) return;
      done = true;
      clearInterval(poll);
      clearTimeout(timer);
      stop();
      setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500);
      err ? reject(err) : resolve(pngFile);
    };
    const poll = setInterval(() => {
      const size = fs.existsSync(pngFile) ? fs.statSync(pngFile).size : 0;
      if (size > 0 && size === lastSize) finish();
      lastSize = size;
    }, 150);
    const timer = setTimeout(() => finish(new Error('Chrome timed out')), timeout);
    child.on('error', finish);
    child.on('exit', () => setTimeout(() => {
      if (!done) fs.existsSync(pngFile) ? finish() : finish(new Error('Chrome exited without writing a screenshot'));
    }, 200));
  });
}
