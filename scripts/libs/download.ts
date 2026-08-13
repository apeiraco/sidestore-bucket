import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { type Candidate } from "./github.ts";
import { writeAtomic } from "./workspace.ts";

export const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

export async function downloadIPA(root: string, candidate: Candidate): Promise<Buffer> {
  const { asset } = candidate;
  const cache = join(root, "temp", "downloads");
  await mkdir(cache, { recursive: true });
  const file = join(cache, `${asset.id}-${Date.parse(asset.updated_at)}.ipa`);
  const digestFile = `${file}.sha256`;
  const check = (data: Buffer, expected: string) => {
    if (data.length !== asset.size || sha256(data) !== expected)
      throw new Error("IPA size or SHA-256 mismatch");
    if (asset.digest && asset.digest !== `sha256:${expected}`)
      throw new Error("GitHub asset digest mismatch");
    return data;
  };
  try {
    return check(await readFile(file), (await readFile(digestFile, "utf8")).trim());
  } catch {
    // Redownload incomplete or corrupt cache entries; never treat them as verified state.
    await rm(file, { force: true });
    await rm(digestFile, { force: true });
  }
  // The API is handled by Octokit; this is an unauthenticated public binary download.
  const response = await fetch(asset.browser_download_url, {
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok || !response.body)
    throw new Error(`IPA download failed (HTTP ${response.status})`);
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > asset.size) throw new Error("IPA exceeded the release asset size");
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks);
  const digest = sha256(data);
  check(data, digest);
  await writeAtomic(file, data);
  await writeAtomic(digestFile, `${digest}\n`);
  return data;
}
