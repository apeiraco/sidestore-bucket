import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { GitHub, type Candidate } from "./github.ts";
import { downloadIPA, sha256 } from "./download.ts";
import { inspectIPA } from "./ipa.ts";
import { entrySchema, lockSchema, type Manifest, type LockEntry, type App } from "./schema.ts";
import { artifacts } from "./render.ts";
import { ROOT, readWorkspace, readLock, writeAtomic, json } from "./workspace.ts";

export const unchanged = (entry: LockEntry | undefined, manifest: Manifest, candidate: Candidate) =>
  entry?.repo === manifest.checkver.github &&
  entry.bundleIdentifier === manifest.bundleIdentifier &&
  entry.releaseID === candidate.release.id &&
  entry.tag === candidate.release.tag_name &&
  entry.assetID === candidate.asset.id &&
  entry.assetUpdatedAt === candidate.asset.updated_at &&
  entry.version.size === candidate.asset.size &&
  entry.version.downloadURL === candidate.asset.browser_download_url &&
  (!candidate.asset.digest || candidate.asset.digest === `sha256:${entry.version.sha256}`);

function selected(apps: App[], filter?: string): App[] {
  if (filter && !apps.some((app) => app.id === filter)) throw new Error(`Unknown app: ${filter}`);
  return filter ? apps.filter((app) => app.id === filter) : apps;
}

export function versionDescription(manifest: Manifest, tag: string, version: string): string {
  return manifest.releaseNotes?.[tag] ?? `Updates ${manifest.name} to version ${version}.`;
}

export async function checkVersions(root = ROOT, filter?: string, backend = new GitHub()) {
  const { apps } = await readWorkspace(root);
  const lock = await readLock(root);
  const result = [];
  for (const { id, manifest } of selected(apps, filter)) {
    const candidate = await backend.latest(manifest);
    result.push({
      app: id,
      installed: lock.apps[id]?.tag ?? null,
      available: candidate.release.tag_name,
      changed: !unchanged(lock.apps[id], manifest, candidate),
    });
  }
  return result;
}

export async function build(root = ROOT, check = false) {
  const { source, apps } = await readWorkspace(root);
  const lock = await readLock(root);
  const output = artifacts(source, apps, lock);
  for (const [name, content] of Object.entries(output)) {
    if (check) {
      if ((await readFile(join(root, name), "utf8")) !== content)
        throw new Error(`${name} is stale; run just build`);
    } else await writeAtomic(join(root, name), content);
  }
}

export async function update(
  root = ROOT,
  options: { app?: string; force?: boolean } = {},
  backend: { latest: (manifest: Manifest) => Promise<Candidate> } = new GitHub(),
  download = downloadIPA,
) {
  const { source, apps } = await readWorkspace(root);
  const old = await readLock(root);
  const next = structuredClone(old);
  const changed: string[] = [];
  for (const { id, manifest } of selected(apps, options.app)) {
    const candidate = await backend.latest(manifest);
    const previous = old.apps[id];
    if (!options.force && unchanged(previous, manifest, candidate)) continue;
    const data = await download(root, candidate);
    const info = inspectIPA(data);
    if (info.bundleIdentifier !== manifest.bundleIdentifier)
      throw new Error(`${id}: IPA bundle identifier differs from the manifest`);
    const digest = sha256(data);
    if (
      data.length !== candidate.asset.size ||
      (candidate.asset.digest && candidate.asset.digest !== `sha256:${digest}`)
    ) {
      throw new Error(`${id}: IPA integrity verification failed`);
    }
    // A replaced binary with an unchanged app identity cannot reliably trigger an update in clients.
    if (
      previous &&
      previous.version.version === info.version &&
      previous.version.buildVersion === info.buildVersion &&
      previous.version.sha256 !== digest
    )
      throw new Error(
        `${id}: upstream replaced an IPA without changing its version/build; review manually`,
      );
    next.apps[id] = entrySchema.parse({
      repo: manifest.checkver.github,
      tag: candidate.release.tag_name,
      releaseID: candidate.release.id,
      assetID: candidate.asset.id,
      assetUpdatedAt: candidate.asset.updated_at,
      bundleIdentifier: info.bundleIdentifier,
      version: {
        version: info.version,
        buildVersion: info.buildVersion,
        minOSVersion: info.minOSVersion,
        date: candidate.release.published_at,
        localizedDescription: versionDescription(
          manifest,
          candidate.release.tag_name,
          info.version,
        ),
        downloadURL: candidate.asset.browser_download_url,
        size: data.length,
        sha256: digest,
      },
      appPermissions: info.appPermissions,
    });
    if (json(previous) !== json(next.apps[id])) changed.push(id);
  }
  next.apps = Object.fromEntries(
    apps.filter(({ id }) => next.apps[id]).map(({ id }) => [id, next.apps[id]!]),
  );
  lockSchema.parse(next);
  // No tracked files are touched until all releases and IPA metadata have passed validation.
  const output = { "bucket.lock.json": json(next), ...artifacts(source, apps, next) };
  for (const [name, content] of Object.entries(output))
    await writeAtomic(join(root, name), content);
  return { changed };
}
