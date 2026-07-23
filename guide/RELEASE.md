# Release

Semi-automated release flow: changelog drafted from conventional commits →
human review → tag push → CI publishes npm packages + GitHub Release.
Mechanism: [`release.yml`](../.github/workflows/release.yml),
[`cliff.toml`](../cliff.toml),
[`scripts/extract-changelog.mjs`](../scripts/extract-changelog.mjs).

## Steps

1. **Draft the changelog** (on up-to-date `main`):

   ```bash
   cargo make changelog v0.2.0
   ```

   git-cliff prepends a `## v0.2.0 - YYYY-MM-DD` section to CHANGELOG.md,
   grouped by commit type (`feat`/`fix`/`perf`/…, breaking = **BREAKING:**).

2. **Review & edit the section**, then commit it to `main` (via PR).
   Keep the `## v0.2.0` heading line intact — CI matches on it.

3. **Push the tag:**

   ```bash
   git tag v0.2.0 && git push origin v0.2.0
   ```

4. **Approve the `npm-publish` environment** in the Actions UI.
   CI then publishes to npm and creates the GitHub Release automatically.

## What CI does (`release.yml`, on `v*.*.*` tag)

- `publish` job:
  - fail fast if CHANGELOG.md has no `## vX.Y.Z` section for the tag
  - clean WASM release build (no caches), stamp tag version into all packages
    (lockstep — the tag is the only version source)
  - npm publish via trusted publishing (OIDC) + provenance, gated by the
    `npm-publish` environment approval
- `github-release` job (only after `publish` succeeds):
  - extract the tag's section from CHANGELOG.md
  - `gh release create --verify-tag --notes-file …`

## Security design

- **Human review gate** — CI publishes only the committed CHANGELOG.md; commit
  messages (untrusted input) are never auto-published or regenerated in CI
- **No third-party tools in CI** — git-cliff runs locally only; CI uses
  preinstalled Node + `gh` and a dependency-free script
- **Least privilege per job** — `contents: write` only on `github-release`,
  never alongside the npm OIDC permission (`id-token: write`)
- **No shell interpolation** — notes passed to `gh` as a file (`--notes-file`)
- **Fork guard + `--verify-tag`** — release created only on the canonical repo
  for an existing tag

## Troubleshooting

- **`No "## vX.Y.Z" section in CHANGELOG.md`** — tag pushed without the
  changelog commit. Delete the tag, commit the section, re-tag.
- **Re-run after failure** — re-runnable from the Actions UI; if the release
  already exists, delete it first before re-running `github-release`.
- **First release** — no prior tag reachable from `main`, so the section
  contains the full history; prune during review. (`v0.0.1` is not an
  ancestor of `main` and does not act as a boundary.)
