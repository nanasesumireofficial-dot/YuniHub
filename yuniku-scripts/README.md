# Yuniku Script Bundle

YuniHub reads bundled scripts from this folder and includes it in packaged releases. Add release-approved `.lua`, `.luau`, or `.txt` files here; only direct child files are listed.

A bundled script must be listed in `catalog.json` with its filename, title, version, author, description, games, supported executors, and tags. Increment the catalog version and update its `changes` list with each curated release. YuniHub displays the release notes once after the catalog version changes. The catalog is delivered with the YuniHub app release; a separate remote script feed requires a hosted update endpoint.

Catalog entry shape:

```json
{
	"file": "example.lua",
	"version": "1.2.0",
	"author": "Yuniku",
	"title": "Example script",
	"description": "What this script does.",
	"games": ["Example game"],
	"supportedExecutors": ["Executor name"],
	"tags": ["utility", "quality of life"]
}
```

The catalog wraps entries in a `scripts` array and includes top-level `version` and `changes` fields. A user's sidecar uses the same entry shape without `file`; place it beside the script as `<script filename>.json`.

A user script can provide the same metadata in a sidecar named `<script filename>.json`, such as `camera.lua.json`. Missing fields receive safe defaults.

A Lua script may be offered for executor autoload placement when its first 25 lines include this exact comment:

```lua
-- YUNIHUB_AUTOLOAD_SUPPORTED: true
```

This marker is a capability declaration for the user interface. YuniHub never executes script contents. Users choose which files to copy to their configured executor or autoload folder.
