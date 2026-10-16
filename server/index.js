'use strict';

const http = require('node:http');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const TICKET_TTL_MS = 60_000;
const STATE_TTL_SECONDS = 300;
const pendingTickets = new Map();
const activeSessions = new Map();

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(JSON.stringify(data));
}

function sendErrorPage(res, status, message) {
  const safeMessage = String(message).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff'
  });
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>YuniHub Discord connection</title><body><h1>Discord connection failed</h1><p>${safeMessage}</p><p>You can close this page and return to YuniHub.</p></body></html>`);
}

function getConfig() {
  const config = {
    clientId: (process.env.DISCORD_CLIENT_ID || '').trim(),
    clientSecret: (process.env.DISCORD_CLIENT_SECRET || '').trim(),
    redirectUri: (process.env.DISCORD_REDIRECT_URI || '').trim(),
    stateSecret: (process.env.OAUTH_STATE_SECRET || '').trim(),
    appRedirectUri: (process.env.YUNIHUB_REDIRECT_URI || 'yunihub://discord-auth').trim()
  };
  const missing = Object.entries(config)
    .filter(([key, value]) => key !== 'appRedirectUri' && !value)
    .map(([key]) => key);
  if (missing.length) throw new Error(`Missing Railway variables: ${missing.join(', ')}`);
  if (config.stateSecret.length < 32) throw new Error('OAUTH_STATE_SECRET must contain at least 32 characters.');

  let appUri;
  try {
    appUri = new URL(config.appRedirectUri);
  } catch {
    throw new Error('YUNIHUB_REDIRECT_URI is not a valid URL.');
  }
  if (appUri.protocol !== 'yunihub:' || appUri.hostname !== 'discord-auth') {
    throw new Error('YUNIHUB_REDIRECT_URI must use the yunihub://discord-auth scheme.');
  }
  return { ...config, appUri };
}

function stateSignature(state, secret) {
  return crypto.createHmac('sha256', secret).update(state).digest('hex');
}

function equalHex(left, right) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function cookieValue(req, name) {
  const cookies = (req.headers.cookie || '').split(';');
  for (const part of cookies) {
    const split = part.trim().indexOf('=');
    if (split < 0) continue;
    if (part.slice(0, split) === name) return decodeURIComponent(part.slice(split + 1));
  }
  return '';
}

function stateCookie(state, secret) {
  const value = `${state}.${stateSignature(state, secret)}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `yh_oauth_state=${value}; HttpOnly; SameSite=Lax; Path=/auth/discord/callback; Max-Age=${STATE_TTL_SECONDS}${secure}`;
}

function clearStateCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `yh_oauth_state=; HttpOnly; SameSite=Lax; Path=/auth/discord/callback; Max-Age=0${secure}`;
}

async function readJson(req, maxBytes = 4096) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    const error = new Error('Expected application/json.');
    error.status = 415;
    throw error;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('Request body is too large.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Invalid JSON.');
    error.status = 400;
    throw error;
  }
}

function cleanTickets() {
  const now = Date.now();
  for (const [ticket, record] of pendingTickets) {
    if (record.expiresAt <= now) pendingTickets.delete(ticket);
  }
}

function cleanSessions() {
  const now = Date.now();
  for (const [sessionToken, record] of activeSessions) {
    if (!record || record.expiresAt <= now) activeSessions.delete(sessionToken);
  }
}

async function refreshDiscordAccessToken(record) {
  const config = getConfig();
  const refreshResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', 'user-agent': DISCORD_UA },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: record.refreshToken
    })
  });

  const refreshed = await refreshResponse.json().catch(() => ({}));
  if (!refreshResponse.ok || !refreshed.access_token) {
    throw new Error('Discord session expired. Please link your account again.');
  }

  record.accessToken = refreshed.access_token;
  record.refreshToken = refreshed.refresh_token || record.refreshToken;
  record.expiresAt = Date.now() + (Number(refreshed.expires_in) || 604800) * 1000;
  return record;
}

async function getFreshDiscordUser(record) {
  const accessToken = record.accessToken;
  const profileResponse = await fetch('https://discord.com/api/users/@me', {
    headers: { authorization: `Bearer ${accessToken}` }
  });

  if (!profileResponse.ok) {
    if (record.refreshToken) {
      await refreshDiscordAccessToken(record);
      const refreshedProfile = await fetch('https://discord.com/api/users/@me', {
        headers: { authorization: `Bearer ${record.accessToken}` }
      });
      const refreshedData = await refreshedProfile.json();
      if (!refreshedProfile.ok || !refreshedData.id) throw new Error('Discord profile could not be refreshed.');
      return refreshedData;
    }
    throw new Error('Discord profile lookup failed.');
  }

  const profileData = await profileResponse.json();
  if (!profileData.id) throw new Error('Discord profile lookup failed.');
  return profileData;
}

async function startDiscordAuth(res) {
  const config = getConfig();
  const state = crypto.randomBytes(32).toString('hex');
  const authorize = new URL('https://discord.com/oauth2/authorize');
  authorize.searchParams.set('client_id', config.clientId);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', config.redirectUri);
  authorize.searchParams.set('scope', 'identify');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('prompt', 'consent');
  res.writeHead(302, {
    location: authorize.toString(),
    'set-cookie': stateCookie(state, config.stateSecret),
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer'
  });
  res.end();
}

const DISCORD_UA = 'DiscordBot (https://yunihub-production.up.railway.app, 1.0)';

async function finishDiscordAuth(req, res, requestUrl) {
  const config = getConfig();
  const clearCookie = clearStateCookie();
  const returnedState = requestUrl.searchParams.get('state') || '';
  const cookie = cookieValue(req, 'yh_oauth_state');
  const [expectedState, signature] = cookie.split('.');
  const validState = expectedState && returnedState === expectedState &&
    equalHex(signature || '', stateSignature(expectedState, config.stateSecret));
  if (!validState) {
    res.setHeader('set-cookie', clearCookie);
    sendErrorPage(res, 400, 'The sign-in request expired or could not be verified. Start again from YuniHub.');
    return;
  }

  const oauthError = requestUrl.searchParams.get('error');
  if (oauthError) {
    const redirect = new URL(config.appUri);
    redirect.searchParams.set('error', 'discord_consent_denied');
    res.writeHead(302, { location: redirect.toString(), 'set-cookie': clearCookie, 'cache-control': 'no-store' });
    res.end();
    return;
  }

  const code = requestUrl.searchParams.get('code');
  if (!code) {
    res.setHeader('set-cookie', clearCookie);
    sendErrorPage(res, 400, 'Discord did not return an authorization code. Start again from YuniHub.');
    return;
  }

  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri
    })
  });
  const tokenText = await tokenResponse.text();
  let tokenData = {};
  try { tokenData = JSON.parse(tokenText); } catch {}
  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error('[discord token exchange failed]', tokenResponse.status, tokenText.slice(0, 300), '| redirect_uri sent:', JSON.stringify(config.redirectUri), '| client_id:', config.clientId, '| secret_length:', config.clientSecret.length);
    res.setHeader('set-cookie', clearCookie);
    sendErrorPage(res, 502, 'Discord could not complete sign-in. Please try again.');
    return;
  }

  const profileResponse = await fetch('https://discord.com/api/users/@me', {
    headers: { authorization: `Bearer ${tokenData.access_token}`, accept: 'application/json', 'user-agent': DISCORD_UA }
  });
  const profileData = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok || !profileData.id) {
    res.setHeader('set-cookie', clearCookie);
    sendErrorPage(res, 502, 'YuniHub could not read your Discord profile. Please try again.');
    return;
  }

  cleanTickets();
  const ticket = crypto.randomBytes(32).toString('hex');
  const profile = {
    id: profileData.id,
    username: profileData.username,
    global_name: profileData.global_name || profileData.username,
    avatar: profileData.avatar || null
  };
  const sessionToken = crypto.randomBytes(32).toString('hex');
  activeSessions.set(sessionToken, {
    userId: profileData.id,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || '',
    expiresAt: Date.now() + (Number(tokenData.expires_in) || 604800) * 1000,
    profile
  });
  pendingTickets.set(ticket, {
    expiresAt: Date.now() + TICKET_TTL_MS,
    profile,
    sessionToken
  });

  const redirect = new URL(config.appUri);
  redirect.searchParams.set('ticket', ticket);
  res.writeHead(302, { location: redirect.toString(), 'set-cookie': clearCookie, 'cache-control': 'no-store' });
  res.end();
}

async function exchangeTicket(req, res) {
  const body = await readJson(req);
  const ticket = typeof body.ticket === 'string' ? body.ticket : '';
  if (!/^[a-f0-9]{64}$/i.test(ticket)) {
    sendJson(res, 400, { error: 'Invalid or expired sign-in ticket.' });
    return;
  }
  cleanTickets();
  const record = pendingTickets.get(ticket);
  if (!record || record.expiresAt <= Date.now()) {
    pendingTickets.delete(ticket);
    sendJson(res, 401, { error: 'Invalid or expired sign-in ticket.' });
    return;
  }
  pendingTickets.delete(ticket);
  const sessionRecord = activeSessions.get(record.sessionToken);
  sendJson(res, 200, { user: record.profile, sessionToken: record.sessionToken, session: !!sessionRecord });
}

async function refreshDiscordSession(req, res) {
  const body = await readJson(req);
  const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken : '';
  if (!sessionToken) {
    sendJson(res, 400, { error: 'Discord session token is required.' });
    return;
  }
  cleanSessions();
  const record = activeSessions.get(sessionToken);
  if (!record) {
    sendJson(res, 401, { error: 'Discord session expired. Please link your account again.' });
    return;
  }

  try {
    if (!record.refreshToken && record.expiresAt <= Date.now()) {
      throw new Error('Discord session expired. Please link your account again.');
    }
    if (record.expiresAt <= Date.now() + 60_000 && record.refreshToken) {
      await refreshDiscordAccessToken(record);
    }
    const userData = await getFreshDiscordUser(record);
    record.profile = {
      id: userData.id,
      username: userData.username,
      global_name: userData.global_name || userData.username,
      avatar: userData.avatar || null
    };
    sendJson(res, 200, { user: record.profile });
  } catch (error) {
    activeSessions.delete(sessionToken);
    sendJson(res, 401, { error: error.message || 'Discord session expired. Please link your account again.' });
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('x-frame-options', 'DENY');
  const requestUrl = new URL(req.url, 'http://localhost');

  try {
    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'yunihub-auth' });
    } else if (req.method === 'GET' && requestUrl.pathname === '/auth/discord') {
      await startDiscordAuth(res);
    } else if (req.method === 'GET' && requestUrl.pathname === '/auth/discord/callback') {
      await finishDiscordAuth(req, res, requestUrl);
    } else if (req.method === 'POST' && requestUrl.pathname === '/auth/discord/exchange') {
      await exchangeTicket(req, res);
    } else if (req.method === 'POST' && requestUrl.pathname === '/auth/discord/session') {
      await refreshDiscordSession(req, res);
    } else {
      sendJson(res, 404, { error: 'Not found.' });
    }
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    if (requestUrl.pathname.startsWith('/auth/discord/callback')) {
      sendErrorPage(res, 500, 'YuniHub could not complete Discord sign-in. Check the server configuration and try again.');
    } else {
      sendJson(res, error.status || 503, { error: error.status ? error.message : 'Discord sign-in is not configured on this server.' });
    }
  }
});

server.requestTimeout = 10_000;
server.headersTimeout = 12_000;
server.keepAliveTimeout = 5_000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`YuniHub auth service listening on port ${PORT}`);
});