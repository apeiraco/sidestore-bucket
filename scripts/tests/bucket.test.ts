import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync, strToU8 } from "fflate";
import { build as buildPlist, buildBinary } from "plist";
import { manifestSchema, lockSchema, verifyLock } from "../libs/schema.ts";
import { GitHub, selectAsset, type Candidate, type Release } from "../libs/github.ts";
import { inspectIPA, readEntitlements } from "../libs/ipa.ts";
import { renderCatalog, renderSource } from "../libs/render.ts";
import { build, unchanged, update, versionDescription } from "../libs/update.ts";
import { readLock, readWorkspace, json, ROOT } from "../libs/workspace.ts";

const manifest = manifestSchema.parse({
  name: "Example",
  bundleIdentifier: "org.example.app",
  developerName: "Example",
  localizedDescription: "An example app",
  iconURL: "https://example.org/icon.png",
  category: "other",
  checkver: { github: "example/app" },
  autoupdate: { assetRegex: "^Example_[0-9.]+\\+[0-9]+\\.ipa$" },
});
const source = {
  name: "Example",
  identifier: "org.example.source",
  subtitle: "Example source",
  description: "Example source",
  iconURL: "https://example.org/icon.png",
  sourceURL: "https://example.org/apps.json",
  website: "https://example.org/",
  nsfw: false,
};

function executable(entitlements?: Record<string, string | boolean>) {
  const header = Buffer.alloc(entitlements ? 48 : 32);
  header.writeUInt32LE(0xfeedfacf, 0);
  if (!entitlements) return header;
  const xml = Buffer.from(buildPlist(entitlements));
  const blob = Buffer.alloc(28 + xml.length);
  blob.writeUInt32BE(0xfade0cc0, 0);
  blob.writeUInt32BE(blob.length, 4);
  blob.writeUInt32BE(1, 8);
  blob.writeUInt32BE(5, 12);
  blob.writeUInt32BE(20, 16);
  blob.writeUInt32BE(0xfade7171, 20);
  blob.writeUInt32BE(8 + xml.length, 24);
  xml.copy(blob, 28);
  header.writeUInt32LE(1, 16);
  header.writeUInt32LE(16, 20);
  header.writeUInt32LE(0x1d, 32);
  header.writeUInt32LE(16, 36);
  header.writeUInt32LE(48, 40);
  header.writeUInt32LE(blob.length, 44);
  return Buffer.concat([header, blob]);
}

function ipa(binary = false, bundle = "org.example.app", version = "1.0.0") {
  const info = {
    CFBundleIdentifier: bundle,
    CFBundleShortVersionString: version,
    CFBundleVersion: "42",
    CFBundleExecutable: "Example",
    MinimumOSVersion: "15.0",
    NSCameraUsageDescription: "Read a QR code",
  };
  const extra = {
    ...info,
    CFBundleIdentifier: `${bundle}.share`,
    NSPhotoLibraryUsageDescription: "Share a photo",
  };
  return Buffer.from(
    zipSync({
      "Payload/Example.app/Info.plist": binary ? buildBinary(info) : strToU8(buildPlist(info)),
      "Payload/Example.app/Example": executable({ "aps-environment": "development" }),
      "Payload/Example.app/PlugIns/Share.appex/Info.plist": strToU8(buildPlist(extra)),
      "Payload/Example.app/PlugIns/Share.appex/Example": executable(),
      "Payload/Example.app/Frameworks/Test.framework/Info.plist": strToU8("ignored"),
    }),
  );
}

function candidate(data: Buffer, id = 1): Candidate {
  const release: Release = {
    id,
    tag_name: "v1.0.0+42",
    published_at: "2026-09-25T00:00:00Z",
    body: "Bug fixes",
    draft: false,
    prerelease: false,
    assets: [
      {
        id,
        name: "Example_1.0.0+42.ipa",
        size: data.length,
        updated_at: "2026-09-25T00:00:00Z",
        browser_download_url:
          "https://github.com/example/app/releases/download/v1.0.0%2B42/Example_1.0.0%2B42.ipa",
        state: "uploaded",
      },
    ],
  };
  return selectAsset(manifest, release);
}

async function workspace(run: (root: string) => Promise<void>) {
  await mkdir(join(ROOT, "temp"), { recursive: true });
  const root = await mkdtemp(join(ROOT, "temp", "test-"));
  try {
    await mkdir(join(root, "bucket"));
    await writeFile(join(root, "source.json"), json(source));
    await writeFile(join(root, "bucket/example.json"), json(manifest));
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("read actual XML and binary IPA metadata, including extension permissions", () => {
  for (const binary of [false, true]) {
    const result = inspectIPA(ipa(binary));
    assert.equal(result.bundleIdentifier, manifest.bundleIdentifier);
    assert.equal(result.version, "1.0.0");
    assert.equal(result.buildVersion, "42");
    assert.equal(result.minOSVersion, "15.0");
    assert.deepEqual(result.appPermissions.entitlements, ["aps-environment"]);
    assert.equal(result.appPermissions.privacy.NSPhotoLibraryUsageDescription, "Share a photo");
  }
});

test("reject missing IPA identity, missing main application, and invalid executables", () => {
  assert.throws(
    () => inspectIPA(Buffer.from(zipSync({ "not-an-app.txt": strToU8("test") }))),
    /one main/,
  );
  assert.throws(() => readEntitlements(Buffer.from("bad")));
  const malformed = executable();
  malformed.writeUInt32LE(1, 16);
  assert.throws(() => readEntitlements(malformed), /Truncated/);
  assert.throws(
    () =>
      inspectIPA(
        Buffer.from(
          zipSync({
            "Payload/Main.app/Info.plist": strToU8(buildPlist({ CFBundleIdentifier: "x" })),
          }),
        ),
      ),
    /CFBundleExecutable/,
  );
});

test("select exactly one stable IPA and preserve encoded GitHub download URL", () => {
  const valid = candidate(ipa());
  assert.match(valid.asset.browser_download_url, /%2B42/);
  assert.throws(() => selectAsset(manifest, { ...valid.release, prerelease: true }), /stable/);
  assert.throws(() => selectAsset(manifest, { ...valid.release, draft: true }), /stable/);
  assert.throws(() => selectAsset(manifest, { ...valid.release, assets: [] }), /found 0/);
  assert.throws(
    () => selectAsset(manifest, { ...valid.release, assets: [valid.asset, valid.asset] }),
    /found 2/,
  );
  assert.throws(
    () =>
      selectAsset(manifest, {
        ...valid.release,
        assets: [{ ...valid.asset, browser_download_url: "https://evil.example/app.ipa" }],
      }),
    /invalid/,
  );
});

test("reject invalid manifests and duplicate identities", async () => {
  assert.throws(() => manifestSchema.parse({ ...manifest, autoupdate: { assetRegex: "*.ipa" } }));
  assert.throws(() => manifestSchema.parse({ ...manifest, iconURL: "http://example.org/a" }));
  assert.throws(() => manifestSchema.parse({ ...manifest, releaseNotes: { v1: "修复问题" } }));
  await workspace(async (root) => {
    await writeFile(join(root, "bucket/duplicate.json"), json(manifest));
    await assert.rejects(readWorkspace(root), /Duplicate/);
  });
});

test("use curated English version descriptions with a stable English fallback", () => {
  assert.equal(
    versionDescription(manifest, "v2.0.0", "2.0.0"),
    "Updates Example to version 2.0.0.",
  );
  assert.equal(
    versionDescription(
      { ...manifest, releaseNotes: { "v2.0.0": "Fixes startup." } },
      "v2.0.0",
      "2.0.0",
    ),
    "Fixes startup.",
  );
});

test("update deterministically, retain one version, and generate synchronized legacy fields", async () => {
  await workspace(async (root) => {
    const data = ipa(true);
    const latest = candidate(data);
    const backend = { latest: async () => latest };
    let downloads = 0;
    const download = async () => {
      downloads++;
      return data;
    };
    assert.deepEqual(await update(root, {}, backend, download), { changed: ["example"] });
    const first = await readFile(join(root, "apps.json"), "utf8");
    const generated = JSON.parse(first);
    assert.equal(generated.apps[0].versions.length, 1);
    assert.equal(generated.apps[0].versions[0].version, generated.apps[0].version);
    assert.equal(generated.apps[0].versions[0].downloadURL, generated.apps[0].downloadURL);
    assert.match(generated.apps[0].versions[0].sha256, /^[0-9a-f]{64}$/);
    assert.equal(generated.apps[0].versions[0].buildVersion, "42");
    assert.equal(generated.apps[0].versionDescription, "Updates Example to version 1.0.0.");
    assert.equal(generated.apps[0].checkver, undefined);
    assert.equal(generated.apps[0].releaseNotes, undefined);
    assert.deepEqual(await update(root, {}, backend, download), { changed: [] });
    assert.equal(downloads, 1);
    assert.equal(await readFile(join(root, "apps.json"), "utf8"), first);
    await build(root, true);
    await writeFile(join(root, "apps.json"), "{}");
    await assert.rejects(build(root, true), /stale/);
    await build(root);
    assert.equal(await readFile(join(root, "apps.json"), "utf8"), first);
  });
});

test("failed later app verification does not mutate previously published artifacts", async () => {
  await workspace(async (root) => {
    const original = ipa();
    await update(root, {}, { latest: async () => candidate(original) }, async () => original);
    const snapshot = await readFile(join(root, "bucket.lock.json"), "utf8");
    const feed = await readFile(join(root, "apps.json"), "utf8");
    await writeFile(
      join(root, "bucket/second.json"),
      json({ ...manifest, bundleIdentifier: "org.example.second" }),
    );
    const next = ipa(false, "org.example.app", "1.0.1");
    await assert.rejects(
      update(root, {}, { latest: async () => candidate(next, 2) }, async () => next),
      /bundle identifier/,
    );
    assert.equal(await readFile(join(root, "bucket.lock.json"), "utf8"), snapshot);
    assert.equal(await readFile(join(root, "apps.json"), "utf8"), feed);
    await assert.rejects(update(root, { app: "typo" }), /Unknown app/);
  });
});

test("reject bad hashes and silent replacement of a version/build", async () => {
  await workspace(async (root) => {
    const first = ipa();
    await update(root, {}, { latest: async () => candidate(first) }, async () => first);
    const replacement = ipa(true);
    await assert.rejects(
      update(root, {}, { latest: async () => candidate(replacement, 2) }, async () => replacement),
      /without changing/,
    );
    const badDigest = candidate(first);
    badDigest.asset.digest = `sha256:${"0".repeat(64)}`;
    await assert.rejects(
      update(root, { force: true }, { latest: async () => badDigest }, async () => first),
      /integrity/,
    );
  });
});

test("lock consistency and catalog rendering reject or escape untrusted input", async () => {
  await workspace(async (root) => {
    const data = ipa();
    await update(root, {}, { latest: async () => candidate(data) }, async () => data);
    const lock = await readLock(root);
    const apps = [{ id: "example", manifest: { ...manifest, name: "<script>|{{ x }}" } }];
    assert.ok(!renderCatalog(source, apps, lock).includes("<script>"));
    assert.ok(!renderCatalog(source, apps, lock).includes("{{"));
    assert.equal(renderSource(source, apps, lock).apps.length, 1);
    assert.equal(unchanged(lock.apps.example, manifest, candidate(data)), true);
    const invalid = structuredClone(lock);
    invalid.apps.example!.repo = "other/repo";
    assert.throws(() => verifyLock(apps, invalid), /mismatched/);
    assert.throws(() => lockSchema.parse({ ...lock, schemaVersion: 2 }));
  });
});

test("GitHub errors do not expose token or authenticated request details", async () => {
  const backend = new GitHub("secret-test-token");
  backend.client.hook.wrap("request", async () => {
    throw Object.assign(new Error("secret-test-token"), { status: 403 });
  });
  await assert.rejects(backend.latest(manifest), (error: Error) => {
    assert.match(error.message, /HTTP 403/);
    assert.ok(!error.message.includes("secret-test-token"));
    return true;
  });
});
