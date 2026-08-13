import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { manifestSchema, sourceSchema, lockSchema, type App, type Lock } from "./schema.ts";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
export const readJSON = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, "utf8"));

export async function readWorkspace(root = ROOT) {
  const source = sourceSchema.parse(await readJSON(join(root, "source.json")));
  const files = (await readdir(join(root, "bucket")))
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (!files.length) throw new Error("Bucket is empty");
  const apps: App[] = [];
  const identities = new Set<string>();
  for (const file of files) {
    const id = file.slice(0, -5);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
      throw new Error(`Invalid manifest filename: ${file}`);
    const manifest = manifestSchema.parse(await readJSON(join(root, "bucket", file)));
    if (identities.has(manifest.bundleIdentifier))
      throw new Error(`Duplicate bundle identifier: ${manifest.bundleIdentifier}`);
    identities.add(manifest.bundleIdentifier);
    apps.push({ id, manifest });
  }
  return { source, apps };
}

export async function readLock(root = ROOT): Promise<Lock> {
  try {
    return lockSchema.parse(await readJSON(join(root, "bucket.lock.json")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, apps: {} };
    throw error;
  }
}

export async function writeAtomic(path: string, data: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  // All targets are inside the repository, keeping ignored staging on the same filesystem.
  const staging = join(ROOT, "temp", "staging");
  await mkdir(staging, { recursive: true });
  const stage = join(staging, `${randomUUID()}.tmp`);
  try {
    await writeFile(stage, data);
    await rename(stage, path);
  } finally {
    await rm(stage, { force: true });
  }
}
