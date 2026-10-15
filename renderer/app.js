'use strict';
(function () {
  /* ---------- bridge (falls back to a browser-only demo so index.html also opens in a plain browser) ---------- */
  const API = window.hub || makeDemoApi();

  function makeDemoApi() {
    const KEY = 'yunihub-demo';
    const no = async () => ({ ok: false, error: 'This works in the desktop app.' });
    return {
      load: async () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
      save: async (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; } },
      pick: async () => null, launch: no, reveal: no, openCode: no, openBackups: no,
      openUrl: async (u) => { window.open(u, '_blank', 'noopener'); return { ok: true }; },
      info: async () => ({ version: 'dev', platform: 'browser', dataFile: 'browser storage', backupDir: '', openAtLogin: false, buildMode: 'dev' }),
      setLogin: async (v) => v, setTheme: async () => true, setPrefs: async () => ({ hotkeyOk: true }),
      exportData: no, importData: no, dirOf: async (p) => p, pathFor: () => '',
      weather: async () => ({ ok: false, error: 'Desktop app only' }), autoload: no, rpcConnect: no,
      rpcDisconnect: async () => true, setActivity: async () => false, setBeacons: async () => ({ ok: true }), saveUserscript: no
    };
  }

  /* ---------- icons ---------- */
  const ICONS = {
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    monitor: '<rect x="2.5" y="4" width="19" height="12.5" rx="2.5"/><path d="M8 21h8M12 16.5V21"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    play: '<path d="M7.5 4.8v14.4a.6.6 0 0 0 .9.5l11.5-7.2a.6.6 0 0 0 0-1L8.4 4.3a.6.6 0 0 0-.9.5z"/>',
    folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    arrow: '<path d="M9 5l7 7-7 7"/>',
    star: '<path d="M12 3.6l2.6 5.3 5.8.9-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8L3.6 9.8l5.8-.9z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    pencil: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    grip: '<circle cx="9" cy="6" r="1.1"/><circle cx="15" cy="6" r="1.1"/><circle cx="9" cy="12" r="1.1"/><circle cx="15" cy="12" r="1.1"/><circle cx="9" cy="18" r="1.1"/><circle cx="15" cy="18" r="1.1"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    theme: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    camera: '<rect x="3" y="6.5" width="18" height="13" rx="3.5"/><circle cx="12" cy="13" r="3.4"/><path d="M8.5 6.5 10 4.5h4l1.5 2"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="4.5"/><path d="M10.2 9.2v5.6l4.8-2.8z"/>',
    package: '<path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
    orb: '<circle cx="12" cy="12" r="8.5"/><path d="M7.8 10.2A5 5 0 0 1 12 7.2"/>',
    toolbox: '<rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M9 8V5.5h6V8M3 13.5h18"/>',
    chat: '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>'
  };
  const PICKABLE = ['camera', 'video', 'package', 'orb', 'toolbox', 'phone', 'monitor', 'code', 'chat', 'bolt', 'globe'];
  const svg = (k) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ''}</svg>`;

  const STATUSES = ['Idea', 'Building', 'Testing', 'Shipped', 'Blocked'];
  const TRACKS = ['Android', 'PC'];
  const SORTS = [['manual', 'Pinned first'], ['recent', 'Recently opened'], ['progress', 'Most progress'], ['name', 'Name A to Z']];
  const TEMPLATES = {
    blank: { label: 'Blank', tasks: [] },
    android: { label: 'Android app', tasks: ['Set up the Android Studio project', 'Design the main screen', 'Build the first feature', 'Test on a real phone', 'Build a release APK'] },
    desktop: { label: 'Desktop app', tasks: ['Pick a framework', 'Sketch the window', 'Build the first feature', 'Add settings', 'Package an installer'] },
    script: { label: 'Script or tool', tasks: ['Write down the goal', 'Get a first version running', 'Add settings', 'Share it'] }
  };

  /* ---------- helpers ---------- */
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function relTime(ts) {
    if (!ts) return '';
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function cleanUrl(u) {
    u = clip(u, 500);
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { return new URL(u).toString(); } catch { return ''; }
  }

  /* ---------- data ---------- */
  const EXTRA = { city: '', exe: '', scripts: '', autoexec: '', rpcMode: 'release', rpcDev: '', rpcRelease: '', beacons: { youtube: false, twitch: false } };
  let appMode = 'release';
  const canEditProjects = () => appMode === 'dev';
  const gateProjectEditor = (msg = 'This feature is available in developer mode only.') => {
    if (canEditProjects()) return true;
    toast(msg, 'err');
    return false;
  };

  function mkProject(name, desc, track, icon, tasks) {
    return normProject({
      name, desc, track, icon,
      tasks: tasks.map((t, i) => ({ id: uid(), t, d: i === 0 }))
    });
  }
  function defaults() {
    return {
      version: 2,
      settings: { name: '', hubName: 'YuniHub', theme: 'dark', sort: 'manual', closeToTray: false, hotkey: false, welcomeSeen: false, ...EXTRA, beacons: { ...EXTRA.beacons } },
      projects: [
        mkProject('Instagram Client', 'Your own Android client for browsing Instagram.', 'Android', 'camera',
          ['Add it to the hub', 'Pick the app architecture', 'Sign-in and session storage', 'Home feed screen', 'Profile screen', 'Photo and video viewer', 'Direct messages', 'Settings and theming']),
        mkProject('YouTube Client', 'A ReVanced-style YouTube app with the extras built in.', 'Android', 'video',
          ['Add it to the hub', 'Pick the player library', 'Search and results', 'Video playback screen', 'Subscriptions feed', 'Background playback', 'Downloads', 'Settings']),
        mkProject('APK Installer', 'Open an APK, check it, and install it in a few taps.', 'Android', 'package',
          ['Add it to the hub', 'Read app name, version and icon', 'Install through the system installer', 'Install progress screen', 'Split APK and bundle support', 'Installed apps list', 'Update and uninstall']),
        mkProject('Discord Orb Completer', 'A desktop helper for Discord orbs.', 'PC', 'orb',
          ['Add it to the hub', 'Write down what it should do', 'Sketch the window layout', 'Settings storage', 'First working version']),
        mkProject('PC Toolbox', 'A home for the smaller desktop utilities to come.', 'PC', 'toolbox',
          ['Add it to the hub', 'List the first three tools', 'Pick a shared look', 'Package it as an installer'])
      ]
    };
  }
  function normProject(p) {
    const o = p && typeof p === 'object' ? p : {};
    const l = o.launch && typeof o.launch === 'object' ? o.launch : {};
    const tasks = (Array.isArray(o.tasks) ? o.tasks : []).slice(0, 300)
      .map((t) => ({ id: clip(t && t.id, 20) || uid(), t: clip(t && t.t, 160), d: !!(t && t.d) }))
      .filter((t) => t.t);
    const links = (Array.isArray(o.links) ? o.links : []).slice(0, 30)
      .map((k) => ({ id: clip(k && k.id, 20) || uid(), label: clip(k && k.label, 60), url: cleanUrl(k && k.url) }))
      .filter((k) => k.url)
      .map((k) => ({ ...k, label: k.label || hostOf(k.url) }));
    return {
      id: clip(o.id, 40) || uid(),
      name: clip(o.name, 60) || 'Untitled',
      desc: clip(o.desc, 200),
      track: o.track === 'PC' ? 'PC' : 'Android',
      icon: PICKABLE.includes(o.icon) ? o.icon : 'package',
      status: STATUSES.includes(o.status) ? o.status : 'Idea',
      pinned: !!o.pinned,
      tasks, links,
      notes: String(o.notes == null ? '' : o.notes).slice(0, 20000),
      folder: clip(o.folder, 500),
      launch: { mode: l.mode === 'command' ? 'command' : 'app', target: clip(l.target, 500) },
      opened: Number(o.opened) || 0,
      created: Number(o.created) || Date.now()
    };
  }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }
  function normalize(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.projects)) return null;
    const s = d.settings && typeof d.settings === 'object' ? d.settings : {};
    return {
      version: 2,
      settings: {
        name: clip(s.name, 40), hubName: clip(s.hubName, 30) || 'YuniHub',
        theme: s.theme === 'rei' ? 'rei' : 'dark',
        sort: SORTS.some((x) => x[0] === s.sort) ? s.sort : 'manual',
        closeToTray: !!s.closeToTray, hotkey: !!s.hotkey, welcomeSeen: !!s.welcomeSeen,
        city: clip(s.city, 80), exe: clip(s.exe, 500), scripts: clip(s.scripts, 500), autoexec: clip(s.autoexec, 500),
        rpcMode: s.rpcMode === 'dev' ? 'dev' : 'release', rpcDev: clip(s.rpcDev, 30), rpcRelease: clip(s.rpcRelease, 30),
        beacons: { youtube: !!(s.beacons && s.beacons.youtube), twitch: !!(s.beacons && s.beacons.twitch) }
      },
      projects: d.projects.slice(0, 200).map(normProject)
    };
  }

  /* ---------- state ---------- */
  let S = defaults();
  let info = { version: '', platform: '', dataFile: '', backupDir: '', openAtLogin: false };
  const ui = { view: 'home', id: null, modal: false, confirmDel: false, q: '', editTask: null };
  const drafts = {};
  const pal = { open: false, q: '', sel: 0 };
  let rpcUser = null;
  let weather = 'Syncing...';
  let saveTimer = null;
  let dirty = false;

  const find = (id) => S.projects.find((p) => p.id === id);
  const progress = (p) => {
    const t = p.tasks.length, d = p.tasks.filter((x) => x.d).length;
    return { t, d, pct: t ? Math.round((100 * d) / t) : 0 };
  };

  function touch() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 350);
  }
  async function flush() {
    clearTimeout(saveTimer);
    if (!dirty) return;
    dirty = false;
    const ok = await API.save(S);
    if (!ok) toast('Could not save your changes.', 'err');
  }
  window.addEventListener('blur', flush);
  window.addEventListener('pagehide', flush);

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', S.settings.theme);
    API.setTheme(S.settings.theme);
  }

  /* ---------- toast (with optional action, used for undo) ---------- */
  let toastTimer = null;
  let toastAction = null;
  function toast(msg, kind, action) {
    const el = document.getElementById('toast');
    el.innerHTML = '<span></span>' + (action ? `<button type="button" class="toast-btn">${esc(action.label)}</button>` : '');
    el.firstChild.textContent = msg;
    el.className = 'show ' + (kind || '') + (action ? ' has-action' : '');
    toastAction = action ? action.fn : null;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ''; toastAction = null; }, action ? 7000 : 3400);
  }
  document.getElementById('toast').addEventListener('click', (e) => {
    if (e.target.closest('.toast-btn') && toastAction) {
      const fn = toastAction;
      toastAction = null;
      document.getElementById('toast').className = '';
      fn();
    }
  });

  /* ---------- views ---------- */
  function greeting() {
    const h = new Date().getHours();
    const g = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const n = S.settings.name || 'User';
    return `${g}${n ? ', ' + esc(n) : ''}. Welcome to ${esc(S.settings.hubName)}.`;
  }

  function overall() {
    let t = 0, d = 0;
    S.projects.forEach((p) => { const x = progress(p); t += x.t; d += x.d; });
    return { t, d, pct: t ? Math.round((100 * d) / t) : 0 };
  }

  function nextUp() {
    let best = null;
    S.projects.forEach((p) => {
      if (p.status === 'Shipped') return;
      const open = p.tasks.find((t) => !t.d);
      if (!open) return;
      const rank = (p.status === 'Building' || p.status === 'Testing' ? 100 : 0) + progress(p).pct;
      if (!best || rank > best.rank) best = { rank, p, task: open.t };
    });
    return best;
  }

  function visible(track) {
    let items = S.projects.filter((p) => !track || p.track === track);
    const q = ui.q.trim().toLowerCase();
    if (q) items = items.filter((p) => (p.name + ' ' + p.desc + ' ' + p.status + ' ' + p.track).toLowerCase().includes(q));
    const cmps = {
      manual: () => 0,
      recent: (a, b) => (b.opened || 0) - (a.opened || 0),
      progress: (a, b) => progress(b).pct - progress(a).pct,
      name: (a, b) => a.name.localeCompare(b.name)
    };
    const cmp = cmps[S.settings.sort] || cmps.manual;
    return items.map((p, i) => ({ p, i }))
      .sort((a, b) => ((+!!b.p.pinned) - (+!!a.p.pinned)) || cmp(a.p, b.p) || a.i - b.i)
      .map((x) => x.p);
  }

  /* ---------- tools (Spotify, Roblox, Discord Status) ---------- */
  const TOOLS = [
    { id: 'yunispot', cat: 'Spotify', icon: 'headphones', name: 'YuniSpot', soon: true, label: 'Install', desc: 'Custom Spotify client with theming, ad-block, and extra playback features. Installs and patches Spotify automatically.' },
    { id: 'autoload', cat: 'Roblox', icon: 'toolbox', name: 'Auto-Load Yuniku Made Scripts', label: 'Launch', desc: 'Lets you auto-load any Yuniku made scripts into your executor with a single click.' },
    { id: 'executor', cat: 'Roblox', icon: 'bolt', name: 'Executor Launcher', label: 'Launch', desc: 'Quick-launch your executor directly from the hub.' },
    { id: 'youtube', cat: 'Discord', icon: 'video', name: 'YouTube Beacon', toggle: true, desc: 'Requires Tampermonkey + the Yuniku Hub userscript installed in your browser. Then this updates your Discord Rich Presence while watching YouTube.' },
    { id: 'twitch', cat: 'Discord', icon: 'chat', name: 'Twitch Beacon', toggle: true, desc: 'Requires Tampermonkey + the Yuniku Hub userscript installed in your browser. Then this updates your Discord Rich Presence while watching or streaming on Twitch.' }
  ];

  function toolCard(t) {
    const on = t.toggle && S.settings.beacons[t.id];
    const label = t.toggle ? (on ? 'Disable' : 'Enable') : t.label;
    return `<article class="card"><div class="card-top"><div class="tile">${svg(t.icon)}</div>
      <div class="card-head"><h3>${esc(t.name)}</h3><span class="pill ${t.soon ? 'st-Idea' : 'st-Shipped'}">${t.soon ? 'coming soon' : on ? 'on' : 'available'}</span></div></div>
      <p class="desc">${esc(t.desc)}</p>
      <div class="actions"><button class="btn${t.soon ? '' : ' primary'}" data-act="tool" data-id="${t.id}" data-k="tool-${t.id}">${label}</button></div></article>`;
  }
  const toolGrid = (cat) => `<div class="grid tools-grid">${TOOLS.filter((t) => !cat || t.cat === cat).map(toolCard).join('')}</div>`;

  function viewTools(cat) {
    const extra = cat === 'Discord' ? `<section class="panel" style="margin-top:16px"><h3>Browser userscript</h3>
      <p class="help">Install Tampermonkey, then add this script. It sends the current video title to the hub on this PC only (127.0.0.1), and the hub shows it on Discord. Link Discord in the sidebar first.</p>
      <div class="actions"><button class="btn" data-act="ut" data-k="ut">Export userscript</button></div></section>` : '';
    return `<div class="sec-head"><h2>${cat === 'Discord' ? 'Discord Status' : cat}</h2></div>${toolGrid(cat)}${extra}`;
  }

  function intPanel() {
    const s = S.settings;
    const detectedCity = s.city || info.weatherCity || 'Detecting your weather city...';
    const f = (label, key, ph, kind) => `<div class="field"><label class="label" for="s-${key}">${label}</label><div class="row nowrap">
      <input class="in" id="s-${key}" data-set="${key}" value="${esc(s[key])}" placeholder="${ph}" spellcheck="false">
      ${kind ? `<button class="btn" data-act="setpick" data-f="${key}" data-v="${kind}" data-k="pk-${key}">Browse</button>` : ''}</div></div>`;
    return `<section class="panel"><h3>Integrations</h3>
      <div class="field"><label class="label">Detected weather city</label>
        <input class="in" value="${esc(detectedCity)}" readonly aria-readonly="true"></div>
      ${f('Executor', 'exe', 'Path to your executor .exe', 'file')}
      ${f('Scripts folder', 'scripts', 'Folder with your Yuniku scripts', 'folder')}
      ${f('Executor autoexec folder', 'autoexec', 'Where your executor auto-runs scripts', 'folder')}
      ${f('Discord app ID (release)', 'rpcRelease', 'Application ID')}
      ${f('Discord app ID (dev)', 'rpcDev', 'Application ID')}</section>`;
  }

  async function connectRpc() {
    const s = S.settings;
    const r = await API.rpcConnect(s.rpcMode === 'dev' ? s.rpcDev : s.rpcRelease);
    rpcUser = r && r.ok ? r.user : null;
    render();
    if (!r || !r.ok) toast((r && r.error) || 'Could not link Discord.', 'err');
    else updateDiscordActivity();
  }

  function updateDiscordActivity() {
    if (!rpcUser) return;
    const p = ui.view === 'project' ? find(ui.id) : null;
    API.setActivity({
      details: p ? `Working on ${p.name}` : 'Planning projects',
      state: 'In YuniHub'
    });
  }

  async function refreshWeather() {
    if (!S.settings.city) weather = 'Detecting weather...';
    else { const r = await API.weather(S.settings.city); weather = r && r.ok ? r.text : (r && r.error) || 'Unavailable'; }
    const el = document.getElementById('c-weather');
    if (el) el.textContent = weather;
  }

  async function runTool(id) {
    const s = S.settings;
    if (id === 'yunispot') { toast('YuniSpot is coming soon.'); return; }
    if (id === 'youtube' || id === 'twitch') {
      s.beacons[id] = !s.beacons[id]; touch();
      await API.setBeacons(s.beacons); render();
      if (s.beacons[id] && !rpcUser) toast('Connect Discord in the sidebar to show your presence.');
      return;
    }
    if (id === 'executor') {
      if (!s.exe) { toast('Set your executor path in Settings.', 'err'); return; }
      const r = await API.launch({ mode: 'app', target: s.exe, cwd: '' });
      if (r && r.ok) toast('Launched your executor.', 'ok'); else toast((r && r.error) || 'Could not launch.', 'err');
      return;
    }
    const r = await API.autoload(s.scripts, s.autoexec);
    if (r && r.ok) toast(`Loaded ${r.count} script${r.count === 1 ? '' : 's'} into your executor.`, 'ok');
    else toast((r && r.error) || 'Could not load scripts.', 'err');
  }

  function sidebar() {
    const o = overall();
    const cnt = (tr) => S.projects.filter((p) => p.track === tr).length;
    const cur = ui.view === 'project' && find(ui.id) ? find(ui.id).track : ui.view;
    const item = (v, label, icon, count) =>
      `<button class="nav-item${cur === v ? ' on' : ''}" data-act="nav" data-v="${v}" data-k="nav-${v}">
        <span class="nav-ic">${svg(icon)}</span><span>${label}</span>${count != null ? `<em>${count}</em>` : ''}</button>`;
    const recent = S.projects.filter((p) => p.opened).sort((a, b) => b.opened - a.opened).slice(0, 3);
    return `<aside class="side">
      <div class="logo">
        <svg class="logo-mark" viewBox="0 0 44 48" aria-hidden="true"><polygon points="22,2 41,13 41,35 22,46 3,35 3,13" fill="none" style="stroke:var(--a1)" stroke-width="2.4"/><polygon points="22,12 32,18 32,30 22,36 12,30 12,18" style="fill:var(--a2)"/></svg>
        <b>${esc(S.settings.hubName)}<i></i></b>
      </div>
      <button class="searchbtn" data-act="palette" data-k="palette">${svg('search')}<span>Search</span><kbd>Ctrl K</kbd></button>
      <nav class="nav" aria-label="Main">
        ${item('home', 'Home', 'home', S.projects.length)}
        ${item('Spotify', 'Spotify', 'headphones')}
        ${item('Roblox', 'Roblox', 'package')}
        ${item('Discord', 'Discord Status', 'chat')}
        ${item('Android', 'Android', 'phone', cnt('Android'))}
        ${item('PC', 'PC', 'monitor', cnt('PC'))}
        ${item('settings', 'Settings', 'sliders', null)}
      </nav>
      ${recent.length ? `<div class="recent"><span class="label">Recent</span>${recent.map((p) =>
        `<button class="rec${ui.view === 'project' && ui.id === p.id ? ' on' : ''}" data-act="open" data-id="${p.id}" data-k="rc-${p.id}">${svg(p.icon)}<span>${esc(p.name)}</span></button>`).join('')}</div>` : ''}
      <div class="spacer"></div>
      <div class="sync-card">
        <span class="label dot-label"><i class="dot${rpcUser ? '' : ' off'}"></i>${rpcUser ? 'Discord linked' : 'Discord not linked'}</span>
        ${rpcUser
          ? `<button class="btn danger" data-act="rpcout" data-k="rpcout">Disconnect</button><span class="rpc-user">${esc(rpcUser.global_name || rpcUser.username || '')}</span>`
          : `<button class="btn primary" data-act="rpclink" data-k="rpclink">Connect Discord</button>`}
        <span class="label">RPC mode</span>
        <div class="seg" role="group" aria-label="RPC mode">
          <button data-act="rpcmode" data-v="dev" data-k="rm-dev" aria-pressed="${S.settings.rpcMode === 'dev'}">Dev</button>
          <button data-act="rpcmode" data-v="release" data-k="rm-rel" aria-pressed="${S.settings.rpcMode !== 'dev'}">Release</button>
        </div>
      </div>
      <div class="ver">v${esc(info.version || '0.2.0')}</div>
    </aside>`;
  }

  function card(p) {
    const pr = progress(p);
    const ready = !!p.launch.target;
    return `<article class="card">
      <div class="card-top">
        <div class="tile">${svg(p.icon)}</div>
        <div class="card-head"><h3>${esc(p.name)}</h3>
          <span class="head-r"><span class="pill st-${p.status}">${p.status}</span>
            <button class="icon-btn sm pin${p.pinned ? ' on' : ''}" data-act="pin" data-id="${p.id}" data-k="pin-${p.id}" aria-pressed="${p.pinned}" aria-label="${p.pinned ? 'Unpin' : 'Pin'} ${esc(p.name)}" title="${p.pinned ? 'Unpin' : 'Pin to top'}">${svg('star')}</button></span></div>
      </div>
      <p class="desc">${esc(p.desc) || '<span style="color:var(--faint)">No description yet.</span>'}</p>
      <div class="meter-row">
        <div class="meter-meta"><span>${p.track}${p.opened ? ' &middot; opened ' + relTime(p.opened) : ''}</span><span>${pr.d} of ${pr.t} tasks &middot; ${pr.pct}%</span></div>
        <div class="meter"><i style="--p:${pr.pct}%"></i></div>
      </div>
      <div class="actions">
        ${ready
          ? `<button class="btn primary" data-act="launch" data-id="${p.id}" data-k="l-${p.id}">${svg('play')}Launch</button>`
          : `<button class="btn primary" data-act="open" data-id="${p.id}" data-k="s-${p.id}">${svg('sliders')}Set up</button>`}
        <button class="btn" data-act="open" data-id="${p.id}" data-k="o-${p.id}">Details</button>
      </div>
    </article>`;
  }

  function viewList(track) {
    const items = visible(track);
    let hero = '';
    if (!track) {
      const o = overall();
      const nx = nextUp();
      const d = new Date();
      hero = `<section class="hero">
        <div class="hero-top">
          <div><h1>${greeting()}</h1><p>Everything you are building, in one place. Pick a project to launch or keep working on.</p></div>
          <div class="chips">
            <div class="info-chip"><span class="label">Now</span><b id="c-date">${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</b></div>
            <div class="info-chip hot"><span class="label">Time</span><b id="c-time">${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</b></div>
            <div class="info-chip"><span class="label">Weather</span><b id="c-weather">${esc(weather)}</b></div>
          </div>
        </div>
        <div class="note"><span class="tag">Next up</span>
          <span class="t">${nx ? `<b>${esc(nx.task)}</b> in ${esc(nx.p.name)}` : 'All caught up. Add a new project to keep going.'}</span>
          ${nx ? `<button class="icon-btn" data-act="open" data-id="${nx.p.id}" data-k="nx" aria-label="Open ${esc(nx.p.name)}">${svg('arrow')}</button>` : ''}
        </div>
      </section>`;
    }
    const title = track ? `${track} projects` : 'Projects';
    const sortOpts = SORTS.map(([v, l]) => `<option value="${v}"${S.settings.sort === v ? ' selected' : ''}>${l}</option>`).join('');
    const total = S.projects.filter((p) => !track || p.track === track).length;
    return `${hero}${track ? '' : toolGrid(null)}
      <div class="sec-head"><h2>${title}<small>${ui.q ? items.length + ' of ' + total : total}</small></h2>
        <div class="tools">
          <label class="search">${svg('search')}<input id="flt" class="in" placeholder="Filter  ( / )" value="${esc(ui.q)}" aria-label="Filter projects" autocomplete="off"></label>
          <select id="srt" class="in sel" aria-label="Sort projects">${sortOpts}</select>
          ${canEditProjects() ? `<button class="btn primary" data-act="new" data-k="new">${svg('plus')}New project</button>` : ''}
        </div></div>
      ${items.length ? `<div class="grid">${items.map(card).join('')}</div>`
        : `<div class="panel"><p class="help">${ui.q ? 'No projects match that filter.' : 'Nothing here yet. Add your first ' + (track || '') + ' project.'}</p></div>`}`;
  }

  function taskRow(t) {
    if (ui.editTask === t.id) {
      return `<li class="task editing"><input class="in" id="te" value="${esc(t.t)}" maxlength="160" aria-label="Edit task"></li>`;
    }
    return `<li class="task${t.d ? ' done' : ''}" draggable="true" data-tid="${t.id}">
        <span class="grip" aria-hidden="true">${svg('grip')}</span>
        <label><input type="checkbox" class="chk" data-act="toggle" data-id="${t.id}" data-k="t-${t.id}"${t.d ? ' checked' : ''}><span>${esc(t.t)}</span></label>
        <button class="x" data-act="edittask" data-id="${t.id}" data-k="e-${t.id}" aria-label="Edit task">${svg('pencil')}</button>
        <button class="x" data-act="deltask" data-id="${t.id}" data-k="x-${t.id}" aria-label="Remove task">${svg('x')}</button></li>`;
  }

  function viewProject() {
    const p = find(ui.id);
    if (!p) { ui.view = 'home'; return viewList(null); }
    const pr = progress(p);
    const status = STATUSES.map((s) => `<button data-act="status" data-v="${s}" data-k="st-${s}" class="${s === 'Blocked' ? 'blocked' : ''}" aria-pressed="${p.status === s}">${s}</button>`).join('');
    const isApp = p.launch.mode === 'app';
    const links = p.links.map((k) => `<li class="link"><button class="linkbtn" data-act="openlink" data-id="${k.id}" data-k="lk-${k.id}" title="${esc(k.url)}">${svg('external')}<span><b>${esc(k.label)}</b>${k.label === hostOf(k.url) ? '' : `<small>${esc(hostOf(k.url))}</small>`}</span></button>
        <button class="x on" data-act="dellink" data-id="${k.id}" data-k="dl-${k.id}" aria-label="Remove link">${svg('x')}</button></li>`).join('');
    const canEdit = canEditProjects();
    return `<button class="btn back" data-act="nav" data-v="${p.track}" data-k="back">${svg('back')}${p.track}</button>
    <section class="p-hero">
      <div class="tile">${svg(p.icon)}</div>
      <div class="p-title">
        <input class="name-in" id="f-name" data-bind="name" value="${esc(p.name)}" maxlength="60" aria-label="Project name" ${canEdit ? '' : 'readonly'}>
        <span class="p-sub">${p.track} &middot; ${pr.d} of ${pr.t} tasks done &middot; ${pr.pct}% synced</span>
      </div>
      <button class="icon-btn pin${p.pinned ? ' on' : ''}" data-act="pin" data-id="${p.id}" data-k="pin" aria-pressed="${p.pinned}" aria-label="${p.pinned ? 'Unpin' : 'Pin'}" title="${p.pinned ? 'Unpin' : 'Pin to top'}" ${canEdit ? '' : 'disabled'}>${svg('star')}</button>
      <div class="seg" role="group" aria-label="Status">${status}</div>
    </section>
    <div class="cols">
      <div class="col">
        <section class="panel">
          <h3>Tasks <small>${pr.d} of ${pr.t} done${pr.d && canEdit ? ' &middot; <button class="textbtn" data-act="cleardone" data-k="cleardone">Clear completed</button>' : ''}</small></h3>
          <div class="meter"><i style="--p:${pr.pct}%"></i></div>
          <ul class="tasks" id="tasks">${p.tasks.map(taskRow).join('') || '<li class="empty">No tasks yet. Add the first step below.</li>'}</ul>
          ${canEdit ? `<div class="row nowrap"><input class="in" id="nt" placeholder="Add a task" maxlength="160" value="${esc(drafts.nt || '')}" data-draft="nt" autocomplete="off">
            <button class="btn primary" data-act="addtask" data-k="addtask">${svg('plus')}Add</button></div>` : '<p class="help">Developer mode is required to add or edit tasks.</p>'}
          <p class="help">Drag the dots to reorder. Press the pencil to rename a task.</p>
        </section>
        <section class="panel">
          <h3>Notes</h3>
          <textarea class="ta" id="f-notes" data-bind="notes" placeholder="Links, ideas, things to remember" ${canEdit ? '' : 'readonly'}>${esc(p.notes)}</textarea>
        </section>
      </div>
      <div class="col">
        <section class="panel">
          <h3>Launch</h3>
          <div class="seg" role="group" aria-label="Launch mode">
            <button data-act="mode" data-v="app" data-k="m-app" aria-pressed="${isApp}" ${canEdit ? '' : 'disabled'}>Open app or file</button>
            <button data-act="mode" data-v="command" data-k="m-cmd" aria-pressed="${!isApp}" ${canEdit ? '' : 'disabled'}>Run command</button>
          </div>
          <div class="field"><span class="label">${isApp ? 'App or file' : 'Command'}</span>
            <div class="row nowrap" data-drop="target"><input class="in" id="f-target" data-bind="target" value="${esc(p.launch.target)}" placeholder="${isApp ? 'Pick or drop an .exe, shortcut or file' : 'npm run dev'}" spellcheck="false" ${canEdit ? '' : 'readonly'}>
              ${isApp && canEdit ? `<button class="btn" data-act="pick" data-v="file" data-k="pk-file">Browse</button>` : ''}</div></div>
          <div class="field"><span class="label">Project folder</span>
            <div class="row nowrap" data-drop="folder"><input class="in" id="f-folder" data-bind="folder" value="${esc(p.folder)}" placeholder="Pick or drop the folder this project lives in" spellcheck="false" ${canEdit ? '' : 'readonly'}>
              ${canEdit ? `<button class="btn" data-act="pick" data-v="folder" data-k="pk-folder">Browse</button>` : ''}</div></div>
          <div class="actions">
            <button class="btn primary" data-act="launch" data-id="${p.id}" data-k="launch">${svg('play')}Launch</button>
            <button class="btn" data-act="reveal" data-k="reveal">${svg('folder')}Open folder</button>
            <button class="btn" data-act="code" data-k="code">${svg('code')}VS Code</button>
          </div>
          <p class="help">${isApp ? 'Opens the app or file you picked.' : 'Runs in a new terminal window inside the project folder.'} You can drag a file or folder onto the fields above.</p>
        </section>
        <section class="panel">
          <h3>Links <small>${p.links.length}</small></h3>
          ${links ? `<ul class="links">${links}</ul>` : '<p class="help">Save your repo, docs or anything you keep reopening.</p>'}
          ${canEdit ? `<div class="row nowrap"><input class="in" id="lk-label" placeholder="Name (optional)" maxlength="60" value="${esc(drafts['lk-label'] || '')}" data-draft="lk-label" style="max-width:38%">
            <input class="in" id="lk-url" placeholder="github.com/you/project" maxlength="500" value="${esc(drafts['lk-url'] || '')}" data-draft="lk-url" spellcheck="false">
            <button class="btn" data-act="addlink" data-k="addlink">Add</button></div>` : '<p class="help">Developer mode is required to manage links.</p>'}
        </section>
        <section class="panel">
          <h3>Details</h3>
          <div class="field"><span class="label">Description</span>
            <textarea class="ta sm" id="f-desc" data-bind="desc" maxlength="200" placeholder="What is this project?" ${canEdit ? '' : 'readonly'}>${esc(p.desc)}</textarea></div>
          <div class="field"><span class="label">Track</span>
            <div class="seg" role="group" aria-label="Track">${TRACKS.map((t) => `<button data-act="track" data-v="${t}" data-k="tr-${t}" aria-pressed="${p.track === t}" ${canEdit ? '' : 'disabled'}>${t}</button>`).join('')}</div></div>
          <div class="field"><span class="label">Icon</span>
            <div class="icons">${PICKABLE.map((k) => `<button data-act="icon" data-v="${k}" data-k="ic-${k}" aria-pressed="${p.icon === k}" aria-label="${k}" ${canEdit ? '' : 'disabled'}>${svg(k)}</button>`).join('')}</div></div>
          ${canEdit ? `<div class="row"><button class="btn" data-act="dup" data-k="dup">Duplicate project</button>
            <button class="btn danger${ui.confirmDel ? ' armed' : ''}" data-act="del" data-k="del">${svg('trash')}${ui.confirmDel ? 'Confirm delete' : 'Delete project'}</button>
            ${ui.confirmDel ? '<button class="btn" data-act="cancel" data-k="cancel">Keep it</button>' : ''}</div>` : '<p class="help">Developer mode is required for project setup and cleanup.</p>'}
        </section>
      </div>
    </div>`;
  }

  function viewSettings() {
    const th = (id, label) => `<button class="theme-opt" data-act="theme" data-v="${id}" data-k="th-${id}" aria-pressed="${S.settings.theme === id}">
        <span class="swatch s-${id}"><i></i><i></i></span><b>${label}</b></button>`;
    const sw = (id, title, sub, on) => `<div class="switch-row"><div class="t"><b>${title}</b><span class="help">${sub}</span></div>
        <input type="checkbox" class="switch" id="${id}" data-act="${id}" ${on ? 'checked' : ''} aria-label="${title}"></div>`;
    const keys = [['Ctrl K', 'Search and jump anywhere'], ['Ctrl N', 'New project'], ['Ctrl 1 to 7', 'Home, Spotify, Roblox, Discord, Android, PC, Settings'], ['/', 'Filter the project list'], ['Esc', 'Close or go back']];
    const buildBadge = appMode === 'dev' ? 'Developer build' : 'Release build';
    return `<div class="sec-head"><h2>Settings</h2></div>
    <div class="set-grid">
      <section class="panel"><h3>Profile</h3>
        <div class="field"><label class="label">Detected PC name</label>
          <input class="in" value="${esc(S.settings.name || 'Detecting your PC name...')}" readonly aria-readonly="true"></div>
        <div class="field"><label class="label" for="s-hub">Hub name</label>
          <input class="in" id="s-hub" data-set="hubName" value="${esc(S.settings.hubName)}" maxlength="30"></div>
      </section>
      ${intPanel()}
      <section class="panel"><h3>Appearance</h3>
        <div class="themes">${th('dark', 'Midnight')}${th('rei', 'Rei light')}</div>
      </section>
      <section class="panel"><h3>System</h3>
        ${sw('login', 'Start with Windows', 'Open the hub when you sign in.', info.openAtLogin)}
        ${sw('tray', 'Keep running in the tray', 'Closing the window hides it instead of quitting.', S.settings.closeToTray)}
        ${sw('hotkey', 'Global shortcut', 'Press Ctrl+Alt+H anywhere to show or hide the hub.', S.settings.hotkey)}
      </section>
      <section class="panel"><h3>Keyboard shortcuts</h3>
        <ul class="keys">${keys.map(([k, t]) => `<li><kbd>${k}</kbd><span>${t}</span></li>`).join('')}</ul>
      </section>
      <section class="panel"><h3>Backup</h3>
        <p class="help">A copy of your data is saved automatically once a day, and the last 7 are kept. You can also save or restore a backup file yourself.</p>
        <div class="actions"><button class="btn" data-act="export" data-k="export">Export backup</button>
          <button class="btn" data-act="import" data-k="import">Import backup</button>
          <button class="btn" data-act="openbackups" data-k="openbackups">${svg('folder')}Automatic backups</button></div>
      </section>
      <section class="panel"><h3>About</h3>
        <p class="help">${esc(S.settings.hubName)} v${esc(info.version || '0.2.0')}</p>
        <span class="label">Build mode</span><span class="mono">${esc(buildBadge)}</span>
        <span class="label">Data file</span><span class="mono">${esc(info.dataFile || '')}</span>
      </section>
    </div>`;
  }

  function modal() {
    if (!ui.modal) return '';
    const tr = drafts.track || 'Android';
    const tpl = drafts.mtpl || (tr === 'PC' ? 'desktop' : 'android');
    return `<div class="scrim" data-act="scrim"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">
      <h2 id="m-title">New project</h2>
      <div class="field"><label class="label" for="m-name">Name</label>
        <input class="in" id="m-name" maxlength="60" placeholder="What are you building?" value="${esc(drafts.mname || '')}" data-draft="mname" autocomplete="off"></div>
      <div class="field"><label class="label" for="m-desc">Description</label>
        <input class="in" id="m-desc" maxlength="200" placeholder="Optional" value="${esc(drafts.mdesc || '')}" data-draft="mdesc" autocomplete="off"></div>
      <div class="field"><span class="label">Track</span>
        <div class="seg" role="group" aria-label="Track">${TRACKS.map((t) => `<button data-act="mtrack" data-v="${t}" data-k="mt-${t}" aria-pressed="${tr === t}">${t}</button>`).join('')}</div></div>
      <div class="field"><span class="label">Starter tasks</span>
        <div class="seg" role="group" aria-label="Starter tasks">${Object.keys(TEMPLATES).map((k) => `<button data-act="mtpl" data-v="${k}" data-k="mp-${k}" aria-pressed="${tpl === k}">${TEMPLATES[k].label}</button>`).join('')}</div></div>
      <div class="row" style="justify-content:flex-end"><button class="btn" data-act="mcancel" data-k="mcancel">Cancel</button>
        <button class="btn primary" data-act="madd" data-k="madd">Add project</button></div>
    </div></div>`;
  }

  function render() {
    const root = document.getElementById('app');
    const ae = document.activeElement;
    let key = null, ss = null, se = null;
    if (ae && ae !== document.body && root.contains(ae)) {
      key = ae.id ? '#' + ae.id : ae.dataset && ae.dataset.k ? `[data-k="${ae.dataset.k}"]` : null;
      try { ss = ae.selectionStart; se = ae.selectionEnd; } catch { /* not a text field */ }
    }
    const oldMain = root.querySelector('.main');
    const scroll = oldMain ? oldMain.scrollTop : 0;

    let body;
    if (ui.view === 'project') body = viewProject();
    else if (ui.view === 'settings') body = viewSettings();
    else if (['Spotify', 'Roblox', 'Discord'].includes(ui.view)) body = viewTools(ui.view);
    else if (ui.view === 'Android' || ui.view === 'PC') body = viewList(ui.view);
    else body = viewList(null);

    root.innerHTML = `<div class="app">${sidebar()}<main class="main" id="main">${body}</main></div>${modal()}`;

    const main = root.querySelector('.main');
    if (main) main.scrollTop = scroll;
    if (key) {
      let el = null;
      try { el = root.querySelector(key); } catch { /* ignore */ }
      if (el) {
        el.focus({ preventScroll: true });
        if (ss != null) { try { el.setSelectionRange(ss, se); } catch { /* ignore */ } }
      }
    }
  }

  function tick() {
    const d = new Date();
    const a = document.getElementById('c-date');
    const b = document.getElementById('c-time');
    if (a) a.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (b) b.textContent = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  /* ---------- command palette ---------- */
  function paletteItems() {
    const items = [];
    const nav = (label, view, icon) => items.push({ label, hint: 'Go to', icon, run: () => go(view) });
    nav('Home', 'home', 'home'); nav('Spotify', 'Spotify', 'headphones'); nav('Roblox', 'Roblox', 'package'); nav('Discord Status', 'Discord', 'chat'); nav('Android projects', 'Android', 'phone'); nav('PC projects', 'PC', 'monitor'); nav('Settings', 'settings', 'sliders');
    items.push({ label: 'New project', hint: 'Action', icon: 'plus', run: () => openNew() });
    items.push({ label: S.settings.theme === 'dark' ? 'Switch to Rei light theme' : 'Switch to Midnight theme', hint: 'Action', icon: 'theme',
      run: () => { S.settings.theme = S.settings.theme === 'dark' ? 'rei' : 'dark'; applyTheme(); touch(); render(); } });
    S.projects.forEach((p) => {
      items.push({ label: p.name, hint: `${p.track} · ${p.status}`, icon: p.icon, run: () => go('project', p.id) });
      if (p.launch.target) items.push({ label: 'Launch ' + p.name, hint: 'Launch', icon: 'play', run: () => { flush(); runLaunch(p); } });
    });
    const q = pal.q.trim().toLowerCase();
    if (!q) return items;
    const words = q.split(/\s+/);
    return items.filter((it) => { const hay = (it.label + ' ' + it.hint).toLowerCase(); return words.every((w) => hay.includes(w)); });
  }
  function paletteList() {
    const items = paletteItems();
    if (pal.sel >= items.length) pal.sel = Math.max(0, items.length - 1);
    const el = document.getElementById('pal-list');
    if (!el) return items;
    el.innerHTML = items.length
      ? items.map((it, i) => `<button class="pal-item${i === pal.sel ? ' on' : ''}" role="option" aria-selected="${i === pal.sel}" data-pal="run" data-i="${i}">${svg(it.icon)}<span>${esc(it.label)}</span><em>${esc(it.hint)}</em></button>`).join('')
      : '<div class="pal-empty">Nothing matches that.</div>';
    const on = el.querySelector('.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
    return items;
  }
  function openPalette() {
    pal.open = true; pal.q = ''; pal.sel = 0;
    const root = document.getElementById('palette');
    root.innerHTML = `<div class="scrim pal-scrim" data-pal="scrim"><div class="palette" role="dialog" aria-modal="true" aria-label="Search">
      <div class="pal-in">${svg('search')}<input id="pal-in" placeholder="Jump to a project or run a command" autocomplete="off" spellcheck="false" aria-label="Search"></div>
      <div id="pal-list" role="listbox"></div>
      <div class="pal-foot"><span><kbd>Up</kbd><kbd>Down</kbd> move</span><span><kbd>Enter</kbd> select</span><span><kbd>Esc</kbd> close</span></div></div></div>`;
    paletteList();
    document.getElementById('pal-in').focus();
  }
  function closePalette() {
    pal.open = false;
    document.getElementById('palette').innerHTML = '';
  }
  function paletteKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
    const n = paletteItems().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); pal.sel = n ? (pal.sel + 1) % n : 0; paletteList(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); pal.sel = n ? (pal.sel - 1 + n) % n : 0; paletteList(); }
    else if (e.key === 'Enter') { e.preventDefault(); runPalette(pal.sel); }
  }
  function runPalette(i) {
    const it = paletteItems()[i];
    closePalette();
    if (it) it.run();
  }
  document.getElementById('palette').addEventListener('click', (e) => {
    const t = e.target.closest('[data-pal]');
    if (!t) return;
    if (t.dataset.pal === 'scrim') { if (e.target === t) closePalette(); }
    else if (t.dataset.pal === 'run') runPalette(+t.dataset.i);
  });
  document.getElementById('palette').addEventListener('input', (e) => {
    if (e.target.id === 'pal-in') { pal.q = e.target.value; pal.sel = 0; paletteList(); }
  });

  /* ---------- actions ---------- */
  function go(view, id) {
      updateDiscordActivity();
    ui.view = view; ui.id = id || null; ui.confirmDel = false; ui.editTask = null;
    if (view !== 'project' && !(view === 'Android' || view === 'PC' || view === 'home')) ui.q = '';
    if (view === 'project') {
      const p = find(id);
      if (p) { p.opened = Date.now(); touch(); }
    }
    render();
    const main = document.getElementById('main');
    if (main) main.scrollTop = 0;
  }

  function openNew() {
    if (!gateProjectEditor('Developer mode is required to create projects.')) return;
    ui.modal = true;
    drafts.track = ui.view === 'PC' ? 'PC' : 'Android';
    delete drafts.mtpl;
    render();
    const el = document.getElementById('m-name'); if (el) el.focus();
  }

  function addTask() {
    if (!gateProjectEditor('Developer mode is required to add tasks.')) return;
    const p = find(ui.id); if (!p) return;
    const el = document.getElementById('nt');
    const v = clip(el && el.value, 160);
    if (!v) { if (el) el.focus(); return; }
    p.tasks.push({ id: uid(), t: v, d: false });
    drafts.nt = '';
    touch(); render();
    const again = document.getElementById('nt'); if (again) again.focus();
  }

  function addLink() {
    if (!gateProjectEditor('Developer mode is required to manage links.')) return;
    const p = find(ui.id); if (!p) return;
    const url = cleanUrl(document.getElementById('lk-url').value);
    if (!url) { toast('Enter a valid web address.', 'err'); document.getElementById('lk-url').focus(); return; }
    const label = clip(document.getElementById('lk-label').value, 60) || hostOf(url);
    p.links.push({ id: uid(), label, url });
    drafts['lk-label'] = ''; drafts['lk-url'] = '';
    touch(); render();
    const again = document.getElementById('lk-url'); if (again) again.focus();
  }

  function commitEdit() {
    if (!gateProjectEditor('Developer mode is required to edit tasks.')) return;
    const id = ui.editTask;
    if (!id) return;
    const p = find(ui.id); const t = p && p.tasks.find((x) => x.id === id);
    const el = document.getElementById('te');
    const v = clip(el && el.value, 160);
    ui.editTask = null;
    if (t && v && v !== t.t) { t.t = v; touch(); }
    render();
  }

  function addProject() {
    if (!gateProjectEditor('Developer mode is required to add projects.')) return;
    const name = clip(drafts.mname, 60);
    if (!name) { const el = document.getElementById('m-name'); if (el) el.focus(); return; }
    const track = drafts.track || 'Android';
    const tpl = TEMPLATES[drafts.mtpl || (track === 'PC' ? 'desktop' : 'android')] || TEMPLATES.blank;
    const p = normProject({
      name, desc: drafts.mdesc, track,
      icon: track === 'PC' ? 'monitor' : 'phone',
      tasks: ['Add it to the hub'].concat(tpl.tasks).map((t, i) => ({ id: uid(), t, d: i === 0 }))
    });
    S.projects.push(p);
    drafts.mname = ''; drafts.mdesc = ''; ui.modal = false;
    touch(); go('project', p.id);
  }

  async function runLaunch(p) {
    const r = await API.launch({ mode: p.launch.mode, target: p.launch.target, cwd: p.folder });
    if (r && r.ok) { p.opened = Date.now(); touch(); toast(`Launched ${p.name}`, 'ok'); }
    else toast((r && r.error) || 'Could not launch.', 'err');
  }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'scrim') { if (e.target === t) { ui.modal = false; render(); } return; }
    const p = ui.id ? find(ui.id) : null;

    switch (act) {
      case 'nav': go(t.dataset.v); break;
      case 'open': go('project', t.dataset.id); break;
      case 'palette': openPalette(); break;
      case 'pin': { if (!gateProjectEditor('Developer mode is required to pin or reorder projects.')) return; const pp = find(t.dataset.id); if (pp) { pp.pinned = !pp.pinned; touch(); render(); } } break;
      case 'launch': { const lp = find(t.dataset.id || ui.id); if (lp) { await flush(); runLaunch(lp); } } break;
      case 'reveal': if (p) { const r = await API.reveal(p.folder); if (!r.ok) toast(r.error, 'err'); } break;
      case 'code': if (p) { const r = await API.openCode(p.folder); if (!r.ok) toast(r.error, 'err'); } break;
      case 'status': if (!gateProjectEditor('Developer mode is required to edit project status.')) return; if (p) { p.status = t.dataset.v; touch(); render(); } break;
      case 'track': if (!gateProjectEditor('Developer mode is required to change the project track.')) return; if (p) { p.track = t.dataset.v; touch(); render(); } break;
      case 'icon': if (!gateProjectEditor('Developer mode is required to change the project icon.')) return; if (p) { p.icon = t.dataset.v; touch(); render(); } break;
      case 'mode': if (!gateProjectEditor('Developer mode is required to edit launch setup.')) return; if (p) { p.launch.mode = t.dataset.v; touch(); render(); } break;
      case 'edittask': if (!gateProjectEditor('Developer mode is required to edit tasks.')) return; ui.editTask = t.dataset.id; render(); { const el = document.getElementById('te'); if (el) { el.focus(); el.select(); } } break;
      case 'deltask': if (!gateProjectEditor('Developer mode is required to remove tasks.')) return; if (p) {
        const i = p.tasks.findIndex((x) => x.id === t.dataset.id);
        if (i >= 0) {
          const [gone] = p.tasks.splice(i, 1);
          touch(); render();
          toast('Task removed.', '', { label: 'Undo', fn: () => { p.tasks.splice(Math.min(i, p.tasks.length), 0, gone); touch(); render(); } });
        }
      } break;
      case 'cleardone': if (!gateProjectEditor('Developer mode is required to clear tasks.')) return; if (p) {
        const before = p.tasks.slice();
        p.tasks = p.tasks.filter((x) => !x.d);
        touch(); render();
        toast(`Cleared ${before.length - p.tasks.length} completed.`, '', { label: 'Undo', fn: () => { p.tasks = before; touch(); render(); } });
      } break;
      case 'addtask': addTask(); break;
      case 'addlink': addLink(); break;
      case 'openlink': if (p) { const k = p.links.find((x) => x.id === t.dataset.id); if (k) { const r = await API.openUrl(k.url); if (r && !r.ok) toast(r.error, 'err'); } } break;
      case 'dellink': if (!gateProjectEditor('Developer mode is required to remove links.')) return; if (p) { p.links = p.links.filter((x) => x.id !== t.dataset.id); touch(); render(); } break;
      case 'pick': if (!gateProjectEditor('Developer mode is required to edit the project setup.')) return; if (p) {
        const path = await API.pick(t.dataset.v);
        if (path) { if (t.dataset.v === 'folder') p.folder = path; else p.launch.target = path; touch(); render(); }
      } break;
      case 'dup': if (!gateProjectEditor('Developer mode is required to duplicate projects.')) return; if (p) {
        const copy = normProject({ ...JSON.parse(JSON.stringify(p)), id: uid(), name: clip(p.name + ' copy', 60), pinned: false, opened: 0, created: Date.now(),
          tasks: p.tasks.map((x) => ({ ...x, id: uid() })), links: p.links.map((x) => ({ ...x, id: uid() })) });
        S.projects.push(copy); touch(); go('project', copy.id); toast('Project duplicated.', 'ok');
      } break;
      case 'del': if (!gateProjectEditor('Developer mode is required to delete projects.')) return; if (p) {
        if (ui.confirmDel) {
          const idx = S.projects.indexOf(p);
          S.projects.splice(idx, 1); touch(); go('home');
          toast(`Deleted ${p.name}.`, '', { label: 'Undo', fn: () => { S.projects.splice(Math.min(idx, S.projects.length), 0, p); touch(); go('project', p.id); } });
        } else { ui.confirmDel = true; render(); }
      } break;
      case 'cancel': ui.confirmDel = false; render(); break;
      case 'new': openNew(); break;
      case 'mtrack': drafts.track = t.dataset.v; render(); break;
      case 'mtpl': drafts.mtpl = t.dataset.v; render(); break;
      case 'madd': addProject(); break;
      case 'mcancel': ui.modal = false; render(); break;
      case 'tool': await runTool(t.dataset.id); break;
      case 'rpclink': await connectRpc(); break;
      case 'rpcout': await API.rpcDisconnect(); rpcUser = null; render(); break;
      case 'welcome-continue': S.settings.welcomeSeen = true; touch(); document.getElementById('splash').classList.add('hidden'); break;
      case 'welcome-settings': S.settings.welcomeSeen = true; touch(); document.getElementById('splash').classList.add('hidden'); go('settings'); break;
      case 'welcome-discord': {
        const id = S.settings.rpcMode === 'dev' ? S.settings.rpcDev : S.settings.rpcRelease;
        if (!id) {
          S.settings.welcomeSeen = true; touch();
          document.getElementById('splash').classList.add('hidden');
          go('settings');
          toast('Add a Discord application ID in Settings, then connect from the sidebar.', 'err');
          break;
        }
        await connectRpc();
        if (rpcUser) { S.settings.welcomeSeen = true; touch(); document.getElementById('splash').classList.add('hidden'); }
      } break;
      case 'rpcmode': S.settings.rpcMode = t.dataset.v; touch(); if (rpcUser) connectRpc(); else render(); break;
      case 'setpick': { const pth = await API.pick(t.dataset.v); if (pth) { S.settings[t.dataset.f] = pth; touch(); render(); } } break;
      case 'ut': { const r = await API.saveUserscript(); if (r.ok) toast('Userscript saved.', 'ok'); else if (!r.canceled) toast(r.error || 'Could not save it.', 'err'); } break;
      case 'theme': S.settings.theme = t.dataset.v; applyTheme(); touch(); render(); break;
      case 'openbackups': { const r = await API.openBackups(); if (!r.ok) toast(r.error, 'err'); } break;
      case 'export': {
        const r = await API.exportData(JSON.stringify(S, null, 2));
        if (r.ok) toast('Backup saved.', 'ok'); else if (!r.canceled) toast(r.error || 'Could not save the backup.', 'err');
      } break;
      case 'import': {
        const r = await API.importData();
        if (r.ok) {
          const n = normalize(r.data);
          if (!n) { toast('That file is not a YuniHub backup.', 'err'); break; }
          S = n; applyTheme(); touch(); go('home'); toast('Backup restored.', 'ok');
        } else if (!r.canceled) toast(r.error || 'Could not import that file.', 'err');
      } break;
      default: break;
    }
  });

  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (!t) return;
    if (t.id === 'te') { commitEdit(); return; }
    if (t.id === 'srt') { S.settings.sort = t.value; touch(); render(); return; }
    if (t.dataset && t.dataset.act === 'toggle') {
      if (!gateProjectEditor('Developer mode is required to complete tasks.')) { t.checked = !t.checked; return; }
      const p = find(ui.id); const task = p && p.tasks.find((x) => x.id === t.dataset.id);
      if (task) { task.d = t.checked; touch(); render(); }
    } else if (t.dataset && t.dataset.act === 'login') {
      info.openAtLogin = !!(await API.setLogin(t.checked));
      render();
    } else if (t.dataset && (t.dataset.act === 'tray' || t.dataset.act === 'hotkey')) {
      if (t.dataset.act === 'tray') S.settings.closeToTray = t.checked; else S.settings.hotkey = t.checked;
      const r = await API.setPrefs({ closeToTray: S.settings.closeToTray, hotkey: S.settings.hotkey });
      if (S.settings.hotkey && r && r.hotkeyOk === false) {
        S.settings.hotkey = false;
        toast('Another app is already using Ctrl+Alt+H.', 'err');
      }
      touch(); render();
    } else if (t.dataset && t.dataset.set) {
      const k = t.dataset.set;
      S.settings[k] = clip(t.value, { name: 40, hubName: 30 }[k] || 500) || (k === 'hubName' ? 'YuniHub' : '');
      if (k === 'city') refreshWeather();
      touch(); render();
    }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t) return;
    if (t.id === 'flt') { ui.q = t.value; render(); return; }
    if (!t.dataset) return;
    if (t.dataset.bind) {
      if (!gateProjectEditor('Developer mode is required to edit project details.')) return;
      const p = find(ui.id); if (!p) return;
      const f = t.dataset.bind;
      if (f === 'target') p.launch.target = clip(t.value, 500);
      else if (f === 'name') p.name = clip(t.value, 60) || 'Untitled';
      else if (f === 'folder') p.folder = clip(t.value, 500);
      else if (f === 'desc') p.desc = clip(t.value, 200);
      else if (f === 'notes') p.notes = t.value.slice(0, 20000);
      touch();
    } else if (t.dataset.draft) {
      drafts[t.dataset.draft] = t.value;
    }
  });

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = (e.key || '').toLowerCase();
    const tag = e.target && e.target.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (mod && key === 'k') { e.preventDefault(); if (pal.open) closePalette(); else openPalette(); return; }
    if (pal.open) { paletteKey(e); return; }

    if (mod && key === 'n') { e.preventDefault(); if (!ui.modal) openNew(); return; }
    if (mod && ['1', '2', '3', '4', '5', '6', '7'].includes(key)) {
      e.preventDefault();
      go(['home', 'Spotify', 'Roblox', 'Discord', 'Android', 'PC', 'settings'][+key - 1]);
      return;
    }
    if (e.key === 'Escape') {
      if (ui.modal) { ui.modal = false; render(); }
      else if (ui.editTask) { ui.editTask = null; render(); }
      else if (e.target && e.target.id === 'flt' && ui.q) { ui.q = ''; render(); }
      else if (ui.view === 'project' && !typing) go(find(ui.id) ? find(ui.id).track : 'home');
      return;
    }
    if (e.key === '/' && !typing && (ui.view === 'home' || ui.view === 'Android' || ui.view === 'PC')) {
      const el = document.getElementById('flt');
      if (el) { e.preventDefault(); el.focus(); }
      return;
    }
    if (e.key !== 'Enter') return;
    const id = e.target && e.target.id;
    if (id === 'nt') { e.preventDefault(); addTask(); }
    else if (id === 'te') { e.preventDefault(); commitEdit(); }
    else if (id === 'lk-url' || id === 'lk-label') { e.preventDefault(); addLink(); }
    else if (id === 'm-name' || id === 'm-desc') { e.preventDefault(); addProject(); }
  });

  /* ---------- drag and drop: reorder tasks, drop files onto the launch fields ---------- */
  let dragTask = null;
  let dropZone = null;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  const setZone = (z) => {
    if (z === dropZone) return;
    if (dropZone) dropZone.classList.remove('drop-on');
    dropZone = z;
    if (z) z.classList.add('drop-on');
  };
  const clearOver = () => document.querySelectorAll('.task.over-top,.task.over-bottom').forEach((n) => n.classList.remove('over-top', 'over-bottom'));

  document.addEventListener('dragstart', (e) => {
    const li = e.target.closest && e.target.closest('.task[data-tid]');
    if (!li) return;
    if (!gateProjectEditor('Developer mode is required to reorder tasks.')) {
      e.preventDefault();
      return;
    }
    dragTask = li.dataset.tid;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragTask); } catch { /* ignore */ }
    li.classList.add('dragging');
  });
  document.addEventListener('dragend', () => {
    dragTask = null; clearOver(); setZone(null);
    document.querySelectorAll('.task.dragging').forEach((n) => n.classList.remove('dragging'));
  });
  document.addEventListener('dragover', (e) => {
    if (hasFiles(e)) {
      e.preventDefault(); // stops the window from trying to open the dropped file
      setZone(e.target.closest ? e.target.closest('[data-drop]') : null);
      return;
    }
    if (!dragTask) return;
    const li = e.target.closest && e.target.closest('.task[data-tid]');
    if (!li || li.dataset.tid === dragTask) return;
    e.preventDefault();
    clearOver();
    const r = li.getBoundingClientRect();
    li.classList.add(e.clientY < r.top + r.height / 2 ? 'over-top' : 'over-bottom');
  });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) setZone(null); });
  document.addEventListener('drop', async (e) => {
    if (hasFiles(e)) {
      if (!gateProjectEditor('Developer mode is required to edit the project setup.')) { e.preventDefault(); return; }
      e.preventDefault();
      const zone = e.target.closest ? e.target.closest('[data-drop]') : null;
      setZone(null);
      const p = ui.view === 'project' ? find(ui.id) : null;
      if (!zone || !p) return;
      const file = e.dataTransfer.files[0];
      const path = file && API.pathFor ? API.pathFor(file) : '';
      if (!path) { toast('Drag and drop works in the desktop app.', 'err'); return; }
      if (zone.dataset.drop === 'folder') p.folder = await API.dirOf(path);
      else {
        p.launch.target = path; p.launch.mode = 'app';
        if (!p.folder) p.folder = await API.dirOf(path);
      }
      touch(); render();
      return;
    }
    if (!dragTask) return;
    const li = e.target.closest && e.target.closest('.task[data-tid]');
    const p = find(ui.id);
    if (!li || !p) return;
    e.preventDefault();
    const from = p.tasks.findIndex((x) => x.id === dragTask);
    let to = p.tasks.findIndex((x) => x.id === li.dataset.tid);
    const r = li.getBoundingClientRect();
    if (e.clientY >= r.top + r.height / 2) to += 1;
    if (from < 0 || to < 0) return;
    const [moved] = p.tasks.splice(from, 1);
    p.tasks.splice(to > from ? to - 1 : to, 0, moved);
    dragTask = null;
    touch(); render();
  });

  /* ---------- boot ---------- */
  (async function boot() {
    if (window.hub) document.documentElement.classList.add('frame');
    let firstRun = true;
    try {
      const [saved, i] = await Promise.all([API.load(), API.info()]);
      const n = normalize(saved);
      if (n) { S = n; firstRun = false; }
      if (i) {
        info = i;
        appMode = info.buildMode || appMode;
      }
    } catch { /* keep the starter projects */ }
    if (info.userName && (!S.settings.name || S.settings.name === 'User')) S.settings.name = info.userName;
    if (!S.settings.city && info.weatherCity) S.settings.city = info.weatherCity;
    if (!S.settings.hubName) S.settings.hubName = 'YuniHub';
    applyTheme();
    render();
    const splash = document.getElementById('splash');
    if (splash && !S.settings.welcomeSeen) {
      const hasDiscordApp = !!(S.settings.rpcMode === 'dev' ? S.settings.rpcDev : S.settings.rpcRelease);
      splash.classList.add('welcome');
      splash.innerHTML = `<div class="splash-glow"></div><section class="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <div class="welcome-mark">Y</div><span class="splash-kicker">Your workspace starts here</span>
        <h1 id="welcome-title">Welcome to YuniHub</h1>
        <p class="welcome-intro">Keep your projects, next steps, and launch shortcuts together. You can connect Discord now or do it later.</p>
        <div class="welcome-benefits"><div><b>Project presence</b><span>Show the project you are working on in your Discord profile.</span></div>
          <div><b>Media status</b><span>Optionally share YouTube or Twitch activity with your Discord presence.</span></div>
          <div><b>Your choice</b><span>Discord desktop is required. YuniHub does not ask for your Discord password.</span></div></div>
        <div class="welcome-actions"><button class="btn primary" data-act="${hasDiscordApp ? 'welcome-discord' : 'welcome-settings'}">${hasDiscordApp ? 'Connect Discord' : 'Set up Discord'}</button>
          <button class="textbtn" data-act="welcome-continue">Continue without Discord</button></div>
        <p class="welcome-note">Activity can be visible to friends according to your Discord privacy settings. This is a desktop Rich Presence connection, not Discord account sign-in.</p>
      </section>`;
    } else if (splash) {
      setTimeout(() => splash.classList.add('hidden'), 320);
    }
    if (firstRun) { dirty = true; flush(); } // write the starter projects once so the file exists
    API.setBeacons(S.settings.beacons);
    refreshWeather();
    setInterval(tick, 15000);
    setInterval(refreshWeather, 20 * 60 * 1000);
  })();
})();
