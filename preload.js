'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

// The renderer only ever sees this small, fixed API. No Node access leaks through.
contextBridge.exposeInMainWorld('hub', {
  load: () => call('store:load'),
  save: (data) => call('store:save', data),
  pick: (kind) => call('dialog:pick', kind),
  launch: (opts) => call('project:launch', opts),
  reveal: (folder) => call('project:reveal', folder),
  openCode: (folder) => call('project:code', folder),
  openUrl: (url) => call('app:openUrl', url),
  info: () => call('app:info'),
  getMode: () => call('app:info').then((d) => d && d.buildMode ? d.buildMode : 'release'),
  setLogin: (on) => call('app:setLogin', on),
  setPrefs: (prefs) => call('app:setPrefs', prefs),
  setTheme: (theme) => call('app:setTheme', theme),
  openBackups: () => call('app:openBackups'),
  exportData: (json) => call('data:export', json),
  importData: () => call('data:import'),
  dirOf: (p) => call('path:dir', p),
  weather: (city) => call('tool:weather', city),
  autoload: (src, dest) => call('tool:autoload', src, dest),
  discordAuth: () => call('app:discordAuth'),
  discordExchange: (ticket) => call('app:discordExchange', ticket),
  discordSession: (sessionToken) => call('app:discordSession', sessionToken),
  onDiscordAuth: (cb) => ipcRenderer.on('discord:auth-result', (_event, payload) => cb(payload)),
  rpcConnect: (id) => call('rpc:connect', id),
  rpcDisconnect: () => call('rpc:disconnect'),
  setActivity: (activity) => call('rpc:activity', activity),
  setBeacons: (b) => call('beacon:set', b),
  saveUserscript: () => call('beacon:script'),
  // Turns a dropped File into its real path (File.path was removed in newer Electron).
  pathFor: (file) => {
    try { return webUtils.getPathForFile(file) || ''; } catch { return ''; }
  }
});
