# Firebase Unity UPM Mirror (Procedural Registry)
This repo is a **static, npm-style Unity Package Manager (UPM) registry** (a mirror) for Firebase Unity `.tgz` packages.
It is not a runtime service. The “registry” is a set of **static JSON metadata + tarballs** hosted on GitHub Pages (optionally behind the custom domain `unity.firebase.me`).

## What this is (and is not)
- This is a **procedural UPM mirror**: you drop known-good `.tgz` artifacts into `packages/<major>/`, the registry metadata is generated, and the output is deployed.
- This is **not** OpenUPM.
- This is **not** a package build pipeline (we do not compile Firebase). We only mirror/distribute upstream tarballs.

## Repo layout (source vs deployed)
- Source tarballs live in:
  - `packages/<major>/*.tgz`
- Deployed (GitHub Pages) output lives in:
  - `docs/` (this folder is what Pages publishes)

Inside `docs/` you will find:
- `docs/<major>/*.tgz` — the tarballs served to Unity
- `docs/<packageName>` — npm-style package metadata endpoint (no extension)
- `docs/-/all` — npm-style “all packages” endpoint
- `docs/index.json` — convenience listing for humans/tools
- `docs/index.html` — human landing page
- `docs/CNAME` — custom domain (when used)

## Intended hosting URLs
The registry root must be a base URL **with no extra path suffix** beyond the Pages site root.

- GitHub Pages (no custom domain):
  - Registry URL: `https://firebase-me.github.io/unity-repo`
- Custom domain (CNAME):
  - Registry URL: `https://unity.firebase.me`

IMPORTANT:
- There is **no** `/unity` subpath registry.
- If you configure Unity to use a wrong base URL (example: `.../unity`), Unity will fetch **HTML/404 responses** instead of the registry JSON/tarballs, and you will see **sha512 mismatch** and/or **size mismatch** errors.

## Consumer configuration (Unity `Packages/manifest.json`)
Use the registry URL that matches how you are hosting.

Example (custom domain):
- `url`: `https://unity.firebase.me`
- scopes should include both Firebase and EDM4U:
  - `com.google.firebase`
  - `com.google.external-dependency-manager`

Example snippet:
```json
{
  "scopedRegistries": [
    {
      "name": "Firebase Me",
      "url": "https://unity.firebase.me",
      "scopes": [
        "com.google.firebase",
        "com.google.external-dependency-manager"
      ]
    }
  ]
}
```

## Publishing flow (source of truth)
### 1) Add/update mirrored tarballs
1. Put upstream `.tgz` files into the correct major folder:
   - `packages/<major>/com.google.firebase.<thing>-<version>.tgz`
2. Commit and push to `main`.

### 2) CI generates the registry + deploys
On pushes to `main`, GitHub Actions:
- reads `packages/<major>/*.tgz`
- generates/updates npm-style package metadata under `docs/`
- copies tarballs into `docs/<major>/`
- deploys `docs/` to GitHub Pages

Workflow file:
- `.github/workflows/deploy-registry.yml`

### 3) (Optional) Tag a release
A tag workflow may create a GitHub Release and attach tarballs.
If you rely on release attachments, make sure the workflow’s `files:` glob matches the repo structure.

Current repo structure stores tarballs under `packages/<major>/`, so a release attachment glob must match that layout (not `packages/*.tgz`).

Workflow file:
- `.github/workflows/publish-release.yml`

## The integrity contract (why sha512/size mismatches happen)
UPM verifies what it downloads.
For each package version, the registry metadata includes:
- `dist.tarball` (URL)
- `dist.shasum` (sha1)
- `dist.integrity` (sha512-…)

A **sha512 mismatch** or **size mismatch** means:
- Unity did **not** download the exact bytes that were hashed when metadata was generated.

The common causes in a static mirror:
1. **Wrong registry base URL** (e.g. you added `/unity` or another path)
   - Unity downloads an HTML error page or a redirect page instead of JSON/tgz.
2. **Tarball URL points somewhere different than the file you deployed**
   - Metadata `dist.tarball` must match what is actually present in `docs/<major>/`.
3. **Stale CDN/cache serving old content**
   - You updated a `.tgz` at the same URL, but clients/proxies cached the old one.
   - Fix: never mutate artifacts in-place; publish new versions/URLs.
4. **The tarball content was changed after hashes were computed**
   - If anything rewrites the `.tgz` bytes between hash computation and hosting, integrity will fail.

## Operational rules (do not drift)
- Do not hand-edit generated registry files in `docs/` as a “fix”.
  - If the output is wrong, fix the source inputs (`packages/`) and/or the generation procedure and redeploy.
- Do not overwrite an existing `<package>-<version>.tgz` with different bytes.
  - That guarantees integrity/caching failures.

## Quick debug checklist
When a user reports sha512/size mismatch:
1. Confirm their Unity scoped registry URL is exactly one of:
   - `https://unity.firebase.me`
   - `https://firebase-me.github.io/unity-repo`
   (no extra path)
2. Pick one failing package/version and look up its metadata in `docs/<packageName>`.
3. Copy the `dist.tarball` URL and verify it serves the expected `.tgz` bytes (not HTML, not a 404 page).
4. Ensure the `.tgz` file exists in `docs/<major>/` and matches what was hashed.
