'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, globalShortcut, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const chokidar = require('chokidar');
const { autoUpdater } = require('electron-updater');

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';
const APP_MODE = process.argv.includes('--dev') ? 'dev' : 'release';
const AUTH_SERVER_URL = (process.env.YUNIHUB_AUTH_URL || process.env.AUTH_SERVER_URL || 'https://yunihub-production.up.railway.app').replace(/\/$/, '');
const DEFAULT_DISCORD_APP_ID = '1511173773204652092';

const THEMES = {
  dark: { color: '#05070d', symbolColor: '#d9dcff' },
  rei: { color: '#e8f1fa', symbolColor: '#1b3550' },
  dehbify: { color: '#05060d', symbolColor: '#a6ffd0' },
  custom: { color: '#101114', symbolColor: '#ffffff' }
};
const validHexColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
function resolveTheme(theme, customBackground) {
  const base = THEMES[theme] || THEMES.dark;
  if (theme !== 'custom' || !validHexColor(customBackground)) return base;
  const channels = customBackground.slice(1).match(/.{2}/g).map((part) => parseInt(part, 16) / 255);
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  return { ...base, color: customBackground, symbolColor: luminance > .56 ? '#1b1719' : '#ffffff' };
}

function detectSystemProfile() {
  const timezoneCityMap = {
    'America/New_York': 'New York', 'America/Chicago': 'Chicago', 'America/Denver': 'Denver',
    'America/Los_Angeles': 'Los Angeles', 'America/Phoenix': 'Phoenix', 'America/Toronto': 'Toronto',
    'Europe/London': 'London', 'Europe/Paris': 'Paris', 'Europe/Berlin': 'Berlin', 'Europe/Madrid': 'Madrid',
    'Europe/Rome': 'Rome', 'Europe/Athens': 'Athens', 'Europe/Istanbul': 'Istanbul', 'Asia/Tokyo': 'Tokyo',
    'Asia/Singapore': 'Singapore', 'Asia/Dubai': 'Dubai', 'Asia/Kolkata': 'Mumbai', 'Asia/Seoul': 'Seoul',
    'Asia/Shanghai': 'Shanghai', 'Australia/Sydney': 'Sydney', 'Pacific/Auckland': 'Auckland'
  };

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const city = timezoneCityMap[tz] || 'New York';
    const name = (os.hostname && os.hostname()) || (os.userInfo && typeof os.userInfo === 'function' ? os.userInfo().username : '') || 'User';
    return { name, city };
  } catch {
    return { name: os.hostname() || 'User', city: 'New York' };
  }
}

const PNG_APP_ICON = path.join(__dirname, 'build', 'icon.png');
const SVG_APP_ICON = path.join(__dirname, 'build', 'yunihub-icon.svg');
const ICON = fs.existsSync(PNG_APP_ICON) ? PNG_APP_ICON : SVG_APP_ICON;
const HOTKEY = 'CommandOrControl+Alt+H';

let win = null;
let tray = null;
let quitting = false;
let prefs = { closeToTray: false, hotkey: false };
let updateState = { status: 'idle', version: '', percent: 0, message: 'Updates are checked when YuniHub starts.' };

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function setUpdateState(status, message, details = {}) {
  updateState = { ...updateState, ...details, status, message };
  if (win && !win.isDestroyed()) win.webContents.send('update:status', updateState);
}

autoUpdater.on('checking-for-update', () => setUpdateState('checking', 'Checking GitHub Releases for an update...'));
autoUpdater.on('update-available', (release) => setUpdateState('available', `YuniHub ${release.version} is available.`, { version: release.version, percent: 0 }));
autoUpdater.on('update-not-available', (release) => setUpdateState('current', 'YuniHub is up to date.', { version: release.version || app.getVersion(), percent: 0 }));
autoUpdater.on('download-progress', (progress) => setUpdateState('downloading', `Downloading update: ${Math.round(progress.percent)}%`, { percent: progress.percent }));
autoUpdater.on('update-downloaded', (release) => setUpdateState('downloaded', `YuniHub ${release.version} is ready to install.`, { version: release.version, percent: 100 }));
autoUpdater.on('error', (error) => setUpdateState('error', error && error.message ? error.message : 'The update check failed.'));

const dataFile = () => path.join(app.getPath('userData'), 'hub.json');
const backupDir = () => path.join(app.getPath('userData'), 'backups');
const boundsFile = () => path.join(app.getPath('userData'), 'window.json');

/* ---------- storage ---------- */

function loadData() {
  try {
    const raw = fs.readFileSync(dataFile(), 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

// Keeps one copy of the previous data per day, for the last 7 days.
function dailyBackup() {
  try {
    const file = dataFile();
    if (!fs.existsSync(file)) return;
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dir = backupDir();
    const target = path.join(dir, `hub-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`);
    if (fs.existsSync(target)) return;
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(file, target);
    const all = fs.readdirSync(dir).filter((n) => /^hub-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
    while (all.length > 7) fs.unlinkSync(path.join(dir, all.shift()));
  } catch { /* backups are best effort */ }
}

function saveData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.projects)) return false;
  const json = JSON.stringify(data, null, 2);
  if (json.length > 5 * 1024 * 1024) return false;
  const file = dataFile();
  const tmp = file + '.tmp';
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    dailyBackup();
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, file); // atomic replace, so a crash never leaves half a file
    return true;
  } catch {
    return false;
  }
}

/* ---------- launching ---------- */

const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isDir = (p) => {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
};

function watchSpawn(child, okAfterMs = 400) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    child.once('error', (e) => finish({ ok: false, error: e.message }));
    child.once('exit', (code) => {
      if (code && code !== 0) finish({ ok: false, error: `The command exited with code ${code}.` });
    });
    setTimeout(() => finish({ ok: true }), okAfterMs);
  });
}

async function launchProject({ mode, target, cwd }) {
  target = str(target, 1000);
  cwd = str(cwd, 1000);
  if (!target) return { ok: false, error: 'No launch target yet. Add one in the project details.' };
  if (cwd && !isDir(cwd)) return { ok: false, error: 'The project folder could not be found.' };

  if (mode === 'app') {
    if (!fs.existsSync(target)) return { ok: false, error: `Cannot find ${target}` };
    const err = await shell.openPath(target);
    return err ? { ok: false, error: err } : { ok: true };
  }

  if (mode !== 'command') return { ok: false, error: 'Unknown launch mode.' };

  try {
    let child;
    if (isWin) {
      // Opens a new terminal window that stays open, running the command in the project folder.
      const escaped = target.replace(/([&|<>^])/g, '^$1');
      child = spawn('cmd.exe', ['/d', '/c', 'start', '"YuniHub"', 'cmd.exe', '/k', escaped], {
        cwd: cwd || undefined, detached: true, stdio: 'ignore', windowsVerbatimArguments: true
      });
    } else if (isMac) {
      const full = (cwd ? `cd '${cwd.replace(/'/g, "'\\''")}'; ` : '') + target;
      child = spawn('osascript', ['-e', `tell application "Terminal" to do script ${JSON.stringify(full)}`, '-e', 'tell application "Terminal" to activate'], {
        detached: true, stdio: 'ignore'
      });
    } else {
      child = spawn('x-terminal-emulator', ['-e', 'bash', '-lc', `${target}; exec bash`], {
        cwd: cwd || undefined, detached: true, stdio: 'ignore'
      });
    }
    child.unref();
    return await watchSpawn(child);
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function openInCode(folder) {
  folder = str(folder, 1000);
  if (!folder || !isDir(folder)) return { ok: false, error: 'Set a project folder first.' };
  try {
    const child = spawn('code', [folder], { detached: true, stdio: 'ignore', shell: isWin });
    child.unref();
    const r = await watchSpawn(child, 1500);
    return r.ok ? r : { ok: false, error: r.error.includes('ENOENT') ? 'VS Code is not on your PATH (the "code" command).' : r.error };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function sendDiscordAuthResult(payload) {
  if (win && win.webContents) win.webContents.send('discord:auth-result', payload);
}

function parseDiscordProtocolUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ''));
    if (url.protocol !== 'yunihub:' || url.hostname !== 'discord-auth') return null;
    return {
      ticket: url.searchParams.get('ticket') || '',
      error: url.searchParams.get('error') || ''
    };
  } catch {
    return null;
  }
}

async function exchangeDiscordTicket(ticket) {
  ticket = str(ticket, 200);
  if (!ticket) return { ok: false, error: 'No sign-in ticket was returned by Discord.' };
  try {
    const res = await fetch(`${AUTH_SERVER_URL}/auth/discord/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticket })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data || !data.user) {
      const msg = data && data.error ? data.error : 'Discord sign-in could not be completed.';
      return { ok: false, error: msg };
    }
    return { ok: true, user: data.user, sessionToken: data.sessionToken || '' };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : 'Discord sign-in failed.' };
  }
}

async function handleDiscordProtocol(rawUrl) {
  const parsed = parseDiscordProtocolUrl(rawUrl);
  if (!parsed) return;
  if (parsed.error) {
    const message = parsed.error === 'discord_consent_denied' ? 'Discord sign-in was cancelled.' : 'Discord sign-in failed.';
    sendDiscordAuthResult({ ok: false, error: message });
    return;
  }
  const result = await exchangeDiscordTicket(parsed.ticket);
  if (result && result.ok && result.sessionToken) {
    const payload = { ok: true, user: result.user, sessionToken: result.sessionToken };
    sendDiscordAuthResult(payload);
    return;
  }
  sendDiscordAuthResult(result);
}

async function refreshDiscordSession(sessionToken) {
  sessionToken = str(sessionToken, 200);
  if (!sessionToken) return { ok: false, error: 'No active Discord session was found.' };
  try {
    const res = await fetch(`${AUTH_SERVER_URL}/auth/discord/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionToken })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data || !data.user) {
      const msg = data && data.error ? data.error : 'Discord session expired.';
      return { ok: false, error: msg };
    }
    return { ok: true, user: data.user };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : 'Discord session refresh failed.' };
  }
}

/* ---------- IPC ---------- */

// Only our own window may talk to the main process.
function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!win || event.sender !== win.webContents) throw new Error('Blocked sender');
    return fn(...args);
  });
}

/* ---------- tools: weather, Discord presence (local IPC), browser beacons ---------- */
const net = require('net');
const http = require('http');
const BEACON_PORT = 47321;
let rpc = { sock: null, user: null };
let beacons = { youtube: false, twitch: false };
let beaconServer = null;

const USERSCRIPT = `// ==UserScript==
// @name         Yuniku Broswer RPC
// @match        https://www.youtube.com/*
// @match        https://www.twitch.tv/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// ==/UserScript==
(function () {
  const site = location.hostname.includes('twitch') ? 'twitch' : 'youtube';
  const text = (sel) => ((document.querySelector(sel) || {}).textContent || '').trim();
  setInterval(() => {
    if (document.hidden) return;
    const title = site === 'twitch' ? document.title.replace(/ - Twitch$/, '') : (text('h1.ytd-watch-metadata') || document.title.replace(/ - YouTube$/, ''));
    const channel = text(site === 'twitch' ? 'h1' : 'ytd-channel-name a');
    GM_xmlhttpRequest({ method: 'POST', url: 'http://127.0.0.1:${BEACON_PORT}/beacon', data: JSON.stringify({ site, title, channel }) });
  }, 15000);
})();
`;

const rpcFrame = (op, data) => {
  const j = Buffer.from(JSON.stringify(data));
  const h = Buffer.alloc(8);
  h.writeInt32LE(op, 0); h.writeInt32LE(j.length, 4);
  return Buffer.concat([h, j]);
};

function rpcDisconnect() {
  if (rpc.sock) { try { rpc.sock.destroy(); } catch { /* ignore */ } }
  rpc = { sock: null, user: null };
}

function rpcConnect(clientId) {
  rpcDisconnect();
  return new Promise((resolve) => {
    const normalizedClientId = str(clientId, 30) || (APP_MODE === 'dev'
      ? (process.env.YUNIHUB_DISCORD_APP_ID_DEV || process.env.DISCORD_APP_ID_DEV || process.env.DISCORD_APP_ID || DEFAULT_DISCORD_APP_ID)
      : (process.env.YUNIHUB_DISCORD_APP_ID || process.env.DISCORD_APP_ID || DEFAULT_DISCORD_APP_ID));

    if (!/^\d{15,25}$/.test(normalizedClientId)) return resolve({ ok: false, error: 'Discord presence is not configured for this build.' });

    let i = 0, done = false, buf = Buffer.alloc(0);
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const pipe = (n) => (isWin ? `\\\\?\\pipe\\discord-ipc-${n}` : path.join(process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp', `discord-ipc-${n}`));
    const attempt = () => {
      if (i > 9) return finish({ ok: false, error: 'Discord is not running.' });
      const s = net.createConnection(pipe(i++));
      s.once('error', attempt);
      s.once('connect', () => {
        s.removeListener('error', attempt);
        rpc.sock = s;
        s.write(rpcFrame(0, { v: 1, client_id: normalizedClientId }));
        s.on('error', () => finish({ ok: false, error: 'Discord connection failed.' }));
        s.on('data', (d) => {
          buf = Buffer.concat([buf, d]);
          while (buf.length >= 8) {
            const len = buf.readInt32LE(4);
            if (buf.length < 8 + len) break;
            let msg = {};
            try { msg = JSON.parse(buf.subarray(8, 8 + len).toString('utf8')); } catch { /* ignore */ }
            buf = buf.subarray(8 + len);
            if (msg.evt === 'READY' && msg.data) {
              rpc.user = msg.data.user;
              setActivity({ details: 'Exploring YuniHub', state: 'Building something new' });
              finish({ ok: true, user: rpc.user });
            }
          }
        });
        s.on('close', () => { if (rpc.sock === s) rpc = { sock: null, user: null }; finish({ ok: false, error: 'Discord closed the connection.' }); });
        setTimeout(() => finish({ ok: false, error: 'Discord did not respond.' }), 4000);
      });
    };
    attempt();
  });
}

function setActivity(activity) {
  if (!rpc.sock) return false;
  try {
    rpc.sock.write(rpcFrame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity }, nonce: String(Date.now()) }));
    return true;
  } catch {
    return false;
  }
}
function startBeacons() {
  if (beaconServer) return;
  beaconServer = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/beacon') { res.writeHead(404); res.end(); return; }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
    req.on('end', () => {
      res.writeHead(204); res.end();
      try {
        const b = JSON.parse(body);
        const site = b.site === 'twitch' ? 'twitch' : 'youtube';
        if (!beacons[site]) return;
        setActivity({
          details: str(b.title, 120) || 'Watching',
          state: str(b.channel, 80) || (site === 'twitch' ? 'Twitch' : 'YouTube'),
          timestamps: { start: Math.floor(Date.now() / 1000) }
        });
      } catch { /* ignore bad payloads */ }
    });
  });
  beaconServer.on('error', () => { beaconServer = null; });
  beaconServer.listen(BEACON_PORT, '127.0.0.1');
}

async function getWeather(city) {
  city = str(city, 80);
  if (!city) {
    const detected = detectSystemProfile();
    city = detected.city;
  }
  if (!city) return { ok: false, error: 'Weather location not detected' };
  try {
    const g = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(city))).json();
    const p = g.results && g.results[0];
    if (!p) return { ok: false, error: 'City not found' };
    const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`)).json();
    const c = w.current.weather_code;
    const label = c === 0 ? 'Clear' : c < 4 ? 'Cloudy' : c < 50 ? 'Fog' : c < 70 ? 'Rain' : c < 80 ? 'Snow' : c < 90 ? 'Showers' : 'Storm';
    return { ok: true, text: `${Math.round(w.current.temperature_2m)}\u00b0F \u00b7 ${label}` };
  } catch {
    return { ok: false, error: 'Weather unavailable' };
  }
}

const SCRIPT_EXTENSIONS = /\.(lua|luau|txt)$/i;
const BUILTIN_SCRIPTS_DIR = path.join(__dirname, 'yuniku-scripts');
const SCRIPT_CATALOG_FILE = path.join(BUILTIN_SCRIPTS_DIR, 'catalog.json');
const SCRIPT_BUNDLE_STATE_FILE = () => path.join(app.getPath('userData'), 'script-bundle-state.json');
const MANAGED_SCRIPTS_FILE = () => path.join(app.getPath('userData'), 'managed-scripts.json');
let scriptWatcher = null;
let scriptChangeTimer = null;

function stringList(value, limit = 20) {
  return (Array.isArray(value) ? value : []).map((item) => str(item, 50)).filter(Boolean).slice(0, limit);
}

function readScriptCatalog() {
  try {
    const stat = fs.statSync(SCRIPT_CATALOG_FILE);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('Invalid catalog size.');
    const catalog = JSON.parse(fs.readFileSync(SCRIPT_CATALOG_FILE, 'utf8'));
    return {
      version: str(catalog.version, 40) || '0.0.0',
      changes: stringList(catalog.changes, 30),
      scripts: Array.isArray(catalog.scripts) ? catalog.scripts.slice(0, 500) : []
    };
  } catch {
    return { version: '0.0.0', changes: [], scripts: [] };
  }
}

function normalizeScriptMetadata(metadata, name) {
  const value = metadata && typeof metadata === 'object' ? metadata : {};
  return {
    title: str(value.title, 100) || name,
    description: str(value.description, 1000),
    version: str(value.version, 40) || 'Unversioned',
    author: str(value.author, 100) || 'Unknown',
    games: stringList(value.games),
    supportedExecutors: stringList(value.supportedExecutors),
    tags: stringList(value.tags)
  };
}

function readUserScriptMetadata(directory, name) {
  const sidecar = path.join(directory, `${name}.json`);
  try {
    if (!fs.lstatSync(sidecar).isFile() || fs.statSync(sidecar).size > 32 * 1024) return {};
    return JSON.parse(fs.readFileSync(sidecar, 'utf8'));
  } catch {
    return {};
  }
}

function supportsExecutorAutoload(filePath) {
  if (!/\.(lua|luau)$/i.test(filePath)) return false;
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(16 * 1024);
    const bytesRead = fs.readSync(fd, header, 0, header.length, 0);
    return header.subarray(0, bytesRead).toString('utf8').split(/\r?\n/, 25)
      .some((line) => /^\s*--\s*YUNIHUB_AUTOLOAD_SUPPORTED:\s*true\s*$/i.test(line));
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function listScriptDirectory(directory, source, catalog = { scripts: [] }) {
  if (!isDir(directory)) return [];
  try {
    const bundledMetadata = new Map(catalog.scripts
      .filter((item) => item && typeof item.file === 'string')
      .map((item) => [item.file, item]));
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && SCRIPT_EXTENSIONS.test(entry.name) && (source !== 'builtin' || bundledMetadata.has(entry.name)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 100)
      .map((entry) => {
        const filePath = path.join(directory, entry.name);
        const metadata = source === 'builtin' ? bundledMetadata.get(entry.name) : readUserScriptMetadata(directory, entry.name);
        return {
          source,
          name: entry.name,
          ...normalizeScriptMetadata(metadata, entry.name),
          supportsAutoload: supportsExecutorAutoload(filePath)
        };
      });
  } catch {
    return [];
  }
}

function listScripts(userFolder) {
  userFolder = str(userFolder, 1000);
  const catalog = readScriptCatalog();
  const scripts = listScriptDirectory(BUILTIN_SCRIPTS_DIR, 'builtin', catalog);
  const userFolderValid = !userFolder || isDir(userFolder);
  if (userFolderValid && userFolder) scripts.push(...listScriptDirectory(userFolder, 'user'));
  scripts.sort((a, b) => (a.source === b.source ? a.name.localeCompare(b.name) : a.source === 'builtin' ? -1 : 1));
  let seenVersion = '';
  try { seenVersion = str(JSON.parse(fs.readFileSync(SCRIPT_BUNDLE_STATE_FILE(), 'utf8')).version, 40); } catch { /* first launch */ }
  return {
    ok: true,
    scripts,
    userFolderValid,
    bundle: { version: catalog.version, changes: catalog.changes, updateAvailable: catalog.version !== '0.0.0' && seenVersion !== catalog.version }
  };
}

function resolveScript(selection, userFolder) {
  if (!selection || !['builtin', 'user'].includes(selection.source)) return null;
  const name = str(selection.name, 255);
  if (!name || name !== path.basename(name) || !SCRIPT_EXTENSIONS.test(name)) return null;
  const directory = selection.source === 'builtin' ? BUILTIN_SCRIPTS_DIR : str(userFolder, 1000);
  if (!directory || !isDir(directory)) return null;
  const filePath = path.join(directory, name);
  try {
    if (!fs.lstatSync(filePath).isFile()) return null;
    const catalog = selection.source === 'builtin' ? readScriptCatalog() : null;
    const metadata = selection.source === 'builtin'
      ? catalog.scripts.find((item) => item && item.file === name)
      : readUserScriptMetadata(directory, name);
    if (selection.source === 'builtin' && !metadata) return null;
    return { filePath, source: selection.source, name, metadata: normalizeScriptMetadata(metadata, name), supportsAutoload: supportsExecutorAutoload(filePath) };
  } catch {
    return null;
  }
}

function readManagedScripts() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MANAGED_SCRIPTS_FILE(), 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

function writeManagedScripts(items) {
  const file = MANAGED_SCRIPTS_FILE();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf8');
}

function listManagedScripts() {
  const items = readManagedScripts().filter((item) => {
    const name = str(item.name, 255);
    const destination = str(item.destination, 1000);
    return name && name === path.basename(name) && SCRIPT_EXTENSIONS.test(name) && isDir(destination) && fs.existsSync(path.join(destination, name));
  });
  return { ok: true, scripts: items };
}

function removeManagedScript(destination, name) {
  destination = str(destination, 1000);
  name = str(name, 255);
  if (!destination || !name || name !== path.basename(name)) return { ok: false, error: 'Invalid managed script.' };
  const items = readManagedScripts();
  const match = items.find((item) => item.destination === destination && item.name === name);
  if (!match) return { ok: false, error: 'YuniHub can only remove scripts it previously installed.' };
  const file = path.join(destination, name);
  try {
    if (fs.lstatSync(file).isFile()) fs.unlinkSync(file);
    writeManagedScripts(items.filter((item) => item !== match));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function readScriptSource(selection, userFolder) {
  const script = resolveScript(selection, userFolder);
  if (!script) return { ok: false, error: 'That script is no longer available.' };
  try {
    const stat = fs.statSync(script.filePath);
    if (stat.size > 256 * 1024) return { ok: false, error: 'Script previews are limited to 256 KB.' };
    return { ok: true, script: { ...script.metadata, source: script.source, name: script.name, supportsAutoload: script.supportsAutoload }, text: fs.readFileSync(script.filePath, 'utf8') };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function acknowledgeScriptBundle(version) {
  const catalog = readScriptCatalog();
  if (str(version, 40) !== catalog.version) return { ok: false, error: 'The script bundle changed. Refresh the library and try again.' };
  try {
    fs.mkdirSync(path.dirname(SCRIPT_BUNDLE_STATE_FILE()), { recursive: true });
    fs.writeFileSync(SCRIPT_BUNDLE_STATE_FILE(), JSON.stringify({ version }, null, 2), 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function copySelectedScripts(selection, userFolder, autoexecFolder, executorPath, action, replaceExisting) {
  if (!Array.isArray(selection) || !selection.length || selection.length > 50) {
    return { ok: false, error: 'Select between 1 and 50 scripts.' };
  }
  const mode = action === 'autoload' ? 'autoload' : 'executor';
  let destination = '';
  if (mode === 'autoload') {
    destination = str(autoexecFolder, 1000);
    if (!destination || !isDir(destination)) return { ok: false, error: 'Choose an existing executor autoload folder in Settings.' };
  } else {
    executorPath = str(executorPath, 1000);
    try {
      if (!executorPath || !fs.statSync(executorPath).isFile()) return { ok: false, error: 'Choose a valid executor application in Settings.' };
      destination = path.dirname(executorPath);
    } catch {
      return { ok: false, error: 'Choose a valid executor application in Settings.' };
    }
  }

  const scripts = selection.map((item) => resolveScript(item, userFolder));
  if (scripts.some((item) => !item)) return { ok: false, error: 'A selected script is no longer available. Refresh the library and try again.' };
  if (mode === 'autoload' && scripts.some((item) => !item.supportsAutoload)) {
    return { ok: false, error: 'One or more selected scripts do not declare executor autoload support.' };
  }
  if (new Set(scripts.map((item) => item.name.toLowerCase())).size !== scripts.length) {
    return { ok: false, error: 'Selected scripts contain duplicate filenames.' };
  }
  const existing = scripts.filter((item) => fs.existsSync(path.join(destination, item.name)));
  if (existing.length && !replaceExisting) return { ok: false, conflict: true, conflicts: existing.map((item) => item.name) };

  try {
    const replacements = [];
    if (existing.length) {
      const backupDir = path.join(app.getPath('userData'), 'script-backups', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      fs.mkdirSync(backupDir, { recursive: true });
      for (const item of existing) {
        const target = path.join(destination, item.name);
        if (!fs.lstatSync(target).isFile()) return { ok: false, error: `Cannot replace non-file destination ${item.name}.` };
        fs.copyFileSync(target, path.join(backupDir, item.name), fs.constants.COPYFILE_EXCL);
        replacements.push({ name: item.name, backup: path.join(backupDir, item.name) });
      }
    }
    const replacedNames = new Set(existing.map((item) => item.name));
    for (const script of scripts) {
      const flags = replacedNames.has(script.name) ? 0 : fs.constants.COPYFILE_EXCL;
      fs.copyFileSync(script.filePath, path.join(destination, script.name), flags);
    }
    const managed = readManagedScripts().filter((item) => !(item.destination === destination && scripts.some((script) => script.name === item.name)));
    managed.push(...scripts.map((item) => ({ destination, name: item.name, source: item.source, action, installedAt: Date.now() })));
    writeManagedScripts(managed);
    return { ok: true, count: scripts.length, files: scripts.map((item) => item.name), replacements };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function watchUserScripts(userFolder) {
  userFolder = str(userFolder, 1000);
  if (scriptWatcher) {
    await scriptWatcher.close();
    scriptWatcher = null;
  }
  clearTimeout(scriptChangeTimer);
  if (!userFolder || !isDir(userFolder)) return { ok: true, watching: false };
  scriptWatcher = chokidar.watch(userFolder, {
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 100 }
  });
  const changed = () => {
    clearTimeout(scriptChangeTimer);
    scriptChangeTimer = setTimeout(() => {
      if (win && !win.isDestroyed()) win.webContents.send('scripts:changed');
    }, 250);
  };
  for (const event of ['add', 'change', 'unlink']) scriptWatcher.on(event, changed);
  scriptWatcher.on('error', (error) => {
    if (win && !win.isDestroyed()) win.webContents.send('scripts:watch-error', str(error.message, 300));
  });
  return { ok: true, watching: true };
}

function registerIpc() {
  handle('store:load', () => loadData());
  handle('store:save', (data) => saveData(data));

  handle('dialog:pick', async (kind) => {
    const props = kind === 'folder' ? ['openDirectory', 'createDirectory'] : ['openFile'];
    const r = await dialog.showOpenDialog(win, { properties: props });
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
  });

  handle('project:launch', (opts) => launchProject(opts || {}));

  handle('project:reveal', async (folder) => {
    folder = str(folder, 1000);
    if (!folder || !fs.existsSync(folder)) return { ok: false, error: 'The project folder could not be found.' };
    const err = await shell.openPath(folder);
    return err ? { ok: false, error: err } : { ok: true };
  });

  handle('project:code', (folder) => openInCode(folder));

  handle('tool:weather', (city) => getWeather(city));
  handle('tool:listScripts', (userFolder) => listScripts(userFolder));
  handle('tool:readScript', (selection, userFolder) => readScriptSource(selection, userFolder));
  handle('tool:listManagedScripts', () => listManagedScripts());
  handle('tool:removeManagedScript', (destination, name) => removeManagedScript(destination, name));
  handle('tool:openScriptBackups', async () => {
    const directory = path.join(app.getPath('userData'), 'script-backups');
    fs.mkdirSync(directory, { recursive: true });
    const error = await shell.openPath(directory);
    return error ? { ok: false, error } : { ok: true };
  });
  handle('tool:ackScriptBundle', (version) => acknowledgeScriptBundle(version));
  handle('tool:watchScripts', (userFolder) => watchUserScripts(userFolder));
  handle('tool:copyScripts', (request) => {
    const r = request || {};
    return copySelectedScripts(r.selection, r.userFolder, r.autoexecFolder, r.executorPath, r.action, r.replaceExisting);
  });
  handle('rpc:connect', (id) => rpcConnect(str(id, 30)));
  handle('rpc:disconnect', () => { rpcDisconnect(); return true; });
  handle('rpc:activity', (activity) => {
    const details = str(activity && activity.details, 128);
    const state = str(activity && activity.state, 128);
    if (!details && !state) return false;
    return setActivity({ details, state });
  });
  handle('beacon:set', (b) => {
    beacons = { youtube: !!(b && b.youtube), twitch: !!(b && b.twitch) };
    if (beacons.youtube || beacons.twitch) startBeacons();
    return { ok: true, port: BEACON_PORT };
  });
  handle('beacon:script', async () => {
    const r = await dialog.showSaveDialog(win, { defaultPath: 'yuniku-hub-beacon.user.js', filters: [{ name: 'Userscript', extensions: ['js'] }] });
    if (r.canceled || !r.filePath) return { ok: false, canceled: true };
    try { fs.writeFileSync(r.filePath, USERSCRIPT, 'utf8'); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
  });

  handle('app:info', () => {
    const system = detectSystemProfile();
    return {
      version: app.getVersion(),
      platform: process.platform,
      dataFile: dataFile(),
      backupDir: backupDir(),
      openAtLogin: app.getLoginItemSettings().openAtLogin,
      userName: system.name,
      weatherCity: system.city,
      buildMode: APP_MODE,
      presenceConfigured: /^\d{15,25}$/.test(DEFAULT_DISCORD_APP_ID)
    };
  });

  handle('update:state', () => updateState);
  handle('update:check', async () => {
    if (!app.isPackaged) return { ok: false, error: 'Update checks are available in installed builds.' };
    try { await autoUpdater.checkForUpdates(); return { ok: true }; }
    catch (error) { return { ok: false, error: error.message || 'Could not check for updates.' }; }
  });
  handle('update:download', async () => {
    if (!app.isPackaged || updateState.status !== 'available') return { ok: false, error: 'There is no update ready to download.' };
    try { await autoUpdater.downloadUpdate(); return { ok: true }; }
    catch (error) { return { ok: false, error: error.message || 'Could not download the update.' }; }
  });
  handle('update:install', () => {
    if (!app.isPackaged || updateState.status !== 'downloaded') return { ok: false, error: 'Download an update before installing it.' };
    autoUpdater.quitAndInstall(true, true);
    return { ok: true };
  });

  handle('app:setPrefs', (p) => ({ hotkeyOk: applyPrefs(p || {}) }));

  handle('app:openBackups', async () => {
    fs.mkdirSync(backupDir(), { recursive: true });
    const err = await shell.openPath(backupDir());
    return err ? { ok: false, error: err } : { ok: true };
  });

  handle('app:openUrl', async (url) => {
    try {
      const u = new URL(String(url));
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'Only web links can be opened.' };
      await shell.openExternal(u.toString());
      return { ok: true };
    } catch {
      return { ok: false, error: 'That link is not valid.' };
    }
  });

  handle('app:discordAuth', async () => {
    try {
      const url = `${AUTH_SERVER_URL}/auth/discord`;
      await shell.openExternal(url);
      return { ok: true, url };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : 'Could not open the Discord sign-in page.' };
    }
  });

  handle('app:discordExchange', async (ticket) => exchangeDiscordTicket(ticket));
  handle('app:discordSession', async (sessionToken) => refreshDiscordSession(sessionToken));

  // Dropped files give a path. For the "project folder" field we want the folder itself.
  handle('path:dir', (p) => {
    p = str(p, 1000);
    if (!p) return '';
    return isDir(p) ? p : path.dirname(p);
  });

  handle('app:setLogin', (on) => {
    app.setLoginItemSettings({ openAtLogin: !!on });
    return app.getLoginItemSettings().openAtLogin;
  });

  handle('app:setTheme', (theme, customBackground) => {
    const t = resolveTheme(theme, customBackground);
    if (win && !isLinux && win.setTitleBarOverlay) {
      try { win.setTitleBarOverlay({ color: t.color, symbolColor: t.symbolColor, height: 40 }); } catch { /* window has no titlebar overlay */ }
    }
    if (win) win.setBackgroundColor(t.color);
    return true;
  });

  handle('data:export', async (json) => {
    if (typeof json !== 'string') return { ok: false, error: 'Nothing to export.' };
    const r = await dialog.showSaveDialog(win, { defaultPath: 'yunihub-backup.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return { ok: false, canceled: true };
    try { fs.writeFileSync(r.filePath, json, 'utf8'); return { ok: true, path: r.filePath }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  handle('data:import', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    try {
      const file = r.filePaths[0];
      if (fs.statSync(file).size > 5 * 1024 * 1024) return { ok: false, error: 'That file is too large to be a backup.' };
      return { ok: true, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch {
      return { ok: false, error: 'That file is not a valid backup.' };
    }
  });
}

/* ---------- window, tray, shortcut ---------- */

function showWin() {
  if (!win) { createWindow(); return; }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function toggleWin() {
  if (!win) { createWindow(); return; }
  if (win.isVisible() && win.isFocused() && !win.isMinimized()) {
    if (prefs.closeToTray) win.hide(); else win.minimize();
  } else {
    showWin();
  }
}

// Returns false only when the global shortcut could not be registered.
function applyPrefs(p) {
  prefs = { closeToTray: !!p.closeToTray, hotkey: !!p.hotkey };

  if (prefs.closeToTray && !tray) {
    try {
      tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
      tray.setToolTip('YuniHub');
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Open YuniHub', click: showWin },
        { type: 'separator' },
        { label: 'Quit', click: () => { quitting = true; app.quit(); } }
      ]));
      tray.on('click', showWin);
    } catch { tray = null; prefs.closeToTray = false; }
  } else if (!prefs.closeToTray && tray) {
    tray.destroy();
    tray = null;
  }

  globalShortcut.unregister(HOTKEY);
  if (!prefs.hotkey) return true;
  try { return globalShortcut.register(HOTKEY, toggleWin); } catch { return false; }
}

function loadBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(boundsFile(), 'utf8'));
    const ok = ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(b[k]));
    if (!ok || b.width < 760 || b.height < 500) return null;
    // Only reuse the position if it is still on a connected screen.
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return b.x < a.x + a.width - 80 && b.x + b.width > a.x + 80 && b.y < a.y + a.height - 80 && b.y + 80 < a.y + a.height && b.y >= a.y - 20;
    });
    return visible ? b : { width: b.width, height: b.height, maximized: b.maximized };
  } catch {
    return null;
  }
}

function saveBounds() {
  if (!win) return;
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(boundsFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch { /* not important */ }
}

function createWindow() {
  const saved = loadData();
  const settings = saved && saved.settings || {};
  const theme = ['rei', 'dehbify', 'custom'].includes(settings.theme) ? settings.theme : 'dark';
  const t = resolveTheme(theme, settings.customTheme && settings.customTheme.background);
  const b = loadBounds() || {};

  win = new BrowserWindow({
    width: b.width || 1240,
    height: b.height || 800,
    ...(Number.isFinite(b.x) ? { x: b.x, y: b.y } : {}),
    minWidth: 760,
    minHeight: 500,
    show: false,
    title: 'YuniHub',
    backgroundColor: t.color,
    autoHideMenuBar: true,
    icon: ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    if (b.maximized) win.maximize();
    win.show();
  });

  // The app is fully local: never open new windows or navigate away from it.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  win.on('close', (e) => {
    saveBounds();
    if (prefs.closeToTray && !quitting) { e.preventDefault(); win.hide(); }
  });
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const incoming = argv.find((arg) => /^yunihub:\/\//.test(arg));
    if (incoming) handleDiscordProtocol(incoming);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    try {
      if (app.isPackaged) {
        app.setAsDefaultProtocolClient('yunihub');
      } else {
        const appEntry = path.resolve(process.argv[1] || '.');
        const protocolArgs = [appEntry, ...(APP_MODE === 'dev' ? ['--dev'] : [])];
        app.setAsDefaultProtocolClient('yunihub', process.execPath, protocolArgs);
      }
    } catch { /* protocol registration is best effort */ }
    Menu.setApplicationMenu(null);
    registerIpc();
    createWindow();
    if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {});
    const saved = loadData();
    if (saved && saved.settings) applyPrefs(saved.settings);
    const initialUrl = process.argv.find((arg) => /^yunihub:\/\//.test(arg));
    if (initialUrl) setTimeout(() => handleDiscordProtocol(initialUrl), 150);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDiscordProtocol(url);
  });

  app.on('before-quit', () => {
    quitting = true;
    if (scriptWatcher) { scriptWatcher.close(); scriptWatcher = null; }
    clearTimeout(scriptChangeTimer);
  });
  app.on('will-quit', () => { globalShortcut.unregisterAll(); rpcDisconnect(); if (beaconServer) beaconServer.close(); });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}
