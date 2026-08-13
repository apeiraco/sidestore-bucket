# Contributing

Contributions may add an app, correct metadata, improve verification, or refine the documentation. Keep the source small, reproducible, and reviewable.

<div class="github-only">

**[🇨🇳 简体中文](CONTRIBUTING_CN.md)**

</div>

## Development setup

Install [mise](https://mise.jdx.dev/), then prepare the repository:

```sh
mise trust
mise install
mise exec -- just setup
```

Run project commands through mise in non-interactive shells. GitHub API access works without authentication at the public rate limit; set `GH_TOKEN` or `GITHUB_TOKEN` when a higher limit is needed.

## Add or update an app

Application manifests live in `bucket/*.json`. Start from an existing manifest and provide:

- the app identity and English description;
- the bundle identifier verified from an actual IPA;
- the upstream GitHub repository;
- an anchored asset regular expression that selects exactly one IPA;
- an English `releaseNotes` entry keyed by the exact upstream tag when a release needs a useful description.

If a tag has no curated entry, the updater emits a short English version update message. Remove obsolete release-note entries when updating a manifest.

Check and publish metadata locally with:

```sh
mise exec -- just checkver
mise exec -- just update --app <app-slug>
mise exec -- just check
mise exec -- just build-docs
```

Review changes to the app identity, version, build, minimum iOS version, permissions, download URL, and SHA-256. Do not execute downloaded app code.

## Generated files

The CLI generates `bucket.lock.json`, `apps.json`, `docs/apps.md`, and `docs/zh/apps.md`. Do not edit them directly. Downloads and experiments belong under the ignored `temp/` directory.

`bucket.lock.json` is the verified artifact record, not another app manifest. It keeps the exact release and asset IDs, API-provided URL, IPA identity, version, build, minimum iOS version, permissions, size, and SHA-256. This lets the source and documentation build deterministically without GitHub access or another IPA download, while keeping manifest changes separate from verified artifact changes.

The source retains one stable version per app. The updater uses Octokit to select the latest stable GitHub release, preserves the API-provided download URL, inspects the IPA, and writes tracked files only after every selected artifact passes validation.

## Commit checks

The development mise configuration follows compatible major or minor tool releases, while `mise.ci.toml` pins the exact CI toolchain. Run `mise exec -- prek install` once to enable the repository's pre-commit checks. `prek` validates JSON, TOML, YAML, symlinks, source generation, bucket/lock alignment, TypeScript, formatting, tests, and local documentation links.

## Pull requests

Keep manifest and generated changes together. Before opening a pull request, run:

```sh
mise exec -- just check
mise exec -- just build-docs
```

Explain the user-visible change and call out any new or changed permissions. Do not commit downloaded IPAs, credentials, generated VitePress output, or unrelated formatting changes.
