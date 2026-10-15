# YuniHub Discord Auth Service

A small Node.js service intended to run as its own Railway service. It handles Discord OAuth without putting the Discord client secret in the Electron app.

## Deploy to Railway

1. Create a Railway service from this repository.
2. Set the service **Root Directory** to `/server`.
3. Railway detects `server/railway.json`; the service starts with `npm start` and checks `/health`.
4. Add the environment variables below in Railway. Do not commit or share the real client secret.
5. Copy the public Railway domain and use it in `DISCORD_REDIRECT_URI` and in the Discord Developer Portal OAuth2 Redirects list.

Required Railway variables:

- `DISCORD_CLIENT_ID`: OAuth2 client ID from the Discord application.
- `DISCORD_CLIENT_SECRET`: OAuth2 client secret; keep this only in Railway variables.
- `DISCORD_REDIRECT_URI`: exact callback URL, for example `https://your-service.up.railway.app/auth/discord/callback`.
- `OAUTH_STATE_SECRET`: random secret of at least 32 characters. Generate one locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
- `YUNIHUB_REDIRECT_URI`: `yunihub://discord-auth` unless the desktop protocol is changed in the Electron app.
- `NODE_ENV`: `production`.

The Discord application uses the `identify` scope only. The service reads the basic profile and does not request email, guild, or message access.

## Routes

- `GET /health`: Railway health check.
- `GET /auth/discord`: starts the OAuth consent flow.
- `GET /auth/discord/callback`: validates state, exchanges the authorization code server-side, fetches the basic Discord profile, and redirects to YuniHub with a short-lived ticket.
- `POST /auth/discord/exchange`: accepts `{ "ticket": "..." }` and returns the profile once. Tickets expire after 60 seconds and can only be exchanged once.

Example exchange request, intended for the Electron main process:

```http
POST /auth/discord/exchange
Content-Type: application/json

{"ticket":"one-time-ticket-from-deep-link"}
```

## Current integration boundary

The Railway service is scaffolded, but the existing Electron app is not yet wired to open `/auth/discord`, receive the `yunihub://discord-auth` deep link, and exchange its ticket. That desktop-side integration is a separate required change before the sign-in button can complete the flow. Do not put the Discord client secret or OAuth access token in renderer code.

The one-time ticket store is in memory, so run one Railway replica for this initial version. Multi-replica deployments need a shared store such as Redis for tickets.
