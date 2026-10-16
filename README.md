# Release Updates

YuniHub checks GitHub Releases for application updates in packaged builds. `npm run release` builds the Windows installer and publishes it to the configured `toxicdrewzz-ctrl/YuniHub` repository. Set `GH_TOKEN` in the publishing environment with permission to create releases; never commit the token.

The release must include the electron-builder update metadata (including `latest.yml`) alongside the installer. Users can check in Settings, download when ready, then restart to install. Development builds do not check for updates.

Curated Yuniku script catalogs are versioned in `yuniku-scripts/catalog.json`. Increment its version and update its `changes` list in the same app release to show script release notes. No script files are included by default.
