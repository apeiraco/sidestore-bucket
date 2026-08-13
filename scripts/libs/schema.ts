import { z } from "zod";

const text = z.string().trim().min(1);
const https = z.url().refine((url) => url.startsWith("https://"), "HTTPS is required");
const numericVersion = text.regex(/^\d+(?:\.\d+)*$/);
const englishReleaseNote = text.refine(
  (value) =>
    !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(value),
  "Release notes must be written in English",
);
export const permissionsSchema = z.strictObject({
  entitlements: z.array(text),
  privacy: z.record(text, text),
});
export const manifestSchema = z.strictObject({
  name: text,
  bundleIdentifier: text,
  developerName: text,
  localizedDescription: text,
  iconURL: https,
  category: z.enum([
    "developer",
    "entertainment",
    "games",
    "lifestyle",
    "other",
    "photo-video",
    "social",
    "utilities",
  ]),
  releaseNotes: z.record(text, englishReleaseNote).optional(),
  checkver: z.strictObject({ github: text.regex(/^[\w.-]+\/[\w.-]+$/) }),
  autoupdate: z.strictObject({
    assetRegex: text.refine((value) => {
      try {
        new RegExp(value);
        return value.startsWith("^") && value.endsWith("$");
      } catch {
        return false;
      }
    }, "Use a valid, anchored asset regular expression"),
  }),
});
export const sourceSchema = z.strictObject({
  name: text,
  identifier: text,
  subtitle: text,
  description: text,
  iconURL: https,
  sourceURL: https,
  website: https,
  nsfw: z.boolean(),
});
export const versionSchema = z.strictObject({
  version: numericVersion,
  buildVersion: text,
  date: z.iso.datetime(),
  localizedDescription: z.string(),
  downloadURL: https,
  size: z
    .number()
    .int()
    .positive()
    .max(512 * 1024 * 1024),
  minOSVersion: numericVersion,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export const entrySchema = z.strictObject({
  repo: text,
  tag: text,
  releaseID: z.number().int().positive(),
  assetID: z.number().int().positive(),
  assetUpdatedAt: z.iso.datetime(),
  bundleIdentifier: text,
  version: versionSchema,
  appPermissions: permissionsSchema,
});
export const lockSchema = z.strictObject({
  schemaVersion: z.literal(1),
  apps: z.record(text, entrySchema),
});
export type Manifest = z.infer<typeof manifestSchema>;
export type SourceConfig = z.infer<typeof sourceSchema>;
export type Permissions = z.infer<typeof permissionsSchema>;
export type LockEntry = z.infer<typeof entrySchema>;
export type Lock = z.infer<typeof lockSchema>;
export type App = { id: string; manifest: Manifest };

export function verifyLock(apps: App[], lock: Lock): void {
  if (Object.keys(lock.apps).length !== apps.length)
    throw new Error("Lock does not match the bucket; run update");
  for (const { id, manifest } of apps) {
    const entry = lock.apps[id];
    if (
      !entry ||
      entry.bundleIdentifier !== manifest.bundleIdentifier ||
      entry.repo !== manifest.checkver.github
    ) {
      throw new Error(`${id}: missing or mismatched lock entry; run update`);
    }
    const url = new URL(entry.version.downloadURL);
    const expected = `/${entry.repo}/releases/download/${encodeURIComponent(entry.tag)}/`;
    if (
      url.hostname !== "github.com" ||
      !url.pathname.startsWith(expected) ||
      !new RegExp(manifest.autoupdate.assetRegex).test(
        decodeURIComponent(url.pathname.slice(expected.length)),
      )
    ) {
      throw new Error(
        `${id}: lock download does not match the configured repository, tag, or asset pattern`,
      );
    }
  }
}
