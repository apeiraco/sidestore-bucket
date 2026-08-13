# AGENTS.md

The single source of truth for agent instructions.

- Respond in the user's language; write code and comments in English. Keep English as the canonical documentation language and maintain user-facing Chinese translations alongside it.
- Run project commands through `mise exec --` in non-interactive shells.
- Keep compatible tool ranges in `mise.toml` for development and exact versions in `mise.ci.toml` for CI.
- Keep declarative app metadata in `bucket/*.json`, CLI entrypoints in `scripts/bucket-cli.ts`, and shared code in `scripts/libs/`.
- Use Octokit for GitHub API operations. Do not execute downloaded app code.
- Store all downloads, experiments, and temporary files under `temp/`; exclude them from tests and version control.
- `bucket.lock.json`, `apps.json`, `docs/apps.md`, and `docs/zh/apps.md` are generated. Update them through the CLI.
- Publish exactly one stable version per app. Verify the IPA's actual bundle identifier, version, build, minimum OS, and permissions before updating.
- Keep the source identifier and app bundle identifiers stable. Preserve API-provided download URLs, including encoding.
- Generate docs from the same manifests and lock as the source. Use symlinks for repository documents shown in the docs site.
- Run `just check` and `just build-docs` before completing implementation changes.
- Do not push or publish to GitHub unless the user explicitly requests it.
