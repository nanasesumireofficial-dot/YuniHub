'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, globalShortcut, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';
const APP_MODE = process.argv.includes('--dev') ? 'dev' : 'release';

const THEMES = {
  dark: { color: '#05070d', symbolColor: '#d9dcff' },
  rei: { color: '#e8f1fa', symbolColor: '#1b3550' }
};

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
    const name = (os.userInfo && typeof os.userInfo === 'function' ? os.userInfo().username : '') || os.hostname() || 'User';
    return { name, city };
  } catch {
    return { name: os.hostname() || 'User', city: 'New York' };
  }
}

const ICON = path.join(__dirname, 'build', 'icon.png');
const HOTKEY = 'CommandOrControl+Alt+H';

let win = null;
let tray = null;
let quitting = false;
let prefs = { closeToTray: false, hotkey: false };

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
// @name         Yuniku Hub Beacon
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
    if (!/^\d{15,25}$/.test(clientId || '')) return resolve({ ok: false, error: 'Enter a valid Discord application ID in Settings.' });
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
        s.write(rpcFrame(0, { v: 1, client_id: clientId }));
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

// Copies every .lua/.luau/.txt script from the scripts folder into the executor's autoexec folder.
function autoLoad(src, dest) {
  src = str(src, 1000); dest = str(dest, 1000);
  if (!isDir(src)) return { ok: false, error: 'Set your scripts folder in Settings.' };
  if (!isDir(dest)) return { ok: false, error: 'Set your executor autoexec folder in Settings.' };
  try {
    const files = fs.readdirSync(src).filter((n) => /\.(lua|luau|txt)$/i.test(n));
    files.forEach((n) => fs.copyFileSync(path.join(src, n), path.join(dest, n)));
    return { ok: true, count: files.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
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
  handle('tool:autoload', (s, d) => autoLoad(s, d));
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
      buildMode: APP_MODE
    };
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

  handle('app:setTheme', (theme) => {
    const t = THEMES[theme] || THEMES.dark;
    if (win && !isLinux && win.setTitleBarOverlay) win.setTitleBarOverlay({ color: t.color, symbolColor: t.symbolColor, height: 40 });
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
    if (!ok || b.width < 960 || b.height < 620) return null;
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
  const theme = saved && saved.settings && saved.settings.theme === 'rei' ? 'rei' : 'dark';
  const t = THEMES[theme];
  const b = loadBounds() || {};

  win = new BrowserWindow({
    width: b.width || 1240,
    height: b.height || 800,
    ...(Number.isFinite(b.x) ? { x: b.x, y: b.y } : {}),
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: 'YuniHub',
    backgroundColor: t.color,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
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
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    registerIpc();
    createWindow();
    const saved = loadData();
    if (saved && saved.settings) applyPrefs(saved.settings);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => { globalShortcut.unregisterAll(); rpcDisconnect(); if (beaconServer) beaconServer.close(); });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}
