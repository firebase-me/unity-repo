# OpenUPM migration (procedural mirror)
This folder contains the **OpenUPM-oriented** setup for this repo.

## Invariants (matter-of-fact)
- **Package IDs stay official**: `com.google.firebase.*` and `com.google.external-dependency-manager`.
- **Versions stay official**: if upstream is `13.8.0`, then our `package.json` version is `13.8.0`.
- We are **mirroring official Firebase artifacts**; we do not invent versions.

## Source of truth
- Official tarballs live in `../packages/<major>/*.tgz`.
- OpenUPM requires **package folders** (UPM layout) to publish.
- Therefore we materialize package folders into:
  - `oenupm/packages/<packageName>/...`

## Materializing package folders
Run the sync script:
- `oenupm/scripts/sync-from-tgz.ps1`

What it does:
- reads `../packages/<major>/*.tgz`
- extracts each tarball
- copies the extracted `package/` folder to `oenupm/packages/<packageName>/`
- preserves `package.json` `name` and `version` exactly as in the tarball

## Publishing (CI)
Publishing to OpenUPM is done via GitHub Actions.
- Workflow: `.github/workflows/openupm-publish.yml`

Required secret:
- `OPENUPM_TOKEN`

Important:
- Publishing is expected to be **immutable per (packageName, version)**.
  If you change bytes for a given version, publishing that same version again will fail or create integrity conflicts.

## Registry usage (consumers)
Once published on OpenUPM, consumers use:
- Registry URL: `https://package.openupm.com`
- Scopes: `com.google.firebase` and `com.google.external-dependency-manager`

(Installing from OpenUPM is separate from the GitHub Pages mirror; this folder only addresses OpenUPM publishing.)
